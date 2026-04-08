import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CreativeStudio } from '@/components/creative/CreativeStudio';
import { creativeProjectApi } from '@/services/creativeProjectApi';
import { loadCreativeIntoStore } from '@/components/creative/lib/persistCreative';
import { useCreativeStore } from '@/components/creative/store/creativeStore';
import { PageShell } from '@/components/ui/PageShell';
import { useTranslation } from '@/hooks/useTranslation';

export const CreatePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation();
  const projectId = params.get('project');
  const loadedRef = useRef<string | null>(null);
  const currentCreativeId = useCreativeStore((s) => s.creativeId);
  const projectName = useCreativeStore((s) => s.projectName);

  useEffect(() => {
    // 1. Sync Store -> URL: If we have a persisted ID in store but not in URL, update URL
    const isPersisted = currentCreativeId && currentCreativeId.length === 24;
    if (isPersisted && projectId !== currentCreativeId) {
      setParams({ project: currentCreativeId }, { replace: true });
      loadedRef.current = currentCreativeId;
      return;
    }

    // 2. Sync URL -> Store: If we have a projectId in URL but store doesn't have it (and isn't a new generation)
    if (!projectId) return;
    
    // If the store already has this ID or is currently in a "new generation" state (creative_...), don't overwrite it
    if (currentCreativeId === projectId || (currentCreativeId && currentCreativeId.startsWith('creative_'))) {
      loadedRef.current = projectId;
      return;
    }

    // Only load if we haven't loaded THIS specific projectId in this session
    if (loadedRef.current === projectId) return;

    loadedRef.current = projectId;
    creativeProjectApi
      .get(projectId)
      .then((project) => {
        loadCreativeIntoStore(project);
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Failed to load creative');
        setParams({}, { replace: true });
        loadedRef.current = null;
      });
  }, [projectId, currentCreativeId, setParams]);

  return (
    <PageShell
      pageId="creative-studio"
      title={projectName || t('creative.studio.title') || "Creative Studio"}
      width="full"
      noBackground
      seoTitle={`${projectName || 'Creative Studio'} | Visant Studio`}
      seoDescription="Professional AI-driven design studio for brand-aware creative generation."
      breadcrumb={[
        { label: t('apps.home') || 'Home', to: '/' },
        { label: t('canvas.title') || 'Canvas', to: '/canvas' },
        { label: 'Creative Studio' }
      ]}
      hideHeader
      contentClassName="p-0"
    >
      <CreativeStudio />
    </PageShell>
  );
};
