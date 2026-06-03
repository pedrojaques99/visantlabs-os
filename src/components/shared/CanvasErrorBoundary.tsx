import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-neutral-950">
          <div className="flex flex-col items-center gap-4 max-w-xs text-center">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-400 uppercase tracking-widest">
                {this.props.fallbackMessage || 'Rendering engine crashed'}
              </p>
              <p className="text-[10px] text-neutral-600 mt-1">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
              className="text-neutral-500 gap-1.5"
            >
              <RotateCcw size={12} />
              <span className="text-[10px] uppercase tracking-widest">Retry</span>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
