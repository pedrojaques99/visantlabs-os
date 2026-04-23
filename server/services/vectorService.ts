import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

// Load environment variables from .env and .env.local
dotenv.config();
dotenv.config({ path: '.env.local' });

const apiKey = (process.env.PINECONE_API_KEY || process.env.PINECONE_KEY || '').trim();
const indexName = process.env.PINECONE_INDEX_NAME || 'visant-branding';

// Lazy initialize to avoid crashing on import if API key is missing
let pineconeClient: Pinecone | null = null;
let pineconeIndex: any = null;

const getIndex = () => {
  if (!apiKey) {
    console.warn('[VectorService] ⚠️ PINECONE_API_KEY não configurada. Usando MOCK_MODE (Busca em memória limitada).');
    return {
      upsert: async () => { console.log('[VectorService-Mock] Upsert simulado com sucesso.'); return true; },
      query: async () => { console.log('[VectorService-Mock] Query simulada retornando lista vazia.'); return { matches: [] }; },
      deleteOne: async () => true,
      deleteMany: async () => true,
    };
  }

  if (!pineconeClient) {
    try {
      pineconeClient = new Pinecone({
        apiKey,
      });
      pineconeIndex = pineconeClient.index(indexName);
    } catch (e) {
      console.error('[VectorService] Erro ao inicializar Pinecone:', e);
      throw new Error('CONFIGURAÇÃO_INVÁLIDA: Falha ao carregar o índice do Pinecone.');
    }
  }

  return pineconeIndex;
};

export interface VectorMetadata {
  userId?: string;
  projectId?: string;
  fileName?: string;
  fileType?: string;
  sourceUrl?: string;
  text?: string;
  [key: string]: any;
}

export const vectorService = {
  /**
   * Upsert a vector to Pinecone
   */
  async upsert(id: string, values: number[], metadata: VectorMetadata) {
    try {
      if (!values || !Array.isArray(values) || values.length === 0) {
        console.error('[VectorService] Invalid embedding values:', {
          type: typeof values,
          isArray: Array.isArray(values),
          length: Array.isArray(values) ? values.length : 'N/A'
        });
        throw new Error(`Valores de embedding inválidos: ${typeof values}. Array.isArray=${Array.isArray(values)}, length=${Array.isArray(values) ? values.length : 'N/A'}`);
      }

      // Filter metadata to remove undefined/null values which can break Pinecone SDK v7 validator
      const cleanMetadata: any = {};
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Pinecone only supports strings, numbers, booleans, and arrays of strings
          if (typeof value === 'object' && !Array.isArray(value)) {
            cleanMetadata[key] = JSON.stringify(value);
          } else {
            cleanMetadata[key] = value;
          }
        }
      });

      // Ensure values is a proper number array
      const valuesArray = values instanceof Float32Array ? Array.from(values) : values as number[];

      if (!Array.isArray(valuesArray) || valuesArray.length === 0) {
        throw new Error(`CRITICAL: Invalid values for upsert. Type: ${typeof valuesArray}, Length: ${Array.isArray(valuesArray) ? valuesArray.length : 'N/A'}`);
      }

      const record = {
        id: String(id),
        values: valuesArray,
        metadata: cleanMetadata,
      };

      console.log(`[VectorService] Record ready. ID: ${record.id}, Values: ${record.values.length}, Metadata keys: ${Object.keys(record.metadata).join(', ')}`);

      const recordsToUpsert = [record];
      console.log(`[VectorService] Calling upsert with array of length: ${recordsToUpsert.length}. Record structure:`, { id: typeof record.id, values: Array.isArray(record.values), metadata: typeof record.metadata });

      if (recordsToUpsert.length === 0 || !recordsToUpsert[0].values || recordsToUpsert[0].values.length === 0) {
        throw new Error("CRITICAL: recordsToUpsert is empty or has invalid values before calling Pinecone!");
      }

      // Standard Pinecone SDK v7 upsert (Array of objects)
      console.log(`[VectorService] Before upsert - record data:`, JSON.stringify({
        id: recordsToUpsert[0].id,
        valuesLength: recordsToUpsert[0].values.length,
        metadataKeys: Object.keys(recordsToUpsert[0].metadata),
        metadataTypes: Object.entries(recordsToUpsert[0].metadata).map(([k, v]) => `${k}:${typeof v}`)
      }));

      await getIndex().upsert(recordsToUpsert);
      return true;
    } catch (error) {
      console.error('Pinecone upsert error details:', error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    }
  },

  /**
   * Query Pinecone for similar vectors
   */
  async query(values: number[], topK: number = 5, filter?: any) {
    try {
      const queryResponse = await getIndex().query({
        vector: values,
        topK,
        includeMetadata: true,
        filter,
      });
      return queryResponse.matches || [];
    } catch (error) {
      console.error('Pinecone query error:', error);
      throw error;
    }
  },

  /**
   * Delete a vector by ID
   */
  async delete(id: string) {
    try {
      await getIndex().deleteOne(id);
      return true;
    } catch (error) {
      console.error('Pinecone delete error:', error);
      throw error;
    }
  },

  /**
   * Delete all vectors for a specific project/user via metadata filter
   */
  async deleteMany(filter: any) {
    try {
      await getIndex().deleteMany({ filter });
      return true;
    } catch (error) {
      console.error('Pinecone deleteMany error:', error);
      throw error;
    }
  }
};
