import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// PostgreSQL connection with connection pooling
let pg = null
let pool = null

async function connectToPostgres() {
  if (!pg) {
    pg = require('pg')
  }
  
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
      process.exit(-1)
    })
  }
  
  return pool
}

// Gemini AI connection
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key')

// Check if Gemini API key is valid
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') {
  console.warn('⚠️ GEMINI_API_KEY not set! OCR and AI chat will not work.')
}

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// OCR Processing with Gemini 2.5 Flash
async function processOCR(imageBuffer) {
  try {
    // Check if API key is valid
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') {
      return { 
        success: false, 
        error: 'GEMINI_API_KEY not configured. Please set a valid API key in environment variables.' 
      }
    }

    const base64Image = imageBuffer.toString('base64')
    
    const prompt = `
    Проанализируй это изображение и извлеки весь текст, который на нем написан. 
    Верни только чистый текст без дополнительных комментариев.
    Если это документ, извлеки все даты, номера документов, суммы денег, имена людей и другую важную информацию.
    `
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      },
      prompt
    ])
    
    const response = await result.response
    const text = response.text()
    
    return {
      success: true,
      text: text,
      confidence: 0.9
    }
  } catch (error) {
    console.error('Gemini OCR Error:', error)
    return { success: false, error: error.message }
  }
}

// Get or create active session for case
async function getOrCreateActiveSession(caseId, db) {
  if (!caseId) {
    throw new Error('Case ID is required for session creation')
  }
  
  const result = await db.query(`
    SELECT get_or_create_active_session($1) as session_id
  `, [caseId])
  
  return result.rows[0].session_id
}

// Get case context (cached or fresh)
async function getCaseContext(caseId, db) {
  if (!caseId) {
    throw new Error('Case ID is required')
  }
  
  // Try to get cached context first
  const cacheResult = await db.query(`
    SELECT context_data, last_updated 
    FROM case_context_cache 
    WHERE case_id = $1 
    ORDER BY last_updated DESC 
    LIMIT 1
  `, [caseId])
  
  // If cache is fresh (less than 1 hour old), use it
  if (cacheResult.rows.length > 0) {
    const cacheAge = Date.now() - new Date(cacheResult.rows[0].last_updated).getTime()
    if (cacheAge < 3600000) { // 1 hour
      return cacheResult.rows[0].context_data
    }
  }
  
  // Build fresh context
  const caseResult = await db.query(`
    SELECT * FROM cases WHERE id = $1
  `, [caseId])
  
  if (caseResult.rows.length === 0) {
    throw new Error('Case not found')
  }
  
  const photosResult = await db.query(`
    SELECT 
      cp.*,
      ocr.raw_text,
      ocr.extracted_dates,
      ocr.extracted_numbers,
      ocr.extracted_names,
      ocr.extracted_amounts,
      ocr.confidence_score
    FROM case_photos cp
    LEFT JOIN photo_ocr_results ocr ON cp.id = ocr.photo_id
    WHERE cp.case_id = $1
    ORDER BY cp.display_order
  `, [caseId])
  
  const context = {
    case: caseResult.rows[0],
    photos: photosResult.rows,
    summary: {
      total_photos: photosResult.rows.length,
      processed_photos: photosResult.rows.filter(p => p.raw_text).length,
      extracted_dates: [...new Set(photosResult.rows.flatMap(p => p.extracted_dates || []))],
      extracted_numbers: [...new Set(photosResult.rows.flatMap(p => p.extracted_numbers || []))],
      extracted_names: [...new Set(photosResult.rows.flatMap(p => p.extracted_names || []))],
      extracted_amounts: [...new Set(photosResult.rows.flatMap(p => p.extracted_amounts || []))]
    }
  }
  
  // Cache the context
  const cacheId = uuidv4()
  try {
    await db.query(`
      INSERT INTO case_context_cache (id, case_id, context_data, last_updated)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (case_id) DO UPDATE SET 
        context_data = $3, 
        last_updated = $4
    `, [cacheId, caseId, JSON.stringify(context), new Date().toISOString()])
  } catch (error) {
    console.error('Cache error:', error)
    // Continue without caching if there's an error
  }
  
  return context
}

// Create smart document summary for cost optimization
function createDocumentSummary(photos) {
  if (photos.length === 0) return "Нет загруженных документов"
  
  const processedPhotos = photos.filter(p => p.raw_text)
  if (processedPhotos.length === 0) return "Документы загружены, но OCR еще не завершен"
  
  // Group documents by type
  const documentTypes = {}
  processedPhotos.forEach(photo => {
    const name = photo.original_name.toLowerCase()
    let type = "Документ"
    
    if (name.includes('повестка') || name.includes('судебн')) type = "Судебные документы"
    else if (name.includes('справка') || name.includes('доход')) type = "Справки о доходах"
    else if (name.includes('паспорт') || name.includes('удостоверение')) type = "Удостоверения личности"
    else if (name.includes('договор') || name.includes('соглашение')) type = "Договоры"
    else if (name.includes('свидетельство') || name.includes('свидетель')) type = "Свидетельства"
    
    if (!documentTypes[type]) documentTypes[type] = []
    documentTypes[type].push(photo)
  })
  
  // Create summary
  let summary = `Загружено ${photos.length} документов (${processedPhotos.length} обработано):\n`
  
  Object.entries(documentTypes).forEach(([type, docs]) => {
    summary += `\n${type} (${docs.length} шт.):\n`
    docs.forEach((doc, index) => {
      const keyInfo = extractKeyInfo(doc.raw_text)
      summary += `  ${index + 1}. ${doc.original_name} - ${keyInfo}\n`
    })
  })
  
  return summary
}

// Extract key information from OCR text
function extractKeyInfo(text) {
  if (!text) return "Нет данных"
  
  const lines = text.split('\n').filter(line => line.trim())
  const keyLines = lines.slice(0, 3) // First 3 lines usually contain key info
  return keyLines.join(' | ')
}

// AI Chat with context and session management
async function processAIChat(message, caseId, sessionId, db) {
  try {
    if (!caseId) {
      return { success: false, error: 'Case ID is required for AI chat' }
    }
    
    // Get case context
    const context = await getCaseContext(caseId, db)
    
    // Get recent chat history (last 10 messages)
    const historyResult = await db.query(`
      SELECT message_type, message_text, created_at
      FROM ai_chat_messages 
      WHERE session_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [sessionId])

    const history = historyResult.rows.reverse()

    // Create smart document summary
    const documentSummary = createDocumentSummary(context.photos)

    // Build context for caching (static part)
    const staticContext = `
    Ты - ИИ-ассистент адвоката. У тебя есть информация о деле:

    ДЕЛО:
    - Название: ${context.case.title}
    - Клиент: ${context.case.client_name}
    - Описание: ${context.case.description}
    - Тип: ${context.case.case_type}
    - Приоритет: ${context.case.priority}
    - Номер дела: ${context.case.case_number}

    ДОКУМЕНТЫ (${context.photos.length} шт.):
    ${context.photos.map((photo, index) => `
    ${index + 1}. ${photo.original_name}
       - Статус OCR: ${photo.raw_text ? 'Обработан' : 'Не обработан'}
       ${photo.raw_text ? `- Текст: ${photo.raw_text.substring(0, 200)}...` : ''}
       ${photo.extracted_dates && photo.extracted_dates.length > 0 ? `- Даты: ${photo.extracted_dates.join(', ')}` : ''}
       ${photo.extracted_numbers && photo.extracted_numbers.length > 0 ? `- Номера: ${photo.extracted_numbers.join(', ')}` : ''}
       ${photo.extracted_names && photo.extracted_names.length > 0 ? `- Имена: ${photo.extracted_names.join(', ')}` : ''}
       ${photo.extracted_amounts && photo.extracted_amounts.length > 0 ? `- Суммы: ${photo.extracted_amounts.join(', ')}` : ''}
    `).join('')}

    ИЗВЛЕЧЕННЫЕ ДАННЫЕ:
    - Даты: ${context.summary.extracted_dates.join(', ') || 'Не найдены'}
    - Номера: ${context.summary.extracted_numbers.join(', ') || 'Не найдены'}
    - Имена: ${context.summary.extracted_names.join(', ') || 'Не найдены'}
    - Суммы: ${context.summary.extracted_amounts.join(', ') || 'Не найдены'}
    `

    // Build dynamic prompt (changes with each message)
    const dynamicPrompt = `
    ${history.length > 0 ? `
    ИСТОРИЯ ДИАЛОГА:
    ${history.map(msg => `${msg.message_type}: ${msg.message_text}`).join('\n')}
    ` : ''}
    
    ВОПРОС ПОЛЬЗОВАТЕЛЯ: ${message}
    
    Ответь как профессиональный адвокат, используя всю доступную информацию.
    Будь кратким, но информативным. Если нужно больше деталей, спроси уточняющие вопросы.
    `

    // Debug: Log context information
    console.log(`AI Chat Context for case ${caseId}:`)
    console.log(`- Photos count: ${context.photos.length}`)
    console.log(`- Processed photos: ${context.photos.filter(p => p.raw_text).length}`)
    console.log(`- Extracted dates: ${context.summary.extracted_dates.length}`)
    console.log(`- Extracted names: ${context.summary.extracted_names.length}`)

    // Generate response using standard API
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "Ты - профессиональный ИИ-ассистент адвоката. Ты помогаешь анализировать дела, документы и давать юридические советы. Используй всю доступную информацию о деле, включая загруженные документы и их OCR результаты. Будь конкретным и полезным в своих ответах."
    })
    
    const result = await model.generateContent(staticContext + '\n\n' + dynamicPrompt)
    const response = await result.response
    const aiResponse = response.text()
    
    return {
      success: true,
      response: aiResponse,
      context_used: {
        photos_count: context.summary.total_photos,
        processed_photos: context.summary.processed_photos,
        extracted_data: context.summary
      }
    }
  } catch (error) {
    console.error('AI Chat Error:', error)
    return { success: false, error: error.message }
  }
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

        try {
          const db = await connectToPostgres()
          
          // Test connection
          await db.query('SELECT 1')

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ 
        message: "Legal Practice API Active (Optimized with Sessions)",
        features: [
          "Case management with priorities",
          "Photo upload with OCR via Gemini",
          "AI chat with session memory",
          "Context caching for efficiency",
          "PostgreSQL database"
        ]
      }))
    }

    // Cases endpoints
    if (route === '/cases' && method === 'GET') {
      const result = await db.query(`
        SELECT * FROM cases 
        WHERE status != 'archived' 
        ORDER BY created_at DESC 
        LIMIT 100
      `)
      
      return handleCORS(NextResponse.json(result.rows))
    }

    // Archived cases endpoint
    if (route === '/cases/archived' && method === 'GET') {
      const result = await db.query(`
        SELECT * FROM cases 
        WHERE status = 'archived' 
        ORDER BY created_at DESC 
        LIMIT 100
      `)
      
      return handleCORS(NextResponse.json(result.rows))
    }

    if (route === '/cases' && method === 'POST') {
      const body = await request.json()
      
      if (!body.title || !body.client_name) {
        return handleCORS(NextResponse.json(
          { error: "title and client_name are required" }, 
          { status: 400 }
        ))
      }

      const newCase = {
        id: uuidv4(),
        case_number: `CASE-${Date.now()}`,
        title: body.title,
        client_name: body.client_name,
        description: body.description || '',
        case_type: body.case_type || '',
        priority: body.priority || 'medium',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const result = await db.query(`
        INSERT INTO cases (id, case_number, title, client_name, description, case_type, priority, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        newCase.id, newCase.case_number, newCase.title, newCase.client_name,
        newCase.description, newCase.case_type, newCase.priority, newCase.status,
        newCase.created_at, newCase.updated_at
      ])
      
      return handleCORS(NextResponse.json(result.rows[0]))
    }

          // Get case by ID with full context
          if (route.match(/^\/cases\/[^\/]+$/) && method === 'GET') {
            const caseId = route.split('/')[2]
            
            if (!caseId) {
              return handleCORS(NextResponse.json({ error: 'Case ID is required' }, { status: 400 }))
            }
            
            try {
              const context = await getCaseContext(caseId, db)
              return handleCORS(NextResponse.json(context))
            } catch (error) {
              return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
            }
          }

          // Update case
          if (route.match(/^\/cases\/[^\/]+$/) && method === 'PUT') {
            const caseId = route.split('/')[2]
            const body = await request.json()
            
            if (!caseId) {
              return handleCORS(NextResponse.json({ error: 'Case ID is required' }, { status: 400 }))
            }

            if (!body.title || !body.client_name) {
              return handleCORS(NextResponse.json(
                { error: "title and client_name are required" }, 
                { status: 400 }
              ))
            }

            try {
              const result = await db.query(`
                UPDATE cases 
                SET title = $1, client_name = $2, description = $3, case_type = $4, 
                    priority = $5, status = $6, updated_at = $7
                WHERE id = $8
                RETURNING *
              `, [
                body.title, body.client_name, body.description || '', 
                body.case_type || '', body.priority || 'medium', 
                body.status || 'active', new Date().toISOString(), caseId
              ])
              
              if (result.rows.length === 0) {
                return handleCORS(NextResponse.json({ error: 'Case not found' }, { status: 404 }))
              }
              
              // Clear context cache
              await clearCaseCache(caseId, db)
              
              return handleCORS(NextResponse.json(result.rows[0]))
            } catch (error) {
              console.error('Update case error:', error)
              return handleCORS(NextResponse.json(
                { error: "Update failed: " + error.message }, 
                { status: 500 }
              ))
            }
          }

          // Archive case
          if (route.match(/^\/cases\/[^\/]+\/archive$/) && method === 'POST') {
            const caseId = route.split('/')[2]
            
            if (!caseId) {
              return handleCORS(NextResponse.json({ error: 'Case ID is required' }, { status: 400 }))
            }

            try {
              const result = await db.query(`
                UPDATE cases 
                SET status = 'archived', updated_at = $1
                WHERE id = $2
                RETURNING *
              `, [new Date().toISOString(), caseId])
              
              if (result.rows.length === 0) {
                return handleCORS(NextResponse.json({ error: 'Case not found' }, { status: 404 }))
              }
              
              // Clear context cache
              await clearCaseCache(caseId, db)
              
              return handleCORS(NextResponse.json({ success: true, case: result.rows[0] }))
            } catch (error) {
              console.error('Archive case error:', error)
              return handleCORS(NextResponse.json(
                { error: "Archive failed: " + error.message }, 
                { status: 500 }
              ))
            }
          }

          // Restore case from archive
          if (route.match(/^\/cases\/[^\/]+\/restore$/) && method === 'POST') {
            const caseId = route.split('/')[2]
            
            if (!caseId) {
              return handleCORS(NextResponse.json({ error: 'Case ID is required' }, { status: 400 }))
            }

            try {
              const result = await db.query(`
                UPDATE cases 
                SET status = 'active', updated_at = $1
                WHERE id = $2 AND status = 'archived'
                RETURNING *
              `, [new Date().toISOString(), caseId])
              
              if (result.rows.length === 0) {
                return handleCORS(NextResponse.json({ error: 'Case not found or not archived' }, { status: 404 }))
              }
              
              // Clear context cache
              await clearCaseCache(caseId, db)
              
              return handleCORS(NextResponse.json({ success: true, case: result.rows[0] }))
            } catch (error) {
              console.error('Restore case error:', error)
              return handleCORS(NextResponse.json(
                { error: "Restore failed: " + error.message }, 
                { status: 500 }
              ))
            }
          }

          // Delete case (permanent deletion with CASCADE)
          if (route.match(/^\/cases\/[^\/]+$/) && method === 'DELETE') {
            const caseId = route.split('/')[2]
            
            if (!caseId) {
              return handleCORS(NextResponse.json({ error: 'Case ID is required' }, { status: 400 }))
            }

            try {
              // Delete case (CASCADE will delete all related data)
              const result = await db.query(`
                DELETE FROM cases 
                WHERE id = $1
                RETURNING id
              `, [caseId])
              
              if (result.rows.length === 0) {
                return handleCORS(NextResponse.json({ error: 'Case not found' }, { status: 404 }))
              }
              
              return handleCORS(NextResponse.json({ success: true }))
            } catch (error) {
              console.error('Delete case error:', error)
              return handleCORS(NextResponse.json(
                { error: "Delete failed: " + error.message }, 
                { status: 500 }
              ))
            }
          }

    // Photo upload endpoint
    if (route === '/photos/upload' && method === 'POST') {
      try {
        const formData = await request.formData()
        const file = formData.get('file')
        const caseId = formData.get('caseId')
        
        if (!file || !caseId) {
          return handleCORS(NextResponse.json(
            { error: "File and caseId are required" }, 
            { status: 400 }
          ))
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const photoId = uuidv4()
        const fileName = `${photoId}-${file.name}`

        const orderResult = await db.query(`
          SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
          FROM case_photos WHERE case_id = $1
        `, [caseId])

        const photoDoc = {
          id: photoId,
          case_id: caseId,
          file_name: fileName,
          original_name: file.name,
          file_type: file.type,
          file_size: buffer.length,
          file_path: `/uploads/${fileName}`,
          display_order: orderResult.rows[0].next_order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const result = await db.query(`
          INSERT INTO case_photos (id, case_id, file_name, original_name, file_type, file_size, file_path, display_order, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [
          photoDoc.id, photoDoc.case_id, photoDoc.file_name, photoDoc.original_name,
          photoDoc.file_type, photoDoc.file_size, photoDoc.file_path, photoDoc.display_order,
          photoDoc.created_at, photoDoc.updated_at
        ])

        // Start OCR processing in background
        processPhotoOCR(photoId, caseId, buffer, db)

                // Clear context cache
                await clearCaseCache(caseId, db)

        return handleCORS(NextResponse.json({ 
          success: true, 
          photoId: photoId,
          message: "Photo uploaded, OCR processing started with Gemini 2.5 Flash" 
        }))

      } catch (error) {
        console.error('Upload error:', error)
        return handleCORS(NextResponse.json(
          { error: "Upload failed: " + error.message }, 
          { status: 500 }
        ))
      }
    }

    // OCR status check endpoint
    if (route.match(/^\/photos\/[^\/]+\/ocr-status$/) && method === 'GET') {
      const photoId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT * FROM photo_ocr_results WHERE photo_id = $1
      `, [photoId])
      
      if (result.rows.length === 0) {
        return handleCORS(NextResponse.json({
          status: 'pending',
          progress: 0,
          extractedText: null
        }))
      }
      
      const ocr = result.rows[0]
      return handleCORS(NextResponse.json({
        status: ocr.processing_status,
        progress: ocr.processing_status === 'completed' ? 100 : 
                 ocr.processing_status === 'processing' ? 50 : 0,
        extractedText: ocr.raw_text,
        extractedDates: ocr.extracted_dates,
        extractedNumbers: ocr.extracted_numbers,
        extractedNames: ocr.extracted_names,
        extractedAmounts: ocr.extracted_amounts,
        confidence: ocr.confidence_score
      }))
    }

    // Add comment to photo
    if (route.match(/^\/photos\/[^\/]+\/comments$/) && method === 'POST') {
      const photoId = route.split('/')[2]
      const body = await request.json()
      
      if (!body.comment_text) {
        return handleCORS(NextResponse.json(
          { error: "comment_text is required" }, 
          { status: 400 }
        ))
      }

      const photoResult = await db.query(`
        SELECT case_id FROM case_photos WHERE id = $1
      `, [photoId])
      
      if (photoResult.rows.length === 0) {
        return handleCORS(NextResponse.json({ error: "Photo not found" }, { status: 404 }))
      }

      const commentId = uuidv4()
      const result = await db.query(`
        INSERT INTO photo_comments (id, photo_id, case_id, comment_text, author_name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        commentId, photoId, photoResult.rows[0].case_id, body.comment_text,
        body.author_name || 'Адвокат', new Date().toISOString(), new Date().toISOString()
      ])
      
      return handleCORS(NextResponse.json(result.rows[0]))
    }

    // AI Chat endpoint with session management
    if (route.match(/^\/cases\/[^\/]+\/chat$/) && method === 'POST') {
      const caseId = route.split('/')[2]
      const body = await request.json()
      
      if (!body.message) {
        return handleCORS(NextResponse.json(
          { error: "message is required" }, 
          { status: 400 }
        ))
      }

      // Get or create active session
      const sessionId = await getOrCreateActiveSession(caseId, db)

      // Process AI chat
      const aiResponse = await processAIChat(body.message, caseId, sessionId, db)

      if (!aiResponse.success) {
        return handleCORS(NextResponse.json(
          { error: "AI chat failed: " + aiResponse.error }, 
          { status: 500 }
        ))
      }

      // Save user message
      await db.query(`
        INSERT INTO ai_chat_messages (id, session_id, case_id, message_type, message_text, context_used, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(), sessionId, caseId, 'user', body.message, 
        JSON.stringify(aiResponse.context_used), new Date().toISOString()
      ])

      // Save AI response
      await db.query(`
        INSERT INTO ai_chat_messages (id, session_id, case_id, message_type, message_text, context_used, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(), sessionId, caseId, 'ai', aiResponse.response, 
        JSON.stringify(aiResponse.context_used), new Date().toISOString()
      ])

      return handleCORS(NextResponse.json({
        success: true,
        response: aiResponse.response,
        session_id: sessionId,
        context_used: aiResponse.context_used
      }))
    }

    // Get chat history for session
    if (route.match(/^\/cases\/[^\/]+\/chat$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT 
          acm.*,
          acs.session_name
        FROM ai_chat_messages acm
        JOIN ai_chat_sessions acs ON acm.session_id = acs.id
        WHERE acm.case_id = $1 
        ORDER BY acm.created_at ASC
      `, [caseId])
      
      return handleCORS(NextResponse.json(result.rows))
    }

    // Get active sessions for case
    if (route.match(/^\/cases\/[^\/]+\/sessions$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT * FROM ai_chat_sessions 
        WHERE case_id = $1 
        ORDER BY created_at DESC
      `, [caseId])
      
      return handleCORS(NextResponse.json(result.rows))
    }

          // Photo view endpoint - return actual image data
          if (route.match(/^\/photos\/[^\/]+\/view$/) && method === 'GET') {
            const photoId = route.split('/')[2]
            
            const result = await db.query(`
              SELECT * FROM case_photos WHERE id = $1
            `, [photoId])
            
            if (result.rows.length === 0) {
              return handleCORS(NextResponse.json({ error: "Photo not found" }, { status: 404 }))
            }
            
            const photo = result.rows[0]
            
            // For now, create a placeholder image with file info
            // In production, you would serve the actual file from storage
            const svgContent = `
              <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
                  </linearGradient>
                </defs>
                <rect width="400" height="300" fill="url(#grad)"/>
                <rect x="50" y="50" width="300" height="200" fill="white" rx="10"/>
                <text x="200" y="120" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#374151">
                  ${photo.original_name}
                </text>
                <text x="200" y="140" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
                  ${(photo.file_size / 1024).toFixed(1)} KB
                </text>
                <text x="200" y="160" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
                  ${new Date(photo.created_at).toLocaleDateString('ru-RU')}
                </text>
                <circle cx="200" cy="200" r="20" fill="#3b82f6"/>
                <text x="200" y="205" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="white">📷</text>
              </svg>
            `
            
            const svgBuffer = Buffer.from(svgContent)
            
            return new NextResponse(svgBuffer, {
              headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true'
              }
            })
          }

    // Get detailed OCR text for specific photo
    if (route.match(/^\/photos\/[^\/]+\/ocr-details$/) && method === 'GET') {
      const photoId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT 
          cp.*,
          ocr.raw_text,
          ocr.extracted_dates,
          ocr.extracted_numbers,
          ocr.extracted_names,
          ocr.extracted_amounts,
          ocr.confidence_score
        FROM case_photos cp
        LEFT JOIN photo_ocr_results ocr ON cp.id = ocr.photo_id
        WHERE cp.id = $1
      `, [photoId])
      
      if (result.rows.length === 0) {
        return handleCORS(NextResponse.json({ error: "Photo not found" }, { status: 404 }))
      }
      
      const photo = result.rows[0]
      return handleCORS(NextResponse.json({
        id: photo.id,
        original_name: photo.original_name,
        raw_text: photo.raw_text,
        extracted_dates: photo.extracted_dates,
        extracted_numbers: photo.extracted_numbers,
        extracted_names: photo.extracted_names,
        extracted_amounts: photo.extracted_amounts,
        confidence_score: photo.confidence_score,
        processing_status: photo.processing_status
      }))
    }

    // Additional files endpoints
    if (route === '/additional-files/upload' && method === 'POST') {
      try {
        const formData = await request.formData()
        const file = formData.get('file')
        const caseId = formData.get('caseId')
        const description = formData.get('description') || ''
        const isImportant = formData.get('isImportant') === 'true'
        
        if (!file || !caseId) {
          return handleCORS(NextResponse.json(
            { error: "File and caseId are required" }, 
            { status: 400 }
          ))
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const fileId = uuidv4()
        const fileName = `${fileId}-${file.name}`

        const fileDoc = {
          id: fileId,
          case_id: caseId,
          file_name: fileName,
          original_name: file.name,
          file_type: file.type,
          file_size: buffer.length,
          file_path: `/uploads/additional/${fileName}`,
          description: description,
          is_important: isImportant,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const result = await db.query(`
          INSERT INTO case_additional_files (id, case_id, file_name, original_name, file_type, file_size, file_path, description, is_important, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `, [
          fileDoc.id, fileDoc.case_id, fileDoc.file_name, fileDoc.original_name,
          fileDoc.file_type, fileDoc.file_size, fileDoc.file_path, fileDoc.description,
          fileDoc.is_important, fileDoc.created_at, fileDoc.updated_at
        ])

                // Clear context cache
                await clearCaseCache(caseId, db)

        return handleCORS(NextResponse.json({ 
          success: true, 
          fileId: fileId,
          message: "Additional file uploaded successfully" 
        }))

      } catch (error) {
        console.error('Additional file upload error:', error)
        return handleCORS(NextResponse.json(
          { error: "Upload failed: " + error.message }, 
          { status: 500 }
        ))
      }
    }

    // Get additional files for a case
    if (route.match(/^\/cases\/[^\/]+\/additional-files$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT * FROM case_additional_files 
        WHERE case_id = $1 
        ORDER BY created_at DESC
      `, [caseId])
      
      return handleCORS(NextResponse.json(result.rows))
    }

    // Delete additional file
    if (route.match(/^\/additional-files\/[^\/]+$/) && method === 'DELETE') {
      const fileId = route.split('/')[2]
      
      const result = await db.query(`
        DELETE FROM case_additional_files 
        WHERE id = $1 
        RETURNING case_id
      `, [fileId])
      
      if (result.rows.length === 0) {
        return handleCORS(NextResponse.json({ error: "File not found" }, { status: 404 }))
      }
      
      // Invalidate context cache
      await db.query(`
        DELETE FROM case_context_cache WHERE case_id = $1
      `, [result.rows[0].case_id])
      
      return handleCORS(NextResponse.json({ success: true }))
    }

    // Generate PDF with all OCR transcriptions for a case
    if (route.match(/^\/cases\/[^\/]+\/pdf$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      try {
        // Get case details
        const caseResult = await db.query(`
          SELECT * FROM cases WHERE id = $1
        `, [caseId])
        
        if (caseResult.rows.length === 0) {
          return handleCORS(NextResponse.json({ error: "Case not found" }, { status: 404 }))
        }
        
        const case_ = caseResult.rows[0]
        
        // Get all photos with OCR results
        const photosResult = await db.query(`
          SELECT 
            cp.*,
            ocr.raw_text,
            ocr.extracted_dates,
            ocr.extracted_numbers,
            ocr.extracted_names,
            ocr.extracted_amounts,
            ocr.confidence_score
          FROM case_photos cp
          LEFT JOIN photo_ocr_results ocr ON cp.id = ocr.photo_id
          WHERE cp.case_id = $1 AND ocr.raw_text IS NOT NULL
          ORDER BY cp.display_order
        `, [caseId])
        
        if (photosResult.rows.length === 0) {
          return handleCORS(NextResponse.json({ error: "No OCR results found for this case" }, { status: 404 }))
        }
        
        // Generate PDF using jspdf (more reliable in Next.js)
        const { jsPDF } = require('jspdf')
        const doc = new jsPDF()
        
        // Add title page
        doc.setFontSize(20)
        doc.text(`Дело: ${case_.title}`, 20, 30)
        doc.setFontSize(16)
        doc.text(`Клиент: ${case_.client_name}`, 20, 50)
        doc.setFontSize(14)
        doc.text(`Номер дела: ${case_.case_number}`, 20, 70)
        doc.setFontSize(12)
        doc.text(`Дата создания: ${new Date(case_.created_at).toLocaleDateString('ru-RU')}`, 20, 90)
        doc.text(`Тип дела: ${case_.case_type}`, 20, 105)
        doc.text(`Приоритет: ${case_.priority}`, 20, 120)
        
        if (case_.description) {
          doc.text(`Описание:`, 20, 140)
          const splitDescription = doc.splitTextToSize(case_.description, 170)
          doc.text(splitDescription, 20, 155)
        }
        
        // Add OCR transcriptions
        let yPosition = 180
        doc.setFontSize(16)
        doc.text('Расшифровки документов', 20, yPosition)
        yPosition += 20
        
        photosResult.rows.forEach((photo, index) => {
          // Check if we need a new page
          if (yPosition > 250) {
            doc.addPage()
            yPosition = 30
          }
          
          // Photo header
          doc.setFontSize(14)
          doc.text(`Документ ${index + 1}: ${photo.original_name}`, 20, yPosition)
          yPosition += 15
          
          doc.setFontSize(10)
          doc.text(`Загружен: ${new Date(photo.created_at).toLocaleDateString('ru-RU')}`, 20, yPosition)
          yPosition += 10
          doc.text(`Уверенность OCR: ${(photo.confidence_score * 100).toFixed(1)}%`, 20, yPosition)
          yPosition += 15
          
          // OCR text
          doc.setFontSize(12)
          doc.text('Текст документа:', 20, yPosition)
          yPosition += 10
          
          doc.setFontSize(10)
          const splitText = doc.splitTextToSize(photo.raw_text, 170)
          doc.text(splitText, 20, yPosition)
          yPosition += splitText.length * 5 + 10
          
          // Extracted data
          if (photo.extracted_dates && photo.extracted_dates.length > 0) {
            doc.text(`Извлеченные даты: ${photo.extracted_dates.join(', ')}`, 20, yPosition)
            yPosition += 10
          }
          
          if (photo.extracted_numbers && photo.extracted_numbers.length > 0) {
            doc.text(`Извлеченные номера: ${photo.extracted_numbers.join(', ')}`, 20, yPosition)
            yPosition += 10
          }
          
          if (photo.extracted_names && photo.extracted_names.length > 0) {
            doc.text(`Извлеченные имена: ${photo.extracted_names.join(', ')}`, 20, yPosition)
            yPosition += 10
          }
          
          if (photo.extracted_amounts && photo.extracted_amounts.length > 0) {
            doc.text(`Извлеченные суммы: ${photo.extracted_amounts.join(', ')}`, 20, yPosition)
            yPosition += 10
          }
          
          yPosition += 20 // Space between documents
        })
        
        // Generate PDF buffer
        const pdfBuffer = doc.output('arraybuffer')
        
        // Set response headers for PDF download
        const response = new NextResponse(pdfBuffer)
        response.headers.set('Content-Type', 'application/pdf')
        response.headers.set('Content-Disposition', `attachment; filename="case_${case_.case_number}_transcriptions.pdf"`)
        
        return handleCORS(response)
        
      } catch (error) {
        console.error('PDF generation error:', error)
        return handleCORS(NextResponse.json(
          { error: "PDF generation failed: " + error.message }, 
          { status: 500 }
        ))
      }
    }

    // Route not found
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ))

        } catch (error) {
          console.error('API Error:', error)
          
          // Handle database connection errors
          if (error.message.includes('connection error') || error.message.includes('not queryable')) {
            console.error('Database connection lost, attempting to reconnect...')
            // Reset pool to force reconnection
            if (pool) {
              try {
                await pool.end()
                pool = null
              } catch (e) {
                console.error('Error closing pool:', e)
              }
            }
            
            return handleCORS(NextResponse.json(
              { error: "Database connection error. Please try again." }, 
              { status: 503 }
            ))
          }
          
          return handleCORS(NextResponse.json(
            { error: "Internal server error: " + error.message }, 
            { status: 500 }
          ))
        }
}

// Background OCR processing function
async function processPhotoOCR(photoId, caseId, buffer, db) {
  try {
    console.log(`Starting OCR processing for photo ${photoId} with Gemini 2.5 Flash`)
    
    // Check if OCR result already exists
    const existingResult = await db.query(`
      SELECT id FROM photo_ocr_results WHERE photo_id = $1
    `, [photoId])
    
    if (existingResult.rows.length === 0) {
      await db.query(`
        INSERT INTO photo_ocr_results (id, photo_id, case_id, processing_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [uuidv4(), photoId, caseId, 'processing', new Date().toISOString(), new Date().toISOString()])
    } else {
      await db.query(`
        UPDATE photo_ocr_results 
        SET processing_status = $1, updated_at = $2
        WHERE photo_id = $3
      `, ['processing', new Date().toISOString(), photoId])
    }
    
    const ocrResult = await processOCR(buffer)

    if (ocrResult.success) {
      const extractedDates = extractDatesFromText(ocrResult.text)
      const extractedNumbers = extractNumbersFromText(ocrResult.text)
      const extractedNames = extractNamesFromText(ocrResult.text)
      const extractedAmounts = extractAmountsFromText(ocrResult.text)
      
      await db.query(`
        UPDATE photo_ocr_results 
        SET raw_text = $1, extracted_dates = $2, extracted_numbers = $3, 
            extracted_names = $4, extracted_amounts = $5, confidence_score = $6,
            processing_status = 'completed', updated_at = $7
        WHERE photo_id = $8
      `, [
        ocrResult.text, 
        extractedDates, 
        extractedNumbers,
        extractedNames,
        extractedAmounts,
        ocrResult.confidence,
        new Date().toISOString(),
        photoId
      ])
      
                // Clear context cache
                await clearCaseCache(caseId, db)
      
      console.log(`OCR completed for photo ${photoId}`)
    } else {
      await db.query(`
        UPDATE photo_ocr_results 
        SET processing_status = 'failed', error_message = $1, updated_at = $2
        WHERE photo_id = $3
      `, [ocrResult.error, new Date().toISOString(), photoId])
      
      console.error(`OCR failed for photo ${photoId}:`, ocrResult.error)
    }
  } catch (error) {
    console.error('OCR processing error:', error)
    
    await db.query(`
      UPDATE photo_ocr_results 
      SET processing_status = 'failed', error_message = $1, updated_at = $2
      WHERE photo_id = $3
    `, [error.message, new Date().toISOString(), photoId])
  }
}

// Cache management functions
async function clearCaseCache(caseId, db) {
  try {
    // Clear cache from database
    await db.query(`
      DELETE FROM case_context_cache 
      WHERE case_id = $1
    `, [caseId])
    
    console.log(`Cleared cache for case: ${caseId}`)
  } catch (error) {
    console.error('Cache cleanup error:', error)
  }
}

// Helper functions for extracting structured data
function extractDatesFromText(text) {
  if (!text) return []
  
  const dateRegexes = [
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g
  ]
  
  const dates = []
  dateRegexes.forEach(regex => {
    let match
    while ((match = regex.exec(text)) !== null) {
      dates.push(match[0])
    }
  })
  
  return [...new Set(dates)]
}

function extractNumbersFromText(text) {
  if (!text) return []
  
  const numberRegexes = [
    /№\s*(\d+(?:[\/\-]\d+)*)/g,
    /дело\s*№?\s*(\d+(?:[\/\-]\d+)*)/gi
  ]

  const numbers = []
  numberRegexes.forEach(regex => {
    let match
    while ((match = regex.exec(text)) !== null) {
      numbers.push(match[0])
    }
  })

  return [...new Set(numbers)]
}

function extractNamesFromText(text) {
  if (!text) return []
  
  const nameRegex = /[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/g
  const names = []
  let match
  while ((match = nameRegex.exec(text)) !== null) {
    names.push(match[0])
  }
  return [...new Set(names)]
}

function extractAmountsFromText(text) {
  if (!text) return []
  
  const amountRegex = /(\d+(?:\s\d{3})*(?:[,\.]\d{2})?)\s*(?:руб|₽|рублей)/gi
  const amounts = []
  let match
  while ((match = amountRegex.exec(text)) !== null) {
    amounts.push(match[0])
  }
  return [...new Set(amounts)]
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
