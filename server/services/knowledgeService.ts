import { getMultimodalEmbedding, chatWithAIContext } from './geminiService.js';
import { vectorService, VectorMetadata } from './vectorService.js';
import { parsePdf } from '../lib/brand-parse.js';
import { v4 as uuidv4 } from 'uuid';
import { PDFDocument } from 'pdf-lib';

// Utility to split PDF into 5-page chunks
const splitPDF = async (pdfBuffer: Buffer, pageSize: number = 5): Promise<Buffer[]> => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const pdfChunks: Buffer[] = [];

  for (let i = 0; i < totalPages; i += pageSize) {
    const newDoc = await PDFDocument.create();
    const end = Math.min(i + pageSize, totalPages);
    const pageIndices = Array.from({ length: end - i }, (_, index) => i + index);
    const copiedPages = await newDoc.copyPages(pdfDoc, pageIndices);
    
    copiedPages.forEach(page => newDoc.addPage(page));
    pdfChunks.push(Buffer.from(await newDoc.save()));
  }
  return pdfChunks;
};

export const knowledgeService = {
  /**
   * Ingest content into the knowledge base
   */
  async ingestContent(params: {
    userId: string;
    projectId?: string;
    parts: any[]; // Gemini parts (text, image, etc.)
    metadata: Partial<VectorMetadata>;
  }) {
    const { userId, projectId, parts, metadata } = params;

    console.log(`[EliteRAG] ingestContent: userId=${userId}, projectId=${projectId}, partsCount=${parts.length}`);
    console.log(`[EliteRAG] Parts structure:`, JSON.stringify(parts.map(p => ({
      hasInlineData: !!p.inlineData,
      mimeType: p.inlineData?.mimeType,
      dataType: typeof p.inlineData?.data,
      dataLength: p.inlineData?.data?.length || 'N/A',
      hasText: !!p.text,
    })), null, 2));

    // 1. Detect PDF for text extraction + chunking
    const pdfPart = parts.find(p => p.inlineData?.mimeType === 'application/pdf');

    if (pdfPart) {
      console.log(`[KnowledgeService] PDF detectado: ${metadata.fileName || 'desconhecido'}`);
      const inputBuffer = Buffer.from(pdfPart.inlineData.data, 'base64');

      console.log(`[KnowledgeService] Tamanho do buffer: ${inputBuffer.length} bytes`);

      // Extract text from PDF
      const chunks = await parsePdf(inputBuffer, metadata.fileName);
      console.log(`[KnowledgeService] PDF parseado em ${chunks.length} chunks de texto.`);

      const results = [];

      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunk = chunks[i];
          console.log(`[KnowledgeService] Gerando embedding para chunk ${i+1}/${chunks.length}...`);

          // Generate embedding for the text chunk
          const { embedding } = await getMultimodalEmbedding([{
            text: chunk.text
          }]);

          if (!embedding || embedding.length === 0) {
            console.error(`[KnowledgeService] Embedding vazio para chunk ${i+1}. Pulando...`);
            continue;
          }

          const id = uuidv4();
          const chunkMetadata: VectorMetadata = {
            ...metadata,
            text: chunk.text.substring(0, 1000), // Store truncated text as metadata
            chunkIndex: i,
            totalChunks: chunks.length,
            processedAs: 'pdf_text_chunks',
            userId,
            projectId,
            timestamp: new Date().toISOString(),
          };

          console.log(`[KnowledgeService] Upserting to Pinecone: id=${id} (dim=${embedding.length})`);
          await vectorService.upsert(id, embedding, chunkMetadata);
          results.push(id);
        } catch (chunkError: any) {
          console.error(`[KnowledgeService] Erro no chunk ${i+1}:`, chunkError);
          throw new Error(`Erro ao processar chunk ${i+1}: ${chunkError.message}`);
        }
      }

      console.log(`[KnowledgeService] Ingestão PDF concluída: ${results.length} vetores.`);
      return { ids: results, processedAs: 'pdf_text_chunks', count: results.length };
    }

    console.log(`[EliteRAG] Tipo multimodal padrão/genérico.`);
    const { embedding } = await getMultimodalEmbedding(parts);
    const id = uuidv4();
    const fullMetadata: VectorMetadata = {
      ...metadata,
      userId,
      projectId,
      timestamp: new Date().toISOString(),
    };
    
    await vectorService.upsert(id, embedding, fullMetadata);
    return { id, metadata: fullMetadata, processedAs: 'multimodal_single' };
  },

  /**
   * Search knowledge base and return context
   */
  async getContext(query: string, userId: string, projectId?: string) {
    // 1. Generate query embedding
    const { embedding } = await getMultimodalEmbedding([{ text: query }]);
    
    // 2. Query Pinecone
    // We can filter by userId to ensure privacy
    const filter: any = { userId };
    if (projectId) {
      filter.projectId = projectId;
    }
    
    const matches = await vectorService.query(embedding, 5, filter);
    
    // 3. Format context string
    const contextParts = matches
      .map((match: any) => {
        const meta = match.metadata as VectorMetadata;
        return `[Fonte: ${meta.fileName || 'Documento'}]\n${meta.text || ''}`;
      })
      .filter((text: string) => text.length > 0);
      
    return contextParts.join('\n\n---\n\n');
  },

  /**
   * Execute a full RAG chat pull
   */
  async expertChat(params: {
    query: string;
    userId: string;
    projectId?: string;
    history?: any[];
    userApiKey?: string;
    model?: string;
    brandContext?: string;
  }) {
    const { query, userId, projectId, history, userApiKey, model, brandContext } = params;

    // 1. Get context
    const context = await this.getContext(query, userId, projectId);

    // 2. Chat with Gemini using niche Branding instructions
    const brandingSystemInstruction = `Você é o Especialista em Branding e Estratégia da Visant Labs.
Sua missão é ajudar o usuário a aplicar a metodologia Visant de branding de forma rigorosa, criativa e estratégica.

DIRETRIZES:
1. Mantenha o foco exclusivamente no CONTEXTO fornecido e na metodologia Visant.
2. Analise diferenciação, trade-offs e defensibilidade competitiva.
3. Seja direto, minimalista e focado na estratégia do negócio.
4. JAMAIS utilize emojis.
5. Responda no idioma do usuário.

${brandContext || ''}
UTILIZE O CONTEXTO ABAIXO:
${context}`;

    return await chatWithAIContext(query, context, history, {
      apiKey: userApiKey,
      model,
      systemInstruction: brandingSystemInstruction
    });
  }
};
