import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

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
    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "Legal Practice API Active (Supabase)" }))
    }

    // Cases endpoints
    if (route === '/cases' && method === 'GET') {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) {
        throw new Error(error.message)
      }
      
      return handleCORS(NextResponse.json(cases || []))
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

      const { data, error } = await supabase
        .from('cases')
        .insert([newCase])
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return handleCORS(NextResponse.json(data))
    }

    // Get case by ID
    if (route.match(/^\/cases\/[^\/]+$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const { data: case_, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single()
      
      if (error || !case_) {
        return handleCORS(NextResponse.json({ error: "Case not found" }, { status: 404 }))
      }
      
      return handleCORS(NextResponse.json(case_))
    }

    // Get documents for a case
    if (route.match(/^\/cases\/[^\/]+\/documents$/) && method === 'GET') {
      const caseId = route.split('/')[2]
      
      const { data: documents, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
      
      if (error) {
        throw new Error(error.message)
      }
      
      return handleCORS(NextResponse.json(documents || []))
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

        const { data, error } = await supabase
          .from('case_documents')
          .insert([documentDoc])
          .select()
          .single()

        if (error) {
          throw new Error(error.message)
        }

        // Start OCR processing in background
        processDocumentOCR(documentId, buffer)

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
      
      const { data: document, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('id', documentId)
        .single()
      
      if (error || !document) {
        return handleCORS(NextResponse.json({ error: "Document not found" }, { status: 404 }))
      }
      
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
async function processDocumentOCR(documentId, buffer) {
  try {
    // Update status to processing
    await supabase
      .from('case_documents')
      .update({ 
        transcription_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)

    // Process with Google Vision API
    const ocrResult = await processOCR(buffer)

    if (ocrResult.success) {
      // Extract dates and numbers using regex
      const extractedDates = extractDatesFromText(ocrResult.text)
      const extractedNumbers = extractNumbersFromText(ocrResult.text)

      await supabase
        .from('case_documents')
        .update({
          transcription: ocrResult.text,
          transcription_status: 'completed',
          extracted_dates: extractedDates,
          extracted_numbers: extractedNumbers,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
    } else {
      await supabase
        .from('case_documents')
        .update({
          transcription_status: 'failed',
          transcription_error: ocrResult.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
    }
  } catch (error) {
    console.error('OCR processing error:', error)
    
    await supabase
      .from('case_documents')
      .update({
        transcription_status: 'failed',
        transcription_error: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
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
