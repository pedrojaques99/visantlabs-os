import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper';
import { BotIdProvider } from './components/BotIdProvider';
import { getCurrentLocale, translate } from './utils/localeUtils';

// Global error handler to suppress browser extension errors and BotID script loading errors
window.addEventListener('error', (event) => {
  // Ignore errors from browser extensions (message channel errors)
  if (
    event.message?.includes('message channel closed') ||
    event.message?.includes('asynchronous response') ||
    event.message?.includes('Extension context invalidated')
  ) {
    event.preventDefault();
    console.debug('Suppressed browser extension error:', event.message);
    return false;
  }

  // Suppress BotID script loading errors (c.js file)
  // BotID tries to load c.js but Vercel routing may return HTML instead
  if (
    event.filename?.includes('c.js') ||
    event.message?.includes('c.js') ||
    (event.message?.includes('Unexpected token') && event.filename?.includes('vercel.app'))
  ) {
    event.preventDefault();
    console.debug('Suppressed BotID script loading error:', event.message);
    return false;
  }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || String(event.reason || '');

  // Ignore promise rejections from browser extensions
  if (
    errorMessage.includes('message channel closed') ||
    errorMessage.includes('asynchronous response') ||
    errorMessage.includes('Extension context invalidated')
  ) {
    event.preventDefault();
    console.debug('Suppressed browser extension promise rejection:', errorMessage);
    return false;
  }

  // Suppress BotID-related promise rejections
  if (
    errorMessage.includes('c.js') ||
    errorMessage.includes('botid') ||
    (errorMessage.includes('Unexpected token') && errorMessage.includes('vercel.app'))
  ) {
    event.preventDefault();
    console.debug('Suppressed BotID promise rejection:', errorMessage);
    return false;
  }

  // Handle chunk load errors - try to recover automatically
  const isChunkError =
    errorMessage.includes('Failed to fetch dynamically imported module') ||
    errorMessage.includes('Loading chunk') ||
    errorMessage.includes('Loading CSS chunk') ||
    event.reason?.name === 'ChunkLoadError' ||
    (event.reason as any)?.code === 'CHUNK_LOAD_ERROR';

  if (isChunkError) {
    console.warn('Chunk load error detected, attempting recovery...');
    // Don't prevent default - let ErrorBoundary handle it
    // But log it for debugging
  }
});


// Initialize HTML lang attribute based on user's locale preference
const initialLocale = getCurrentLocale();
document.documentElement.lang = initialLocale === 'pt-BR' ? 'pt-BR' : 'en-US';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const router = createBrowserRouter([
  {
    path: '/*',
    element: <App />,
    errorElement: (
      <ErrorBoundaryWrapper>
        <div className="min-h-screen bg-background text-zinc-300 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-card border border-zinc-800 rounded-md p-6 md:p-8 space-y-6">
            <h1 className="text-xl md:text-2xl font-semibold text-zinc-200 font-mono">
              {translate('router.routeError', initialLocale)}
            </h1>
            <p className="text-sm text-zinc-400 font-mono">
              {translate('router.routeErrorDescription', initialLocale)}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/30 hover:border-brand-cyan/50 text-brand-cyan rounded-md transition-colors font-mono text-sm"
            >
              {translate('router.goHome', initialLocale)}
            </button>
          </div>
        </div>
      </ErrorBoundaryWrapper>
    ),
  },
]);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BotIdProvider>
      <RouterProvider router={router} />
      <SpeedInsights />
    </BotIdProvider>
  </React.StrictMode>
);