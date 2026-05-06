import { useState, useCallback, useRef, useEffect } from 'react';
import { useFigmaMessages } from './useFigmaMessages';
import { usePluginStore } from '../store';

export interface MentionItem {
  id: string;
  name: string;
  type: 'frame' | 'component' | 'layer' | 'variable';
}

// Matches @"Name"[type:id] — handles escaped quotes inside name
const MENTION_REGEX = /@"((?:[^"\\]|\\.)*)"\[(\w+):([\w:;/]+)\]/g;

export function parseMentions(text: string): { id: string; name: string; type: string }[] {
  const matches: { id: string; name: string; type: string }[] = [];
  let m: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((m = MENTION_REGEX.exec(text)) !== null) {
    matches.push({ name: unescapeName(m[1]), type: m[2], id: m[3] });
  }
  return matches;
}

function escapeMentionName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\[/g, '(').replace(/\]/g, ')');
}

function unescapeName(escaped: string): string {
  return escaped.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

// Guard regex for completed mentions (same escaped-quote-aware pattern)
const COMPLETED_MENTION_RE = /^@"(?:[^"\\]|\\.)*"\[\w+:[\w:;/]+\]/;

export function useMentions(
  inputRef: React.RefObject<HTMLTextAreaElement>,
  onContentChange?: (value: string) => void
) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<MentionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  const { send } = useFigmaMessages();
  const mentionElements = usePluginStore(s => s.mentionElements);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (mentionElements.length > 0) {
      const q = filterText.toLowerCase();
      const filtered = q
        ? mentionElements.filter((el: any) => el.name?.toLowerCase().includes(q))
        : mentionElements;
      setItems(filtered.map((el: any) => ({ id: el.id, name: el.name, type: el.type || 'frame' })));
      setSelectedIndex(0);
    } else if (hasFetched.current) {
      setItems([]);
    }
  }, [mentionElements, filterText]);

  const fetchElements = useCallback(() => {
    send({ type: 'GET_ELEMENTS_FOR_MENTIONS' } as any);
    hasFetched.current = true;
  }, [send]);

  const checkForMention = useCallback(() => {
    if (!inputRef.current) return;

    const text = inputRef.current.value;
    const cursorPos = inputRef.current.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const afterAt = textBeforeCursor.substring(lastAtIndex);
      if (COMPLETED_MENTION_RE.test(afterAt)) {
        setIsOpen(false);
        return;
      }

      const mentionText = textBeforeCursor.substring(lastAtIndex + 1);

      if (!/\n/.test(mentionText)) {
        setFilterText(mentionText);
        setIsOpen(true);

        // Always re-fetch to get current Figma selection
        fetchElements();
        return;
      }
    }

    setIsOpen(false);
  }, [inputRef, fetchElements]);

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
        const safeName = escapeMentionName(item.name);
        const mention = `@"${safeName}"[${item.type}:${item.id}]`;
        const newText = `${before}${mention} ${after}`;
        const newCursorPos = before.length + mention.length + 1;

        // Sync both DOM and React state
        inputRef.current.value = newText;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        onContentChange?.(newText);

        setIsOpen(false);
        setFilterText('');
      }
    },
    [inputRef]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || items.length === 0) return;

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
        case 'Tab':
          e.preventDefault();
          if (items[selectedIndex]) {
            selectMention(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
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
    setItems,
    refresh: fetchElements
  };
}
