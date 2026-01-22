import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface SearchResult {
  id: string;
  label: string;
  category: string;
  onClick: () => void;
}

interface CommandPaletteProps {
  items: SearchResult[];
  onClose?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ items, onClose }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(0);
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (resultsRef.current && selectedIndex >= 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: SearchResult) => {
    item.onClick();
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50"
        onClick={() => {
          setIsOpen(false);
          setSearchQuery('');
          onClose?.();
        }}
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
        <div
          className="w-full max-w-2xl bg-card border border-neutral-800/50 rounded-lg shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800/50">
            <Search className="w-5 h-5 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('designSystem.commandPalette.placeholder') || 'Search components, colors, typography...'}
              className="flex-1 bg-transparent text-neutral-200 placeholder:text-neutral-500 focus:outline-none font-mono text-sm"
            />
            <div className="flex items-center gap-1 px-2 py-1 bg-neutral-900/50 rounded border border-neutral-800/50">
              <Command className="w-3 h-3 text-neutral-500" />
              <kbd className="text-xs font-mono text-neutral-500">K</kbd>
            </div>
          </div>
          <div
            ref={resultsRef}
            className="max-h-[60vh] overflow-y-auto"
          >
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500 font-mono text-sm">
                {t('designSystem.commandPalette.noResults') || 'No results found'}
              </div>
            ) : (
              <div className="py-2">
                {filteredItems.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-neutral-800/50 transition-colors',
                      index === selectedIndex && 'bg-neutral-800/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-mono text-neutral-200">{item.label}</div>
                        <div className="text-xs font-mono text-neutral-500 mt-0.5">{item.category}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

