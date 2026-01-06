import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  translations?: {
    retrying?: string;
    chunkErrorTitle?: string;
    unexpectedErrorTitle?: string;
    chunkErrorDescription?: string;
    unexpectedErrorDescription?: string;
    chunkErrorMessage?: string;
    chunkErrorHint?: string;
    stackTrace?: string;
    layoutError?: string;
    reloadPage?: string;
    goHome?: string;
    tryAgain?: string;
    unexpectedError?: string;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
  retryCount: number;
  isRetrying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isChunkError = 
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk') ||
      error?.name === 'ChunkLoadError' ||
      (error as any)?.code === 'CHUNK_LOAD_ERROR';

    return {
      hasError: true,
      error,
      errorInfo: null,
      isChunkError,
      retryCount: 0,
      isRetrying: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isChunkError = 
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk') ||
      error?.name === 'ChunkLoadError' ||
      (error as any)?.code === 'CHUNK_LOAD_ERROR';

    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState((prevState) => {
      const currentRetryCount = prevState.retryCount || 0;
      
      // Auto-retry chunk errors up to 2 times before showing error
      if (isChunkError && currentRetryCount < 2) {
        // Use setTimeout to call attemptChunkRetry after state is set
        setTimeout(() => {
          this.attemptChunkRetry();
        }, 0);
      }

      return {
        error,
        errorInfo,
        isChunkError,
      };
    });
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  attemptChunkRetry = async () => {
    this.setState((prevState) => {
      if (prevState.isRetrying || (prevState.retryCount || 0) >= 2) {
        return prevState;
      }

      // Clear caches
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then(cacheNames => {
          Promise.all(cacheNames.map(name => caches.delete(name))).catch(() => {
            // Ignore cache clearing errors
          });
        });
      }

      const currentRetryCount = prevState.retryCount || 0;
      
      // Wait a bit before retrying
      this.retryTimeout = setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: currentRetryCount + 1,
          isRetrying: false,
        });
      }, 1000 * (currentRetryCount + 1));

      return {
        ...prevState,
        isRetrying: true,
      };
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  handleReload = () => {
    // Force reload with cache bypass for chunk errors
    if (this.state.isChunkError) {
      window.location.reload();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetryChunk = async () => {
    // Clear caches and reload
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
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const translations = this.props.translations || {};
      const errorMessage = this.state.error?.message || (translations.unexpectedError || 'An unexpected error occurred');
      const isLayoutError = errorMessage.includes('useLayout must be used within a Layout component');
      const isChunkError = this.state.isChunkError;

      // Show retrying state for chunk errors
      if (isChunkError && this.state.isRetrying) {
        return (
          <div className="min-h-screen bg-black text-zinc-300 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-black/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-6 md:p-8 space-y-4 text-center">
              <div className="flex justify-center">
                <RefreshCw className="h-8 w-8 text-brand-cyan animate-spin" />
              </div>
              <p className="text-sm text-zinc-400 font-mono">
                {translations.retrying || 'Retrying...'}
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-black text-zinc-300 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-black/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-md">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold text-zinc-200 font-mono">
                  {isChunkError ? (translations.chunkErrorTitle || 'Page Load Error') : (translations.unexpectedErrorTitle || 'Unexpected Error')}
                </h1>
                <p className="text-sm text-zinc-400 font-mono mt-1">
                  {isChunkError ? (translations.chunkErrorDescription || 'Could not load required files') : (translations.unexpectedErrorDescription || 'Something went wrong')}
                </p>
              </div>
            </div>

            <div className="bg-black/40 border border-zinc-800 rounded-md p-4 space-y-2">
              {!isChunkError && (
                <p className="text-sm font-mono text-red-400 font-semibold">
                  {errorMessage}
                </p>
              )}
              {isChunkError && (
                <div className="space-y-2">
                  <p className="text-sm font-mono text-yellow-400">
                    {translations.chunkErrorMessage || 'A problem occurred while loading the page files. This is usually caused by network or cache issues.'}
                  </p>
                  <p className="text-xs font-mono text-zinc-500">
                    {translations.chunkErrorHint || 'Try reloading the page or clearing your browser cache.'}
                  </p>
                </div>
              )}
              {this.state.errorInfo && !isChunkError && (
                <details className="mt-4">
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 font-mono mb-2">
                    {translations.stackTrace || 'Stack Trace'}
                  </summary>
                  <pre className="text-xs text-zinc-600 font-mono overflow-auto max-h-48 p-2 bg-black/40 rounded border border-zinc-800">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {isLayoutError && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
                <p className="text-sm text-yellow-400 font-mono">
                  {translations.layoutError || 'This error suggests a component is trying to use layout context outside of the Layout component. Please refresh the page or contact support if the issue persists.'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {isChunkError ? (
                <>
                  <button
                    onClick={this.handleRetryChunk}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 text-brand-cyan rounded-md transition-colors font-mono text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {translations.reloadPage || 'Reload Page'}
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md transition-colors font-mono text-sm"
                  >
                    <Home className="h-4 w-4" />
                    {translations.goHome || 'Go Home'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={this.handleReset}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#52ddeb]/30 hover:border-[#52ddeb]/50 text-brand-cyan rounded-md transition-colors font-mono text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {translations.tryAgain || 'Try Again'}
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md transition-colors font-mono text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {translations.reloadPage || 'Reload Page'}
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md transition-colors font-mono text-sm"
                  >
                    <Home className="h-4 w-4" />
                    {translations.goHome || 'Go Home'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}













