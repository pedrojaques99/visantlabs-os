import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';

interface Field {
  id: string;
  label: string;
}

interface FieldSelectionMenuProps {
  fields: Field[];
  position: { x: number; y: number };
  onSelect: (fieldId: string) => void;
  onClose: () => void;
}

export const FieldSelectionMenu: React.FC<FieldSelectionMenuProps> = ({
  fields,
  position,
  onSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter fields based on search query
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return fields;
    const query = searchQuery.toLowerCase();
    return fields.filter(field =>
      field.label.toLowerCase().includes(query) ||
      field.id.toLowerCase().includes(query)
    );
  }, [fields, searchQuery]);

  // Reset selected index when filtered fields change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFields.length]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredFields.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredFields[selectedIndex]) {
          onSelect(filteredFields[selectedIndex].id);
          onClose();
        }
        return;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, filteredFields, selectedIndex, onSelect]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-black/95 backdrop-blur-xl border border-zinc-700 rounded-md shadow-2xl overflow-hidden min-w-[280px] max-w-[320px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      role="menu"
      aria-label="Menu de seleção de campos"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-mono text-zinc-400">Adicionar campo</span>
        <button
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
          aria-label="Fechar menu"
        >
          <X size={14} />
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar campo..."
            className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-zinc-800 rounded text-sm font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[brand-cyan]/50"
            aria-label="Buscar campo"
          />
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {filteredFields.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-zinc-500 font-mono">
            Nenhum campo encontrado
          </div>
        ) : (
          filteredFields.map((field, index) => (
            <button
              key={field.id}
              onClick={() => {
                onSelect(field.id);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3 py-2.5 text-left text-sm font-mono transition-colors border-b border-zinc-800/50 last:border-b-0 ${index === selectedIndex
                ? 'bg-brand-cyan/20 text-brand-cyan'
                : 'text-zinc-300 hover:bg-brand-cyan/10 hover:text-brand-cyan'
                }`}
              role="menuitem"
              aria-label={`Adicionar campo ${field.label}`}
            >
              {field.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

