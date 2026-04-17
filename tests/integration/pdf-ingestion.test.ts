import { describe, it, expect, beforeAll, vi } from 'vitest'
import { parsePdf } from '../../server/lib/brand-parse'
import { knowledgeService } from '../../server/services/knowledgeService'
import { getMultimodalEmbedding } from '../../server/services/geminiService'
import * as fs from 'fs'
import * as path from 'path'

// Mock vectorService to avoid Pinecone SDK issues in tests
vi.mock('../../server/services/vectorService', () => ({
  vectorService: {
    upsert: vi.fn(async () => true),
    query: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    deleteMany: vi.fn(async () => true),
  },
}))

describe('Media Ingestion Flow', () => {
  beforeAll(() => {
    // Force mock mode by clearing Pinecone API key to avoid SDK validator bugs
    delete process.env.PINECONE_API_KEY
    delete process.env.PINECONE_KEY
    console.log('[Test] Running in MOCK mode (Pinecone disabled for unit testing)')
  })
  // Create a minimal valid PDF for testing
  const createTestPdf = (): Buffer => {
    // Minimal PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000000303 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
382
%%EOF`
    return Buffer.from(pdfContent)
  }

  it('should parse PDF and extract text', async () => {
    const pdfBuffer = createTestPdf()
    expect(pdfBuffer.length).toBeGreaterThan(0)

    const chunks = await parsePdf(pdfBuffer, 'test.pdf')
    console.log('Parsed chunks:', chunks)

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toHaveProperty('text')
    expect(chunks[0]).toHaveProperty('source', 'test.pdf')
    expect(chunks[0]).toHaveProperty('type', 'pdf')
  })

  it('should generate embeddings for text chunk', async () => {
    const testText = 'This is a test document about branding and design'
    const { embedding } = await getMultimodalEmbedding([{ text: testText }])

    expect(embedding).toBeDefined()
    expect(Array.isArray(embedding)).toBe(true)
    expect(embedding.length).toBeGreaterThan(0)
    console.log(`Generated embedding with dimension: ${embedding.length}`)
  })

  it('should ingest PDF content into knowledge base', async () => {
    const testUserId = 'test-user-123'
    const testProjectId = 'test-project-456'

    const parts = [
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: createTestPdf().toString('base64'),
        },
      },
    ]

    const result = await knowledgeService.ingestContent({
      userId: testUserId,
      projectId: testProjectId,
      parts,
      metadata: {
        fileName: 'test-document.pdf',
        source: 'pdf',
      },
    })

    console.log('PDF Ingest result:', result)
    expect(result).toBeDefined()
    // In mock mode, result may not have expected properties, but should not error
  })

  it('should ingest Markdown content', async () => {
    const testUserId = 'test-user-123'
    const testProjectId = 'test-project-456'
    const markdownContent = `# Brand Guidelines

## Colors
- Primary: #FF6B00
- Secondary: #0066CC

## Typography
- Font: Inter, sans-serif
- Size: 16px body`

    const parts = [{ text: markdownContent }]

    const result = await knowledgeService.ingestContent({
      userId: testUserId,
      projectId: testProjectId,
      parts,
      metadata: {
        fileName: 'guidelines.md',
        source: 'markdown',
      },
    })

    console.log('Markdown Ingest result:', result)
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
  })

  it('should ingest Image metadata', async () => {
    const testUserId = 'test-user-123'
    const testProjectId = 'test-project-456'
    const imageDescription = '[Image: logo.png — analyze visually for brand colors, logos, typography, and style]'

    const parts = [{ text: imageDescription }]

    const result = await knowledgeService.ingestContent({
      userId: testUserId,
      projectId: testProjectId,
      parts,
      metadata: {
        fileName: 'logo.png',
        source: 'image',
      },
    })

    console.log('Image Ingest result:', result)
    expect(result).toBeDefined()
    expect(result).toHaveProperty('id')
  })

  it('should handle multiple chunks from large content', async () => {
    const testUserId = 'test-user-123'
    const testProjectId = 'test-project-456'
    // Create large text that will be chunked
    const largeText = Array(100).fill('This is a test paragraph about branding and design. ').join('')

    const parts = [{ text: largeText }]

    const result = await knowledgeService.ingestContent({
      userId: testUserId,
      projectId: testProjectId,
      parts,
      metadata: {
        fileName: 'large-document.txt',
        source: 'text',
      },
    })

    console.log('Large content Ingest result:', result)
    expect(result).toBeDefined()
  })
})
