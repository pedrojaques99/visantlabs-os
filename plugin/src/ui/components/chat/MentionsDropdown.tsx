import React, { useEffect, useRef } from 'react';
import type { MentionItem } from '../../hooks/useMentions';

interface MentionsDropdownProps {
  isOpen: boolean;
  items: MentionItem[];
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
}

const TYPE_LABELS: Record<string, string> = {
  frame: 'F',
  component: 'C',
  layer: 'L',
  variable: 'V',
};

export function MentionsDropdown({ isOpen, items, selectedIndex, onSelect }: MentionsDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen || items.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full mb-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
    >
      {items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
            idx === selectedIndex ? 'bg-brand-cyan/10 text-brand-cyan' : 'hover:bg-muted text-foreground'
          }`}
        >
          <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {TYPE_LABELS[item.type] || item.type}
          </span>
          <span className="truncate">{item.name}</span>
        </button>
      ))}
    </div>
  );
}
