import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ClientProvider } from './lib/ClientProvider';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ClientProvider>
      <App />
    </ClientProvider>
  );
}
