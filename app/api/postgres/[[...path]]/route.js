import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// PostgreSQL connection
let pg = null
let client = null

async function connectToPostgres() {
  if (!pg) {
    pg = require('pg')
  }
  
  if (!client) {
    client = new pg.Client({
      connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
    })
    await client.connect()
  }
  
  return client
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

// OCR Processing with Google Vision API
async function processOCR(imageBuffer) {
  try {
    const vision = require('@google-cloud/vision').ImageAnnotatorClient
    const client = new vision({
      keyFilename: process.env.GOOGLE_CLOUD_KEY_PATH,
      apiKey: process.env.GOOGLE_VISION_API_KEY
    })

    const [result] = await client.textDetection({
      image: { content: imageBuffer }
    })

    const detections = result.textAnnotations
    if (detections && detections.length > 0) {
      return {
        success: true,
        text: detections[0].description,
        confidence: detections[0].confidence || 0.8
      }
    }

    return { success: false, error: 'No text detected' }
  } catch (error) {
    console.error('OCR Error:', error)
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

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "Legal Practice API Active (PostgreSQL)" }))
    }

    // Cases endpoints
    if (route === '/cases' && method === 'GET') {
      const result = await db.query(`
        SELECT * FROM cases 
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

    // Get case by ID
    if (route.match(/^\/cases\/[^\/]+$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT * FROM cases WHERE id = $1
      `, [caseId])
      
      if (result.rows.length === 0) {
        return handleCORS(NextResponse.json({ error: "Case not found" }, { status: 404 }))
      }
      
      return handleCORS(NextResponse.json(result.rows[0]))
    }

    // Get documents for a case
    if (route.match(/^\/cases\/[^\/]+\/documents$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT * FROM case_documents 
        WHERE case_id = $1 
        ORDER BY created_at DESC
      `, [caseId])
      
      return handleCORS(NextResponse.json(result.rows))
    }

    // Document upload endpoint
    if (route === '/documents/upload' && method === 'POST') {
      try {
        // Parse FormData manually
        const formData = await request.formData()
        const file = formData.get('file')
        const caseId = formData.get('caseId')
        
        if (!file || !caseId) {
          return handleCORS(NextResponse.json(
            { error: "File and caseId are required" }, 
            { status: 400 }
          ))
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Generate document ID
        const documentId = uuidv4()
        const fileName = `${documentId}-${file.name}`

        // Store document metadata
        const documentDoc = {
          id: documentId,
          case_id: caseId,
          file_name: fileName,
          original_name: file.name,
          file_type: file.type,
          file_size: buffer.length,
          transcription_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const result = await db.query(`
          INSERT INTO case_documents (id, case_id, file_name, original_name, file_type, file_size, transcription_status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          documentDoc.id, documentDoc.case_id, documentDoc.file_name, documentDoc.original_name,
          documentDoc.file_type, documentDoc.file_size, documentDoc.transcription_status,
          documentDoc.created_at, documentDoc.updated_at
        ])

        // Start OCR processing in background
        processDocumentOCR(documentId, buffer, db)

        return handleCORS(NextResponse.json({ 
          success: true, 
          documentId: documentId,
          message: "Document uploaded, OCR processing started" 
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
    if (route.match(/^\/documents\/[^\/]+\/ocr-status$/) && method === 'GET') {
      const documentId = route.split('/')[2]
      
      const result = await db.query(`
        SELECT * FROM case_documents WHERE id = $1
      `, [documentId])
      
      if (result.rows.length === 0) {
        return handleCORS(NextResponse.json({ error: "Document not found" }, { status: 404 }))
      }
      
      const document = result.rows[0]
      return handleCORS(NextResponse.json({
        status: document.transcription_status,
        progress: document.transcription_status === 'completed' ? 100 : 
                 document.transcription_status === 'processing' ? 50 : 0,
        extractedText: document.transcription
      }))
    }

    // Route not found
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: "Internal server error: " + error.message }, 
      { status: 500 }
    ))
  }
}

// Background OCR processing function
async function processDocumentOCR(documentId, buffer, db) {
  try {
    // Update status to processing
    await db.query(`
      UPDATE case_documents 
      SET transcription_status = 'processing', updated_at = $1 
      WHERE id = $2
    `, [new Date().toISOString(), documentId])

    // Process with Google Vision API
    const ocrResult = await processOCR(buffer)

    if (ocrResult.success) {
      // Extract dates and numbers using regex
      const extractedDates = extractDatesFromText(ocrResult.text)
      const extractedNumbers = extractNumbersFromText(ocrResult.text)

      await db.query(`
        UPDATE case_documents 
        SET transcription = $1, transcription_status = 'completed', 
            extracted_dates = $2, extracted_numbers = $3, updated_at = $4
        WHERE id = $5
      `, [
        ocrResult.text, 
        JSON.stringify(extractedDates), 
        JSON.stringify(extractedNumbers),
        new Date().toISOString(),
        documentId
      ])
    } else {
      await db.query(`
        UPDATE case_documents 
        SET transcription_status = 'failed', transcription_error = $1, updated_at = $2
        WHERE id = $3
      `, [ocrResult.error, new Date().toISOString(), documentId])
    }
  } catch (error) {
    console.error('OCR processing error:', error)
    
    await db.query(`
      UPDATE case_documents 
      SET transcription_status = 'failed', transcription_error = $1, updated_at = $2
      WHERE id = $3
    `, [error.message, new Date().toISOString(), documentId])
  }
}

// Helper functions for extracting structured data
function extractDatesFromText(text) {
  const dateRegexes = [
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,  // DD.MM.YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,  // DD/MM/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/g     // YYYY-MM-DD
  ]
  
  const dates = []
  dateRegexes.forEach(regex => {
    let match
    while ((match = regex.exec(text)) !== null) {
      dates.push(match[0])
    }
  })
  
  return [...new Set(dates)] // Remove duplicates
}

function extractNumbersFromText(text) {
  const numberRegexes = [
    /№\s*(\d+(?:[\/\-]\d+)*)/g,        // Document numbers
    /(\d+(?:\s\d{3})*(?:[,\.]\d{2})?)\s*(?:руб|₽)/gi, // Money amounts
    /дело\s*№?\s*(\d+(?:[\/\-]\d+)*)/gi // Case numbers
  ]
  
  const numbers = []
  numberRegexes.forEach(regex => {
    let match
    while ((match = regex.exec(text)) !== null) {
      numbers.push(match[0])
    }
  })
  
  return [...new Set(numbers)] // Remove duplicates
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
