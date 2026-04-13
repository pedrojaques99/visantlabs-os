import { useState, useCallback, useRef, useEffect } from 'react';
import { useFigmaMessages } from './useFigmaMessages';

export interface MentionItem {
  id: string;
  name: string;
  type: 'frame' | 'component' | 'variable';
}

export function useMentions(inputRef: React.RefObject<HTMLTextAreaElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<MentionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  const { send } = useFigmaMessages();

  const checkForMention = useCallback(() => {
    if (!inputRef.current) return;

    const text = inputRef.current.value;
    const cursorPos = inputRef.current.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const mentionText = textBeforeCursor.substring(lastAtIndex + 1);

      // Check if it's a valid mention start (no spaces)
      if (/^[a-zA-Z0-9_]*$/.test(mentionText)) {
        setFilterText(mentionText);
        setIsOpen(true);

        // Request available mentions from sandbox
        send({
          type: 'GET_ELEMENTS_FOR_MENTIONS',
          filter: mentionText
        } as any);

        setSelectedIndex(0);
        return;
      }
    }

    setIsOpen(false);
  }, [inputRef, send]);

  const selectMention = useCallback(
    (item: MentionItem) => {
      if (!inputRef.current) return;

      const text = inputRef.current.value;
      const cursorPos = inputRef.current.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const before = text.substring(0, lastAtIndex);
        const after = text.substring(cursorPos);
        const newText = `${before}@"${item.name}"[${item.type}:${item.id}] ${after}`;

        inputRef.current.value = newText;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(
          before.length + `@"${item.name}"[${item.type}:${item.id}] `.length,
          before.length + `@"${item.name}"[${item.type}:${item.id}] `.length
        );

        setIsOpen(false);
      }
    },
    [inputRef]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            selectMention(items[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, items, selectedIndex, selectMention]
  );

  return {
    isOpen,
    items,
    selectedIndex,
    checkForMention,
    selectMention,
    handleKeyDown,
    setItems
  };
}
