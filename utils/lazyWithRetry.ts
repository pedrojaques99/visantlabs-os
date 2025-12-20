import { ComponentType, lazy, LazyExoticComponent } from 'react';

/**
 * Wraps React.lazy with automatic retry logic for failed chunk loads
 * This prevents users from seeing errors when chunks fail to load due to network issues
 * Also handles MIME type errors (when server returns HTML instead of JS)
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  retryDelay = 1000
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const module = await importFn();
        return module;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a chunk load error or MIME type error
        const isChunkError = 
          error?.message?.includes('Failed to fetch dynamically imported module') ||
          error?.message?.includes('Loading chunk') ||
          error?.message?.includes('Loading CSS chunk') ||
          error?.message?.includes('Expected a JavaScript-or-Wasm module script') ||
          error?.message?.includes('MIME type') ||
          error?.name === 'ChunkLoadError' ||
          error?.code === 'CHUNK_LOAD_ERROR';

        if (!isChunkError) {
          // Not a chunk error, throw immediately
          throw error;
        }

        // If it's a MIME type error (server returned HTML instead of JS), 
        // it's likely a routing/auth issue - don't retry indefinitely
        const isMimeTypeError = 
          error?.message?.includes('Expected a JavaScript-or-Wasm module script') ||
          error?.message?.includes('MIME type');

        if (isMimeTypeError && attempt === 0) {
          // First attempt with MIME error - wait a bit longer and clear cache
          console.warn('[lazyWithRetry] MIME type error detected - server may be returning HTML instead of JS');
          
          // Clear all caches
          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(
                cacheNames.map(name => caches.delete(name))
              );
            } catch (e) {
              // Ignore cache clearing errors
            }
          }
          
          // Force reload if we're getting HTML instead of JS (likely routing issue)
          // Wait a bit longer for potential auth/routing to resolve
          await new Promise(resolve => setTimeout(resolve, retryDelay * 2));
        }

        // If it's the last attempt, throw the error
        if (attempt === retries - 1) {
          // On final failure, provide more helpful error message
          if (isMimeTypeError) {
            const enhancedError = new Error(
              'Failed to load module: Server returned HTML instead of JavaScript. ' +
              'This may indicate a routing or authentication issue. ' +
              'Please refresh the page or check your network connection.'
            );
            enhancedError.name = error?.name || 'ChunkLoadError';
            throw enhancedError;
          }
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Try to clear cache and reload chunk
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const cacheNames = await caches.keys();
            await Promise.all(
              cacheNames.map(name => caches.delete(name))
            );
          } catch (e) {
            // Ignore cache clearing errors
          }
        }
      }
    }

    throw lastError || new Error('Failed to load chunk after retries');
  });
}





