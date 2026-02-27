import React, { useCallback, useEffect, useState } from 'react';
import { authService } from '@/services/authService';
import { aiApi } from '@/services/aiApi';
import { useFigmaBridge } from '@/hooks/useFigmaBridge';
import type { FigmaOperation, PluginMessage, SerializedContext } from '@/lib/figma-types';
import '@/styles/figma-plugin.css';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://www.visantlabs.com';

export default function PluginPage() {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [context, setContext] = useState<SerializedContext | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleMessage = useCallback((msg: PluginMessage) => {
    switch (msg.type) {
      case 'CONTEXT':
        setContext(msg.payload);
        break;
      case 'OPERATIONS_DONE':
        setLoading(false);
        setSuccess(true);
        setError(null);
        break;
      case 'ERROR':
        setLoading(false);
        setError(msg.message);
        setSuccess(false);
        break;
    }
  }, []);

  const { send } = useFigmaBridge(handleMessage);

  useEffect(() => {
    const checkAuth = async () => {
      const token = authService.getToken();
      if (!token) {
        setAuthReady(true);
        setIsAuthenticated(false);
        return;
      }
      try {
        const user = await authService.verifyToken();
        setIsAuthenticated(!!user);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthReady(true);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (authReady && isAuthenticated) {
      send({ type: 'GET_CONTEXT' });
    }
  }, [authReady, isAuthenticated, send]);

  const handleLogin = () => {
    send({ type: 'OPEN_EXTERNAL', url: APP_URL });
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !context) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const operations: FigmaOperation[] = await aiApi.generateFigmaOperations(prompt.trim(), context);
      send({ type: 'APPLY_OPERATIONS', payload: operations });
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
  };

  if (!authReady) {
    return (
      <div className="fp-container">
        <div className="fp-section">
          <div className="fp-spinner" />
          <span style={{ marginLeft: 8 }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fp-container">
        <div className="fp-section">
          <p className="fp-label">Sign in to use Visant Copilot</p>
          <p style={{ marginBottom: 8, color: 'var(--fp-text-secondary)' }}>
            Open the main app in your browser to log in, then return here.
          </p>
          <button type="button" className="fp-button fp-button--primary" onClick={handleLogin}>
            Open Visant to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-container">
      <div className="fp-section">
        <label className="fp-label" htmlFor="fp-prompt">
          Describe what to create
        </label>
        <textarea
          id="fp-prompt"
          className="fp-textarea"
          placeholder="e.g. Create a card with title and subtitle"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
        />
      </div>

      {context && (
        <div className="fp-section">
          <span className="fp-badge">{context.nodes.length} nodes selected</span>
        </div>
      )}

      <div className="fp-section">
        <button
          type="button"
          className="fp-button fp-button--primary"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <>
              <span className="fp-spinner" style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>

      {error && (
        <div className="fp-section" style={{ color: 'var(--figma-color-text-danger, #e03e3e)' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="fp-section" style={{ color: 'var(--figma-color-text-success, #0d99ff)' }}>
          Done! Operations applied to canvas.
        </div>
      )}
    </div>
  );
}
