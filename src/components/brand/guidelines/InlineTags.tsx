import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';

interface InlineTagsProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  inputWidth?: number;
}

/**
 * Inline-editable badge list.
 * Click a badge to edit it, X to delete, + to add new.
 */
export const InlineTags: React.FC<InlineTagsProps> = ({
  values, onChange, placeholder = 'Add...', inputWidth = 100,
}) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [adding, setAdding] = useState(false);
  const [addVal, setAddVal] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editIdx !== null) editRef.current?.focus(); }, [editIdx]);
  useEffect(() => { if (adding) addRef.current?.focus(); }, [adding]);

  const commitEdit = () => {
    if (editIdx === null) return;
    const trimmed = editVal.trim();
    if (trimmed) {
      onChange(values.map((v, i) => i === editIdx ? trimmed : v));
    } else {
      onChange(values.filter((_, i) => i !== editIdx));
    }
    setEditIdx(null);
  };

  const commitAdd = () => {
    const trimmed = addVal.trim();
    if (trimmed) onChange([...values, trimmed]);
    setAdding(false);
    setAddVal('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {values.map((v, i) =>
        editIdx === i ? (
          <input
            key={i}
            ref={editRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null); }}
            className="h-6 px-2 rounded border border-white/20 bg-neutral-800/60 text-xs text-neutral-200 focus:outline-none focus:border-white/30"
            style={{ width: `${Math.max(editVal.length * 7 + 24, inputWidth)}px` }}
          />
        ) : (
          <span
            key={i}
            className="group/t inline-flex items-center gap-1 px-2 h-6 rounded border border-white/[0.08] bg-neutral-800/30 text-xs text-neutral-300 cursor-pointer hover:border-white/20 hover:bg-neutral-800/50 transition-colors"
            onClick={() => { setEditIdx(i); setEditVal(v); }}
          >
            {v}
            <button
              onClick={(e) => { e.stopPropagation(); onChange(values.filter((_, j) => j !== i)); }}
              className="text-neutral-700 hover:text-red-400 opacity-0 group-hover/t:opacity-100 transition-all"
              aria-label="Remove"
            >
              <X size={9} />
            </button>
          </span>
        )
      )}

      {adding ? (
        <input
          ref={addRef}
          value={addVal}
          onChange={(e) => setAddVal(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={(e) => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAdding(false); setAddVal(''); } }}
          placeholder={placeholder}
          className="h-6 px-2 rounded border border-white/20 bg-neutral-800/60 text-xs text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-white/30"
          style={{ width: `${inputWidth}px` }}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="h-6 px-1.5 rounded border border-dashed border-white/[0.06] text-neutral-700 hover:text-neutral-400 hover:border-white/15 transition-colors"
          aria-label="Add"
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  );
};
