import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CreativeStudio } from '@/components/creative/CreativeStudio';
import { creativeProjectApi } from '@/services/creativeProjectApi';
import { loadCreativeIntoStore } from '@/components/creative/lib/persistCreative';
import { useCreativeStore } from '@/components/creative/store/creativeStore';
import { PageShell } from '@/components/ui/PageShell';
import { useTranslation } from '@/hooks/useTranslation';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';

export const CreatePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation();
  const projectId = params.get('project');
  const brandIdParam = params.get('brandId');
  const { activeBrand } = useActiveBrand();
  const loadedRef = useRef<string | null>(null);
  const currentCreativeId = useCreativeStore((s) => s.creativeId);
  const projectName = useCreativeStore((s) => s.projectName);
  const setBrandId = useCreativeStore((s) => s.setBrandId);

  // Pre-select brand: explicit ?brandId= wins; otherwise, when opening a fresh
  // studio (no project), fall back to the globally active brand so arriving from
  // the cockpit still carries the brand's tokens instead of a blank canvas.
  useEffect(() => {
    if (brandIdParam) setBrandId(brandIdParam);
    else if (!projectId && activeBrand?.id) setBrandId(activeBrand.id);
  }, [brandIdParam, projectId, activeBrand?.id, setBrandId]);

  useEffect(() => {
    // 1. Sync Store -> URL: Only when no projectId in URL (don't override intentional navigation)
    const isPersisted = currentCreativeId && currentCreativeId.length === 24;
    if (!projectId && isPersisted) {
      setParams({ project: currentCreativeId }, { replace: true });
      loadedRef.current = currentCreativeId;
      return;
    }

    // 2. Sync URL -> Store: If we have a projectId in URL but store doesn't have it
    if (!projectId) return;

    // If the store already has this exact ID, no need to reload
    if (currentCreativeId === projectId) {
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
        // Projeto carregado = baseline do undo; não deixar desfazer pro vazio.
        useCreativeStore.temporal.getState().clear();
      })
      .catch((err: Error) => {
        toast.error(err.message || t('createPage.loadFailed'));
        setParams({}, { replace: true });
        loadedRef.current = null;
      });
  }, [projectId, currentCreativeId, setParams]);

  return (
    <PageShell
      pageId="creative-studio"
      title={projectName || t('creative.projects.studio')}
      width="full"
      noBackground
      seoTitle={projectName || t('creative.projects.studio')}
      seoDescription={t('createPage.seoDescription')}
      breadcrumb={[
        { label: t('apps.home'), to: '/' },
        { label: t('creative.projects.title'), to: '/create/projects' },
        { label: t('creative.projects.studio') },
      ]}
      hideHeader
      // p-0 sozinho NÃO zera os paddings responsivos do PageShell
      // (sm:px-6 lg:px-8 sm:pt-8 sm:pb-16 vencem um p-0 base) → sobra 32px de
      // margem/topo e o rodapé corta. O Creative Studio é full-bleed e gere a
      // própria altura, então zeramos em todos os breakpoints.
      // `dark`: o Creative Studio é sempre escuro; escopa os tokens escuros na subárvore.
      contentClassName="p-0 sm:p-0 lg:p-0 dark text-foreground"
    >
      <CreativeStudio />
    </PageShell>
  );
};
