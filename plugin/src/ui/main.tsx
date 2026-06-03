import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ClientProvider } from './lib/ClientProvider';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Visant] UI crash:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: '#ff6b6b', fontFamily: 'monospace', fontSize: 12 }}>
          <p>
            <strong>Plugin UI Error</strong>
          </p>
          <p>{this.state.error.message}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, opacity: 0.7 }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <ClientProvider>
        <App />
      </ClientProvider>
    </ErrorBoundary>
  );
} else {
  console.error('[Visant] #root element not found');
}
