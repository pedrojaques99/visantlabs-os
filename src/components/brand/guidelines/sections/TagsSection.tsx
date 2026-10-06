import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Tag, Plus, X } from '@/lib/ui/icons';
import type { BrandGuideline } from '@/lib/figma-types';

interface TagsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type Tags = Record<string, string[]>;
type Editing = { cat: string; idx: number } | null;

export const TagsSection: React.FC<TagsSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
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

  const persist = useCallback(
    (next: Tags) => {
      onUpdate({ tags: next });
    },
    [onUpdate]
  );

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (addingTo) addRef.current?.focus();
  }, [addingTo]);
  useEffect(() => {
    if (addingCat) catRef.current?.focus();
  }, [addingCat]);

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
      next[cat] = next[cat].map((v, i) => (i === idx ? trimmed : v));
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
      title={t('brandEditor.tags')}
      span={span as any}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          onClick={() => setAddingCat(true)}
          aria-label={t('brandEditor.addCategory')}
        >
          <Plus size={11} />
        </Button>
      }
    >
      <div className="space-y-3 py-1">
        {categories.length === 0 && !addingCat && (
          <p className="text-2xs text-muted-foreground/50 py-1">{t('brandEditor.noTagsAdd')}</p>
        )}

        {categories.map((cat) => (
          <div key={cat} className="space-y-1.5">
            <div className="flex items-center gap-1 group/cat">
              <MicroTitle className="text-muted-foreground/70">{cat}</MicroTitle>
              <button
                onClick={() => {
                  const next = { ...tags };
                  delete next[cat];
                  persist(next);
                }}
                className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/cat:opacity-100 transition-[color,background-color,border-color,opacity] ml-1"
                aria-label={t('brandEditor.deleteCategory', { name: cat })}
              >
                <X size={9} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {(tags[cat] || []).map((val, idx) =>
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
                    className="h-6 px-2 rounded border border-border-hover bg-muted text-xs text-foreground focus:outline-none focus:border-ring"
                    style={{ width: `${Math.max(editValue.length * 7 + 24, 60)}px` }}
                  />
                ) : (
                  <span
                    key={idx}
                    className="group/tag inline-flex items-center gap-1 px-2 h-6 rounded border border-border bg-muted text-xs text-foreground cursor-pointer hover:border-border-hover hover:bg-accent transition-colors"
                    onClick={() => startEdit(cat, idx)}
                    title={t('brandEditor.clickToEdit')}
                  >
                    {val}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTag(cat, idx);
                      }}
                      className="text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/tag:opacity-100 transition-[color,background-color,border-color,opacity] ml-0.5"
                      aria-label={t('brandEditor.removeTag')}
                    >
                      <X size={9} />
                    </button>
                  </span>
                )
              )}

              {/* Inline add input for this category */}
              {addingTo === cat ? (
                <input
                  ref={addRef}
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  onBlur={commitAdd}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd();
                    if (e.key === 'Escape') {
                      setAddingTo(null);
                      setAddValue('');
                    }
                  }}
                  placeholder={t('brandEditor.newTag')}
                  className="h-6 px-2 rounded border border-border-hover bg-muted text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring w-24"
                />
              ) : (
                <button
                  onClick={() => setAddingTo(cat)}
                  className="h-6 px-1.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border-hover transition-colors"
                  aria-label={t('brandEditor.addTagTo', { name: cat })}
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
                if (e.key === 'Escape') {
                  setAddingCat(false);
                  setCatValue('');
                }
              }}
              placeholder={t('brandEditor.newCategory')}
              className="h-6 px-2 rounded border border-border-hover bg-muted text-xs text-muted-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-ring w-36"
            />
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
