import React, { useEffect, useRef, useState } from 'react';
import { usePluginStore } from '../../store';
import { useBrandSync } from '../../hooks/useBrandSync';
import { useBrandGuidelineLoader } from '../../hooks/useBrandGuidelineLoader';
import { getGuidelineId, getGuidelineLabel } from '../../lib/brandHydration';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Link2, Plus, RefreshCw, BookOpen, Check, X } from 'lucide-react';
import { useBrandImport } from '../../hooks/useBrandImport';
import { NamingGuideModal, PushPreviewModal } from './BrandModals';

export function BrandGuidelineSection() {
  const linkedGuideline = usePluginStore((s) => s.linkedGuideline);
  const { loadBrandGuidelines, saveBrandGuideline, updateBrandGuideline } = useBrandSync();
  const { apply } = useBrandGuidelineLoader();
  const { run: runImport, isImporting } = useBrandImport();

  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const newNameInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const data = await loadBrandGuidelines();
    if (data) {
      setGuidelines(data);
      // Auto-restore: if linkedGuideline is set (from pluginData) but brandGuideline isn't hydrated yet
      const state = usePluginStore.getState();
      if (state.linkedGuideline && !state.brandGuideline) {
        const match = data.find((g: any) => getGuidelineId(g) === state.linkedGuideline);
        if (match) {
          apply(match, { silent: true });
          usePluginStore.setState({ useBrand: true });
        }
      }
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectGuideline = (id: string) => {
    const guideline = guidelines.find((g) => getGuidelineId(g) === id);
    if (guideline) {
      apply(guideline);
      parent.postMessage({
        pluginMessage: {
          type: 'SAVE_BRAND_GUIDELINE',
          selectedId: id,
          guideline: JSON.stringify(guideline),
        },
      }, 'https://www.figma.com');
    }
  };

  const handleCreateNew = async () => {
    if (!isCreating) {
      setIsCreating(true);
      setNewName('');
      setTimeout(() => newNameInputRef.current?.focus(), 50);
      return;
    }
    const name = newName.trim();
    if (!name) { setIsCreating(false); return; }
    setLoading(true);
    setIsCreating(false);
    const created = await saveBrandGuideline({ identity: { name } } as any);
    if (created) {
      apply(created, { silent: true });
      const createdId = getGuidelineId(created);
      if (createdId) {
        parent.postMessage({
          pluginMessage: {
            type: 'SAVE_BRAND_GUIDELINE',
            selectedId: createdId,
            guideline: JSON.stringify(created),
          },
        }, 'https://www.figma.com');
      }
    }
    await refresh();
    setLoading(false);
    setNewName('');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex gap-2">
          {guidelines.length > 0 && !isCreating && (
            <Select
              options={guidelines.map((g) => ({ value: getGuidelineId(g)!, label: getGuidelineLabel(g) }))}
              value={linkedGuideline || ''}
              onChange={(value) => handleSelectGuideline(value as string)}
              variant="node"
              placeholder="Select a guideline..."
              className="flex-1"
            />
          )}
          {isCreating && (
            <input
              ref={newNameInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNew(); if (e.key === 'Escape') setIsCreating(false); }}
              placeholder="Guideline name..."
              className="flex-1 h-8 px-2 text-xs bg-white/5 border border-white/10 rounded outline-none focus:border-brand-cyan"
            />
          )}
          {isCreating ? (
            <>
              <Button onClick={handleCreateNew} variant="outline" size="sm" className="h-8" disabled={!newName.trim()}>
                <Check size={14} />
              </Button>
              <Button onClick={() => setIsCreating(false)} variant="ghost" size="sm" className="h-8">
                <X size={14} />
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleCreateNew} variant="outline" size="sm" className="h-8" disabled={loading}>
                <Plus size={14} className="mr-2" />
                New
              </Button>
              <Button onClick={refresh} variant="ghost" size="sm" className="h-8">
                <RefreshCw size={14} />
              </Button>
            </>
          )}
        </div>

        {guidelines.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No guidelines yet. Create one to get started.</p>
        )}

        {linkedGuideline && (
          <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded px-3 py-1.5 text-[10px]">
            <span className="text-neutral-500 font-mono uppercase tracking-wider">Linked Workspace Active</span>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-brand-cyan hover:bg-brand-cyan/10 uppercase tracking-widest text-[8px] font-bold"
                onClick={() => setPushOpen(true)}
              >
                Push to Cloud
              </Button>
              <Link2 size={12} className="text-brand-cyan ml-1" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] text-neutral-500 leading-snug">
          Matches by naming: <code className="text-[10px] text-neutral-400">primary/500</code>...
        </p>
        <button 
          onClick={() => setGuideOpen(true)}
          className="text-[9px] font-bold text-brand-cyan uppercase tracking-widest hover:underline flex items-center gap-1"
        >
          <BookOpen size={10} />
          See Guide
        </button>
      </div>

      <NamingGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <PushPreviewModal 
        isOpen={pushOpen} 
        onClose={() => setPushOpen(false)} 
        changes={{
          colors: Array.from(usePluginStore.getState().selectedColors.values()),
          typography: usePluginStore.getState().typography,
          logos: usePluginStore.getState().logos
        }}
        onPush={async (selected) => {
          const store = usePluginStore.getState();
          const patch: any = {};
          if (selected.includes('colors')) patch.colors = Array.from(store.selectedColors.values());
          if (selected.includes('typography')) patch.typography = store.typography;
          if (selected.includes('logos')) patch.logos = store.logos;
          
          if (linkedGuideline) {
            await updateBrandGuideline(linkedGuideline, patch);
          }
          setPushOpen(false);
        }}
      />
    </div>
  );
}
