
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { deleteOldTemporaryImages } from '../../src/services/r2Service.js';

// Setup environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config(); // Fallback to .env

async function runCleanup() {
    console.log('[Cleanup] Starting temporary file cleanup...');
    try {
        const count = await deleteOldTemporaryImages(); // Default 1 hour
        console.log(`[Cleanup] Completed. Deleted ${count} files.`);
    } catch (error) {
        console.error('[Cleanup] Failed:', error);
    }
}

// Allow running directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runCleanup()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export { runCleanup };
