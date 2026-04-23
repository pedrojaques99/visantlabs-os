import React from 'react';
import type { MentionItem } from '../../hooks/useMentions';

interface MentionsDropdownProps {
  isOpen: boolean;
  items: MentionItem[];
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
}

export function MentionsDropdown({ isOpen, items, selectedIndex, onSelect }: MentionsDropdownProps) {
  if (!isOpen || items.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
      {items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className={`w-full text-left px-3 py-2 text-sm ${
            idx === selectedIndex ? 'bg-brand-cyan/10 text-brand-cyan' : 'hover:bg-muted'
          }`}
        >
          <span className="font-mono text-xs text-muted-foreground mr-2">{item.type}</span>
          {item.name}
        </button>
      ))}
    </div>
  );
}
