import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Tag, Plus, X } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface TagsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type Tags = Record<string, string[]>;
type Editing = { cat: string; idx: number } | null;

export const TagsSection: React.FC<TagsSectionProps> = ({ guideline, onUpdate, span }) => {
  // No local tags state — derive from guideline prop (draft via GuidelineDetail)
  const tags = guideline.tags || {};

  // UI-only state
  const [editing, setEditing] = useState<Editing>(null);
  const [editValue, setEditValue] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addValue, setAddValue] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [catValue, setCatValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const catRef = useRef<HTMLInputElement>(null);

  const persist = useCallback((next: Tags) => {
    onUpdate({ tags: next });
  }, [onUpdate]);

  useEffect(() => { if (editing) editRef.current?.focus(); }, [editing]);
  useEffect(() => { if (addingTo) addRef.current?.focus(); }, [addingTo]);
  useEffect(() => { if (addingCat) catRef.current?.focus(); }, [addingCat]);

  const startEdit = (cat: string, idx: number) => {
    setEditing({ cat, idx });
    setEditValue(tags[cat][idx]);
  };

  const commitEdit = () => {
    if (!editing) return;
    const { cat, idx } = editing;
    const trimmed = editValue.trim();
    const next = { ...tags };
    if (trimmed) {
      next[cat] = next[cat].map((v, i) => i === idx ? trimmed : v);
    } else {
      next[cat] = next[cat].filter((_, i) => i !== idx);
      if (!next[cat].length) delete next[cat];
    }
    setEditing(null);
    persist(next);
  };

  const deleteTag = (cat: string, idx: number) => {
    const next = { ...tags };
    next[cat] = next[cat].filter((_, i) => i !== idx);
    if (!next[cat].length) delete next[cat];
    persist(next);
  };

  const commitAdd = () => {
    if (!addingTo) return;
    const trimmed = addValue.trim();
    if (trimmed) {
      const next = { ...tags, [addingTo]: [...(tags[addingTo] || []), trimmed] };
      persist(next);
    }
    setAddingTo(null);
    setAddValue('');
  };

  const commitCat = () => {
    const trimmed = catValue.trim();
    if (trimmed && !tags[trimmed]) {
      persist({ ...tags, [trimmed]: [] });
    }
    setAddingCat(false);
    setCatValue('');
  };

  const categories = Object.keys(tags);

  return (
    <SectionBlock
      id="tags"
      icon={<Tag size={14} />}
      title="Tags"
      span={span as any}
      actions={
        <Button variant="ghost" size="icon" className="h-5 w-5 text-neutral-500 hover:text-white" onClick={() => setAddingCat(true)} aria-label="Add category">
          <Plus size={11} />
        </Button>
      }
    >
      <div className="space-y-3 py-1">
        {categories.length === 0 && !addingCat && (
          <p className="text-[11px] text-neutral-700 py-1">No tags yet. Click + to add a category.</p>
        )}

        {categories.map((cat) => (
          <div key={cat} className="space-y-1.5">
            <div className="flex items-center gap-1 group/cat">
              <MicroTitle className="text-neutral-600">{cat}</MicroTitle>
              <button
                onClick={() => {
                  const next = { ...tags };
                  delete next[cat];
                  persist(next);
                }}
                className="text-neutral-800 hover:text-red-400 opacity-0 group-hover/cat:opacity-100 transition-all ml-1"
                aria-label={`Delete category ${cat}`}
              >
                <X size={9} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {(tags[cat] || []).map((val, idx) => (
                editing?.cat === cat && editing?.idx === idx ? (
                  <input
                    key={idx}
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    className="h-6 px-2 rounded border border-white/20 bg-neutral-800/60 text-xs text-neutral-200 focus:outline-none focus:border-white/30"
                    style={{ width: `${Math.max(editValue.length * 7 + 24, 60)}px` }}
                  />
                ) : (
                  <span
                    key={idx}
                    className="group/tag inline-flex items-center gap-1 px-2 h-6 rounded border border-white/[0.08] bg-neutral-800/30 text-xs text-neutral-300 cursor-pointer hover:border-white/20 hover:bg-neutral-800/50 transition-colors"
                    onClick={() => startEdit(cat, idx)}
                    title="Click to edit"
                  >
                    {val}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTag(cat, idx); }}
                      className="text-neutral-700 hover:text-red-400 opacity-0 group-hover/tag:opacity-100 transition-all ml-0.5"
                      aria-label="Remove tag"
                    >
                      <X size={9} />
                    </button>
                  </span>
                )
              ))}

              {/* Inline add input for this category */}
              {addingTo === cat ? (
                <input
                  ref={addRef}
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  onBlur={commitAdd}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd();
                    if (e.key === 'Escape') { setAddingTo(null); setAddValue(''); }
                  }}
                  placeholder="Nova tag..."
                  className="h-6 px-2 rounded border border-white/20 bg-neutral-800/60 text-xs text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-white/30 w-24"
                />
              ) : (
                <button
                  onClick={() => setAddingTo(cat)}
                  className="h-6 px-1.5 rounded border border-dashed border-white/[0.06] text-neutral-700 hover:text-neutral-400 hover:border-white/15 transition-colors"
                  aria-label={`Add tag to ${cat}`}
                >
                  <Plus size={10} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* New category input */}
        {addingCat && (
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={catRef}
              value={catValue}
              onChange={(e) => setCatValue(e.target.value)}
              onBlur={commitCat}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitCat();
                if (e.key === 'Escape') { setAddingCat(false); setCatValue(''); }
              }}
              placeholder="nova_categoria"
              className="h-6 px-2 rounded border border-white/20 bg-neutral-800/60 text-xs text-neutral-400 font-mono placeholder:text-neutral-700 focus:outline-none focus:border-white/30 w-36"
            />
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
