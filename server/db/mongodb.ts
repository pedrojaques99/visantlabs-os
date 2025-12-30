import { MongoClient, Db, MongoServerError } from 'mongodb';
import dotenv from 'dotenv';

// Carregar dotenv quando o módulo for importado (para scripts standalone)
// Only load dotenv in Node.js environment (not in browser builds)
(function loadDotenv() {
  if (typeof process === 'undefined' || !process.versions?.node || typeof process.cwd !== 'function') {
    return; // Skip in browser environment
  }
  
  try {
    // Use a simple path construction to avoid importing path module
    // This avoids bundling issues in Vite builds
    const cwd = process.cwd();
    dotenv.config({ path: `${cwd}/.env.local` });
    dotenv.config({ path: `${cwd}/.env` });
  } catch (error) {
    // Silently fail if dotenv config fails
    // This can happen in browser builds or if files don't exist
  }
})();

let client: MongoClient | null = null;
let db: Db | null = null;

// Cold start handling - debounce inicial para dar tempo do MongoDB estar pronto
let isFirstConnection = true;
let connectionPromise: Promise<Db> | null = null;
const COLD_START_DELAY_MS = 100; // 500ms delay no cold start

// Função para obter MONGODB_URI (avalia process.env quando chamada, não na importação)
const getMongoUri = () => process.env.MONGODB_URI || 'mongodb://localhost:27017';
const getDbName = () => process.env.MONGODB_DB_NAME || 'mockup-machine';

const getErrorMessage = (error: any): string => {
  const mongoUri = getMongoUri();
  // Check for connection refused errors (MongoDB not running)
  if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
    const isLocal = mongoUri?.includes('localhost') || mongoUri?.includes('127.0.0.1');
    if (isLocal) {
      return `MongoDB Connection Refused: Cannot connect to local MongoDB server.\n\n` +
        `Possible solutions:\n` +
        `1. Make sure MongoDB is installed and running locally\n` +
        `2. Start MongoDB service: mongod (or use MongoDB Compass/Community Server)\n` +
        `3. Or use MongoDB Atlas: Set MONGODB_URI to your Atlas connection string\n` +
        `4. Check if MongoDB is running on port 27017`;
    }
    return `MongoDB Connection Refused: Cannot connect to MongoDB server.\n\n` +
      `Possible solutions:\n` +
      `1. Verify MONGODB_URI is correct\n` +
      `2. Check if MongoDB server is running\n` +
      `3. Check Network Access settings (if using Atlas)`;
  }

  // Check for timeout errors
  if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
    return `MongoDB Connection Timeout: ${error.message}\n\n` +
      `Possible solutions:\n` +
      `1. Check your internet connection\n` +
      `2. Verify MONGODB_URI is correct\n` +
      `3. Check Network Access settings in MongoDB Atlas (IP whitelist)\n` +
      `4. Try again in a moment (Atlas may be experiencing temporary issues)\n` +
      `5. For Atlas: Ensure your IP is whitelisted or use 0.0.0.0/0 for all IPs`;
  }

  if (error instanceof MongoServerError) {
    if (error.code === 8000 || error.codeName === 'AtlasError') {
      return `MongoDB Authentication Failed: ${error.message}\n\n` +
        `Possible solutions:\n` +
        `1. Check if username and password are correct\n` +
        `2. If password contains special characters, URL-encode them (e.g., < → %3C, > → %3E, @ → %40)\n` +
        `3. Verify MONGODB_URI is correctly set in Vercel environment variables\n` +
        `4. Check Network Access settings in MongoDB Atlas (IP whitelist)\n` +
        `5. See VERCEL_MONGODB_SETUP.md for detailed instructions`;
    }
    if (error.code === 6 || error.codeName === 'HostUnreachable') {
      return `MongoDB Connection Failed: Cannot reach MongoDB server\n\n` +
        `Possible solutions:\n` +
        `1. Check Network Access settings in MongoDB Atlas\n` +
        `2. Add your IP address (or 0.0.0.0/0 for all) to Network Access whitelist\n` +
        `3. Verify MONGODB_URI is correct`;
    }
  }
  return error.message || 'Unknown MongoDB error';
};

export const connectToMongoDB = async (): Promise<Db> => {
  // Se já temos conexão ativa, retorna imediatamente
  if (db) {
    return db;
  }

  // Se já existe uma tentativa de conexão em andamento, aguarda ela
  // Isso evita múltiplas conexões simultâneas no cold start
  if (connectionPromise) {
    return connectionPromise;
  }

  // Debounce no cold start para dar tempo do MongoDB estar pronto
  if (isFirstConnection && process.env.NODE_ENV === 'production') {
    console.log(`🔄 MongoDB: Cold start detected, waiting ${COLD_START_DELAY_MS}ms before connecting...`);
    await new Promise(resolve => setTimeout(resolve, COLD_START_DELAY_MS));
    isFirstConnection = false;
  }

  // Cria promise de conexão para evitar múltiplas tentativas simultâneas
  connectionPromise = (async () => {
    try {
      return await _performConnection();
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

// Função interna que realiza a conexão de fato
const _performConnection = async (): Promise<Db> => {
  // Obter valores de env dentro da função (avalia quando chamada, não na importação)
  const MONGODB_URI = getMongoUri();
  const DB_NAME = getDbName();

  // Check if using local MongoDB or MongoDB Atlas
  const isLocalMongoDB = MONGODB_URI?.startsWith('mongodb://localhost') || 
                         MONGODB_URI?.startsWith('mongodb://127.0.0.1') ||
                         MONGODB_URI === 'mongodb://localhost:27017';
  const isAtlasMongoDB = MONGODB_URI?.startsWith('mongodb+srv://');

  // Debug: Log connection info (without exposing password)
  const uriForLogging = MONGODB_URI ? MONGODB_URI.replace(/:([^:@]+)@/, ':****@') : 'not set';
  console.log('🔍 MongoDB Connection Debug:');
  console.log('  - URI (masked):', uriForLogging);
  console.log('  - DB Name:', DB_NAME);
  console.log('  - Connection type:', isLocalMongoDB ? 'Local' : isAtlasMongoDB ? 'Atlas' : 'Unknown');

  // Only warn about default URI if not in production
  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  MONGODB_URI not set or using default. Make sure to set it in Vercel environment variables.');
    } else {
      console.log('ℹ️  Using local MongoDB (default). For production, set MONGODB_URI environment variable.');
    }
  }

  // Only validate username/password for MongoDB Atlas (mongodb+srv://)
  if (isAtlasMongoDB && MONGODB_URI && !MONGODB_URI.includes('@')) {
    console.error('❌ MongoDB Atlas URI appears to be missing username/password (no @ found)');
  }

  try {
    // Add connection options for better error handling
    // Reduced timeouts for faster failure detection and better user experience
    const clientOptions = {
      serverSelectionTimeoutMS: 10000, // 10 seconds - faster failure detection
      socketTimeoutMS: 30000, // 30 seconds - reduced from 60s
      connectTimeoutMS: 10000, // 10 seconds - reduced from 30s
      maxPoolSize: 10, // Maintain pool of connections
      minPoolSize: 1,
      retryWrites: true,
      retryReads: true,
      // Add heartbeat to detect dead connections faster
      heartbeatFrequencyMS: 10000, // Check connection every 10s
    };

    // If client exists but connection is dead, close it first
    if (client) {
      try {
        await client.db('admin').command({ ping: 1 });
      } catch (pingError) {
        // Connection is dead, close and recreate
        console.warn('⚠️  Existing MongoDB connection is dead, reconnecting...');
        try {
          await client.close();
        } catch (closeError) {
          // Ignore close errors
        }
        client = null;
        db = null;
      }
    }

    // Create new client if needed
    if (!client) {
      client = new MongoClient(MONGODB_URI, clientOptions);
      
      // Connect with timeout
      const connectPromise = client.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), clientOptions.connectTimeoutMS);
      });
      
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Test the connection with a simple command (with timeout)
      const pingPromise = client.db('admin').command({ ping: 1 });
      const pingTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), 5000);
      });
      
      await Promise.race([pingPromise, pingTimeout]);
      
      db = client.db(DB_NAME);
      console.log(`✅ Connected to MongoDB: ${DB_NAME}`);
    }
    
    return db!;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('❌ MongoDB connection error:', errorMessage);
    
    // Reset connection state on error
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
      client = null;
      db = null;
    }
    
    // Additional debugging info
    if (error instanceof MongoServerError) {
      console.error('Error details:');
      console.error('  - Code:', error.code);
      console.error('  - CodeName:', error.codeName);
      console.error('  - Error Message:', error.message);
    }
    
    throw new Error(errorMessage);
  }
};

export const getDb = (): Db => {
  if (!db) {
    throw new Error('Database not initialized. Call connectToMongoDB first.');
  }
  return db;
};

export const getClient = (): MongoClient => {
  if (!client) {
    throw new Error('MongoDB client not initialized. Call connectToMongoDB first.');
  }
  return client;
};

export const closeConnection = async (): Promise<void> => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
};

