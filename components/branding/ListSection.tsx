import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Textarea } from '../ui/textarea';

interface ListSectionProps {
  items: string[];
  isEditing?: boolean;
  onContentChange?: (value: string[]) => void;
}

export const ListSection: React.FC<ListSectionProps> = ({
  items,
  isEditing = false,
  onContentChange,
}) => {
  const { theme } = useTheme();
  const [localItems, setLocalItems] = useState<string[]>(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleItemChange = (index: number, value: string) => {
    const newItems = [...localItems];
    newItems[index] = value;
    setLocalItems(newItems);
    if (onContentChange) {
      onContentChange(newItems);
    }
  };

  const handleAddItem = () => {
    const newItems = [...localItems, ''];
    setLocalItems(newItems);
    if (onContentChange) {
      onContentChange(newItems);
    }
  };

  const handleRemoveItem = (index: number) => {
    const newItems = localItems.filter((_, i) => i !== index);
    setLocalItems(newItems);
    if (onContentChange) {
      onContentChange(newItems);
    }
  };

  if (isEditing && onContentChange) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localItems.map((item, index) => (
            <div
              key={index}
              className={`border rounded-xl p-4 hover:border-[#52ddeb]/50 transition-colors relative ${
                theme === 'dark'
                  ? 'bg-black/40 border-zinc-800/60'
                  : 'bg-zinc-100 border-zinc-300'
              }`}
            >
              <Textarea
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                placeholder="Digite o item..."
                className={`bg-transparent font-manrope text-sm min-h-[80px] pr-8 ${
                  theme === 'dark'
                    ? 'border-zinc-700/50 text-zinc-300'
                    : 'border-zinc-400/50 text-zinc-800'
                }`}
              />
              <button
                onClick={() => handleRemoveItem(index)}
                className={`absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded transition-colors hover:text-red-400 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`}
                title="Remover item"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddItem}
          className={`flex items-center gap-2 px-4 py-2 border hover:border-[#52ddeb]/50 hover:text-brand-cyan rounded-xl text-sm font-mono transition-all duration-300 ${
            theme === 'dark'
              ? 'bg-black/40 border-zinc-800/60 text-zinc-300'
              : 'bg-zinc-100 border-zinc-300 text-zinc-800'
          }`}
        >
          <Plus className="h-4 w-4" />
          Adicionar item
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <div
          key={index}
          className={`border rounded-xl p-4 transition-colors ${
            theme === 'dark'
              ? 'bg-black/40 border-zinc-800/60 hover:border-zinc-700/60'
              : 'bg-zinc-100 border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <p className={`text-sm font-manrope leading-relaxed ${
            theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'
          }`}>
            {item}
          </p>
        </div>
      ))}
    </div>
  );
};

