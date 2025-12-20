import { useEffect } from 'react';
import { initBotId } from 'botid/client/core';

/**
 * BotID Provider Component
 * Initializes BotID protection for specified API routes
 * This protects sensitive endpoints from bot attacks
 */
export const BotIdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    try {
      // Skip BotID initialization in localhost/development environment
      // This prevents script loading errors and allows login to work smoothly
      const isLocalhost = 
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0' ||
        window.location.hostname?.startsWith('192.168.') ||
        window.location.hostname?.startsWith('10.') ||
        import.meta.env.DEV ||
        !import.meta.env.PROD;

      if (isLocalhost) {
        console.debug('⚠️ BotID skipped on localhost/development environment');
        return;
      }

      // Initialize BotID with protected routes
      // Wrap in setTimeout to avoid blocking initial render
      setTimeout(() => {
        try {
          initBotId({
            protect: [
              {
                path: '/api/payments/create-checkout-session',
                method: 'POST',
              },
              {
                path: '/api/payments/create-credit-checkout',
                method: 'POST',
              },
              {
                path: '/api/payments/create-pix-checkout',
                method: 'POST',
              },
              {
                path: '/api/payments/create-abacate-pix',
                method: 'POST',
              },
              {
                path: '/api/payments/create-portal-session',
                method: 'POST',
              },
              {
                // Wildcard for any payment-related endpoints
                path: '/api/payments/*',
                method: 'POST',
              },
              // NOTE: Auth endpoints removed from BotID protection
              // BotID was blocking login requests before they reached the server
              // Auth endpoints should rely on rate limiting and other security measures instead
            ],
          });
          
          console.log('✅ BotID initialized successfully');
        } catch (initError) {
          console.warn('⚠️ BotID initialization failed (non-blocking):', initError);
          // Don't block the app if BotID fails to initialize
        }
      }, 100);
    } catch (error) {
      console.warn('⚠️ BotID setup failed (non-blocking):', error);
      // Don't block the app if BotID fails to initialize
    }
  }, []);

  return <>{children}</>;
};


