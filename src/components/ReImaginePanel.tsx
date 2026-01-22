import React, { useState, useEffect } from 'react';
import { Pencil, X } from 'lucide-react';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from './ai/prompt-input';

interface ReImaginePanelProps {
  onSubmit: (reimaginePrompt: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const ReImaginePanel: React.FC<ReImaginePanelProps> = ({
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [input, setInput] = useState('');

  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const status = isLoading ? 'submitted' : 'ready';

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-neutral-900 rounded-xl border border-neutral-800/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-cyan/20 rounded-md">
              <Pencil size={20} className="text-brand-cyan" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-200">Re-imagine</h3>
              <p className="text-xs text-neutral-500">Describe the changes you want to make</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Input Form */}
        <div className="p-4">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="E.g., 'Change the background to a beach scene' or 'Make it look more professional' or 'Add a vintage filter'"
              autoFocus
            />
            <PromptInputToolbar>
              <PromptInputSubmit disabled={!input.trim()} status={status} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};





