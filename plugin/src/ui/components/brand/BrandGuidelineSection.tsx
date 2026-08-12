import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { useBrandSync } from '../../hooks/useBrandSync';
import { useBrandGuidelineLoader } from '../../hooks/useBrandGuidelineLoader';
import { getGuidelineId, getGuidelineLabel } from '../../lib/brandHydration';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Plus, RefreshCw, BookOpen, Check, X, LayoutTemplate } from 'lucide-react';
import { useBrandImport } from '../../hooks/useBrandImport';
import { NamingGuideModal, PushPreviewModal } from './BrandModals';
import { useClient } from '../../lib/ClientProvider';
import { useApi } from '../../hooks/useApi';

export function BrandGuidelineSection() {
  const { t } = useTranslation();
  const linkedGuideline = usePluginStore((s) => s.linkedGuideline);
  const { loadBrandGuidelines, saveBrandGuideline, updateBrandGuideline } = useBrandSync();
  const { apply, clear } = useBrandGuidelineLoader();
  const { run: runImport, isImporting } = useBrandImport();

  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const refreshingRef = useRef(false);

  // Template SYNC: parse the page's [Template] frames → POST schemas → webapp preview.
  const client = useClient();
  const { call } = useApi();
  const showToast = usePluginStore((s) => s.showToast);
  const [syncing, setSyncing] = useState(false);

  const handleSyncTemplates = async () => {
    if (!linkedGuideline || syncing) return;
    setSyncing(true);
    try {
      const res: any = await client.request('templates.extractSchema', {});
      const templates = res?.templates ?? [];
      if (!templates.length) {
        showToast(t('plugin.brand.guideline.noTemplateOnPage'), 'error');
        return;
      }
      await call(`/api/brand-guidelines/${linkedGuideline}/synced-templates`, {
        method: 'POST',
        body: JSON.stringify({ templates }),
      });
      showToast(
        t('plugin.brand.guideline.templatesSynced', { count: templates.length }),
        'success'
      );
    } catch {
      showToast(t('plugin.brand.guideline.syncFailed'), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const refresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const data = await loadBrandGuidelines();
      if (data) {
        setGuidelines(data);
        const state = usePluginStore.getState();
        if (state.linkedGuideline && !state.brandGuideline) {
          const match = data.find((g: any) => getGuidelineId(g) === state.linkedGuideline);
          if (match) {
            apply(match, { silent: true });
            usePluginStore.setState({ useBrand: true });
          }
        }
      }
    } finally {
      refreshingRef.current = false;
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
      parent.postMessage(
        {
          pluginMessage: {
            type: 'SAVE_BRAND_GUIDELINE',
            selectedId: id,
            guideline: JSON.stringify(guideline),
          },
        },
        'https://www.figma.com'
      );
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
    if (!name) {
      setIsCreating(false);
      return;
    }
    setLoading(true);
    setIsCreating(false);
    const created = await saveBrandGuideline({ identity: { name } } as any);
    if (created) {
      apply(created, { silent: true });
      const createdId = getGuidelineId(created);
      if (createdId) {
        parent.postMessage(
          {
            pluginMessage: {
              type: 'SAVE_BRAND_GUIDELINE',
              selectedId: createdId,
              guideline: JSON.stringify(created),
            },
          },
          'https://www.figma.com'
        );
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
            <div className="flex-1 group/gl relative">
              <Select
                options={guidelines.map((g) => {
                  const colors = Array.isArray(g.colors) ? (g.colors as any[]) : [];
                  const primary = colors.find((c: any) => c?.role === 'primary') || colors[0];
                  const swatch = primary?.hex ? (
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: primary.hex }}
                    />
                  ) : (
                    <span className="w-3 h-3 rounded-full shrink-0 bg-muted border border-border" />
                  );
                  return { value: getGuidelineId(g)!, label: getGuidelineLabel(g), icon: swatch };
                })}
                value={linkedGuideline || ''}
                onChange={(value) => handleSelectGuideline(value as string)}
                variant="node"
                placeholder={t('plugin.brand.guideline.selectPlaceholder')}
                className="w-full"
              />
              {linkedGuideline && (
                <button
                  onClick={() => {
                    clear();
                    parent.postMessage(
                      {
                        pluginMessage: {
                          type: 'SAVE_BRAND_GUIDELINE',
                          selectedId: null,
                          guideline: null,
                        },
                      },
                      'https://www.figma.com'
                    );
                  }}
                  className="absolute right-6 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover/gl:opacity-100 transition-opacity bg-muted hover:bg-muted text-muted-foreground hover:text-foreground z-10"
                  title={t('plugin.brand.guideline.disconnect')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          {isCreating && (
            <input
              ref={newNameInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateNew();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              placeholder={t('plugin.brand.guideline.namePlaceholder')}
              className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded outline-none focus:border-brand-cyan"
            />
          )}
          {isCreating ? (
            <>
              <Button
                onClick={handleCreateNew}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={!newName.trim()}
              >
                <Check size={14} />
              </Button>
              <Button
                onClick={() => setIsCreating(false)}
                variant="ghost"
                size="sm"
                className="h-8"
              >
                <X size={14} />
              </Button>
            </>
          ) : (
            <>
              {!linkedGuideline && (
                <Button
                  onClick={handleCreateNew}
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={loading}
                >
                  <Plus size={14} className="mr-2" />
                  {t('plugin.brand.guideline.new')}
                </Button>
              )}
              <Button
                onClick={refresh}
                variant="ghost"
                size="sm"
                className="h-8"
                aria-label={t('plugin.brand.guideline.refresh')}
              >
                <RefreshCw size={14} />
              </Button>
              {linkedGuideline && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-brand-cyan hover:bg-brand-cyan/10 text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => setPushOpen(true)}
                >
                  {t('plugin.brand.guideline.push')}
                </Button>
              )}
              {linkedGuideline && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-brand-cyan hover:bg-brand-cyan/10 text-[10px] font-bold uppercase tracking-wider"
                  onClick={handleSyncTemplates}
                  disabled={syncing}
                  aria-label={t('plugin.brand.guideline.syncAria')}
                  title={t('plugin.brand.guideline.syncTitle')}
                >
                  {syncing ? (
                    <GlitchLoader size={12} />
                  ) : (
                    <LayoutTemplate size={13} className="mr-1" />
                  )}
                  {t('plugin.brand.guideline.sync')}
                </Button>
              )}
            </>
          )}
        </div>

        {guidelines.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t('plugin.brand.guideline.empty')}
          </p>
        )}
      </div>

      <button
        onClick={() => setGuideOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-1 text-[8px] text-muted-foreground/70 hover:text-muted-foreground transition-colors uppercase tracking-widest"
      >
        <BookOpen size={9} />
        {t('plugin.brand.guideline.namingGuide')}
      </button>

      <NamingGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <PushPreviewModal
        isOpen={pushOpen}
        onClose={() => setPushOpen(false)}
        changes={{
          colors: Array.from(usePluginStore.getState().selectedColors.values()),
          typography: usePluginStore.getState().typography,
          logos: usePluginStore.getState().logos,
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
