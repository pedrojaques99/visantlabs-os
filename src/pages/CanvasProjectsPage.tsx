import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { canvasApi, type CanvasProject } from '../services/canvasApi';
import { useLayout } from '@/hooks/useLayout';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { PageShell } from '../components/ui/PageShell';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { toast } from 'sonner';
import {
  FolderKanban,
  Calendar,
  Eye,
  Trash2,
  Plus,
  Pickaxe,
  FolderOpen,
  FileJson,
  Search,
  Globe,
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { SearchBar } from '../components/ui/SearchBar';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, OutputNodeData, ImageNodeData } from '../types/reactFlow';
import { getImageUrl } from '@/utils/imageUtils';
import { WorkflowLibraryModal } from '../components/WorkflowLibraryModal';
import { WorkflowCard } from '../components/WorkflowCard';
import { type CanvasWorkflow, workflowApi } from '../services/workflowApi';
import { validateVisantJson, readJsonFile } from '@/utils/canvas/canvasJsonExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateShort } from '@/utils/localeUtils';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';

// Helper function to get project thumbnail
const getProjectThumbnail = (project: CanvasProject): string | null => {
  if (!project.nodes || !Array.isArray(project.nodes)) return null;

  const nodes = project.nodes as Node<FlowNodeData>[];

  // Priority: OutputNode > ImageNode > other nodes with images
  const outputNode = nodes.find((n) => n.type === 'output') as Node<OutputNodeData> | undefined;
  if (outputNode) {
    const outputData = outputNode.data as OutputNodeData;
    if (outputData.resultImageUrl) return outputData.resultImageUrl;
    if (outputData.resultImageBase64) {
      return outputData.resultImageBase64.startsWith('data:')
        ? outputData.resultImageBase64
        : `data:image/png;base64,${outputData.resultImageBase64}`;
    }
  }

  const imageNode = nodes.find((n) => n.type === 'image') as Node<ImageNodeData> | undefined;
  if (imageNode) {
    const imageData = imageNode.data as ImageNodeData;
    if (imageData.mockup) {
      const imageUrl = getImageUrl(imageData.mockup);
      if (imageUrl) return imageUrl;
      if (imageData.mockup.imageBase64) {
        return imageData.mockup.imageBase64.startsWith('data:')
          ? imageData.mockup.imageBase64
          : `data:image/png;base64,${imageData.mockup.imageBase64}`;
      }
    }
  }

  for (const node of nodes) {
    const nodeData = node.data as any;
    if (nodeData.resultImageUrl) return nodeData.resultImageUrl;
    if (nodeData.resultImageBase64) {
      return nodeData.resultImageBase64.startsWith('data:')
        ? nodeData.resultImageBase64
        : `data:image/png;base64,${nodeData.resultImageBase64}`;
    }
  }

  return null;
};

export const CanvasProjectsPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const editingInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedProjectsRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // Filtro opcional pela marca ativa (default global; um clique escopa) — o
  // canvas é produção mas a lista é global; o chip reconcilia com o topbar.
  // A lista segue a MARCA ATIVA do BrandSwitcher (SSoT). null = "Todas as
  // marcas" → sem filtro. Unifica o antigo BrandFilterChip no switcher do header.
  const { activeBrandId: brandId } = useActiveBrand();

  const isLoadingRef = useRef(false);
  const [showWorkflowLibrary, setShowWorkflowLibrary] = useState(false);
  const [isAdmin] = useState(false);

  // Community workflows surfaced inline (same source as the library modal's
  // COMMUNITY tab). The user links their active brand and runs a ready-made
  // workflow — "mostrar workflows da comunidade" direto na página, sem modal.
  const [communityWorkflows, setCommunityWorkflows] = useState<CanvasWorkflow[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await workflowApi.getPublic();
        if (!cancelled) setCommunityWorkflows(data);
      } catch (err) {
        console.error('[CanvasProjects] community workflows load failed:', err);
      } finally {
        if (!cancelled) setLoadingCommunity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCommunityLike = async (workflowId: string) => {
    if (!isAuthenticated) {
      toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
      return;
    }
    try {
      const liked = await workflowApi.toggleLike(workflowId);
      setCommunityWorkflows((prev) =>
        prev.map((w) =>
          w._id === workflowId
            ? {
                ...w,
                isLikedByUser: liked,
                likesCount: liked ? w.likesCount + 1 : w.likesCount - 1,
              }
            : w
        )
      );
    } catch (err) {
      console.error('Error toggling like:', err);
      toast.error(t('workflows.errors.failedToToggleLike') || 'Failed to toggle like');
    }
  };

  const handleCommunityDuplicate = async (workflowId: string) => {
    if (!isAuthenticated) {
      toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
      return;
    }
    try {
      await workflowApi.duplicate(workflowId);
      toast.success(t('workflows.messages.duplicated') || 'Workflow added to your library!');
    } catch (err) {
      console.error('Error duplicating workflow:', err);
      toast.error(t('workflows.errors.failedToDuplicate') || 'Failed to duplicate workflow');
    }
  };

  const handleLoadWorkflow = async (workflow: CanvasWorkflow) => {
    try {
      if (!isAuthenticated) {
        toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
        return;
      }
      const newProject = await canvasApi.save(workflow.name, workflow.nodes, workflow.edges);
      toast.success(
        t('workflows.messages.loaded', { name: workflow.name }) ||
          `Workflow loaded: ${workflow.name}`
      );
      navigate(`/canvas/${newProject._id}`);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error(t('workflows.errors.failedToLoad') || 'Failed to load workflow');
    }
  };

  useEffect(() => {
    if (!isLoadingAccess && !hasAccess) {
      navigate('/waitlist', { replace: true });
    }
  }, [hasAccess, isLoadingAccess, navigate]);

  const loadProjects = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setLoadError(false);
    try {
      const data = await canvasApi.getAll();
      setProjects(data);
      hasLoadedProjectsRef.current = true;
    } catch (error: any) {
      console.error('[CanvasProjects] Error loading canvas projects:', error);
      if (error?.status === 401) {
        setShowAuthModal(true);
      } else {
        // A failed load must not fall through to the "no projects yet" empty
        // state — that reads as "your account is empty" (silent-empty lie).
        setLoadError(true);
        toast.error(t('canvas.failedToLoadProjects') || 'Failed to load canvas projects');
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [t]);

  const handleAuthAction = useDebouncedCallback((auth: boolean | null) => {
    if (auth === null || hasLoadedProjectsRef.current || isLoadingRef.current) return;
    if (auth === false) {
      setShowAuthModal(true);
    } else if (auth === true) {
      loadProjects();
    }
  }, 200);

  useEffect(() => {
    handleAuthAction(isAuthenticated);
  }, [isAuthenticated, handleAuthAction]);

  const handleView = (project: CanvasProject) => {
    if (project._id && project._id.trim() !== '') {
      navigate(`/canvas/${project._id}`);
    } else {
      toast.error(t('canvas.invalidProjectId') || 'Invalid project ID');
    }
  };

  const importJsonInputRef = useRef<HTMLInputElement>(null);

  const handleImportJsonClick = useCallback(() => {
    importJsonInputRef.current?.click();
  }, []);

  const handleImportJsonFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      try {
        const raw = await readJsonFile(file);
        if (!validateVisantJson(raw)) {
          toast.error(t('canvas.projects.invalid_file_not_a_visant_canvas_j'));
          return;
        }
        const newProject = await canvasApi.save(
          raw.name,
          raw.nodes,
          raw.edges,
          undefined,
          raw.drawings ?? []
        );
        toast.success(t('canvas.projects.imported_opening', { name: raw.name }));
        navigate(`/canvas/${newProject._id}`);
      } catch (err: any) {
        console.error('JSON import failed:', err);
        toast.error(err?.message || 'Failed to import JSON file.');
      }
    },
    [navigate]
  );

  const handleCreateNew = async () => {
    try {
      // PERSISTED value — never localize. The UI localizes this sentinel at render.
      const newProject = await canvasApi.save('Untitled', [], []);
      navigate(`/canvas/${newProject._id}`);
    } catch (error: any) {
      console.error('[CanvasProjects] Error creating project:', error);
      toast.error(t('canvas.failedToCreateProject') || 'Failed to create new project');
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setDeletingId(projectToDelete);
    try {
      await canvasApi.delete(projectToDelete);
      setProjects((prev) => prev.filter((p) => p._id !== projectToDelete));
      toast.success(t('canvas.projectDeletedSuccessfully') || 'Project deleted successfully');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(t('canvas.failedToDeleteProject') || 'Failed to delete project');
    } finally {
      setDeletingId(null);
      setProjectToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const handleNameEditStart = (project: CanvasProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(project._id);
    // Seeds an input whose value is persisted verbatim by `handleNameEditSave`
    // → must stay the literal sentinel, not `t('canvas.untitled')`.
    setEditingName(project.name || 'Untitled');
    setTimeout(() => {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    }, 0);
  };

  const handleNameEditSave = async (projectId: string) => {
    if (!editingName.trim()) {
      setEditingName('');
      setEditingProjectId(null);
      return;
    }
    const project = projects.find((p) => p._id === projectId);
    if (!project) return;
    const trimmedName = editingName.trim();
    if (trimmedName === project.name) {
      setEditingProjectId(null);
      setEditingName('');
      return;
    }
    try {
      await canvasApi.rename(projectId, trimmedName);
      setProjects((prev) =>
        prev.map((p) => (p._id === projectId ? { ...p, name: trimmedName } : p))
      );
      toast.success(t('canvas.projectNameUpdated'), { duration: 1200 });
    } catch (error: any) {
      console.error('Error updating project name:', error);
      toast.error(t('canvas.failedToUpdateProjectName') || 'Failed to update project name');
    } finally {
      setEditingProjectId(null);
      setEditingName('');
    }
  };

  const handleNameEditCancel = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleNameEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, projectId: string) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      handleNameEditCancel();
    }
  };

  const formatDate = (dateString: string) => formatDateShort(dateString);

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (brandId) {
      result = result.filter((project) => project.linkedGuidelineId === brandId);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((project) => project.name?.toLowerCase().includes(query));
    }
    return result.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [projects, searchQuery, brandId]);

  // Ações secundárias (biblioteca de workflows + importar JSON). Abaixo de `xl`
  // elas saem da espinha e vivem no corpo da página, acima da lista, sempre com
  // label completo. Nenhuma ação some: só muda de lugar.
  //
  // O corte é `xl` (era `sm`) porque quem come a largura da espinha é o RAIL:
  // ele entra em `md` (768px) e leva 240px fixos (`AppSidebar`: `hidden md:flex
  // w-60`). Entre 768 e 1023 a espinha fica com ~496px úteis, e entre 1024 e
  // 1279 com ~737px, contra um grupo direito (busca + ações + pílula de
  // créditos de 205px) que pedia 672px e 847px — daí o estouro medido de +107
  // (820px) e +79 (1024px). O antigo `lg:inline` devolvia os labels em 1024,
  // exatamente onde o rail ainda apertava: os dois breakpoints estavam
  // desalinhados. Agora a espinha só recebe as secundárias onde elas cabem
  // INTEIRAS (`xl`), e a faixa do padrão "secundária no corpo" — já validado no
  // mobile — simplesmente se estende até lá. Sem terceiro comportamento e sem
  // label pela metade.
  const secondaryActions = (
    <>
      <Button
        variant="ghost"
        onClick={() => setShowWorkflowLibrary(true)}
        title={t('workflows.importWorkflow') || 'Library'}
        className="shrink-0 h-10 px-2 sm:px-3 hover:bg-neutral-900/40 text-neutral-400 hover:text-brand-cyan transition-colors rounded-md flex items-center gap-2 text-2xs font-bold uppercase tracking-widest"
      >
        <FolderOpen className="h-4 w-4" />
        <span>{t('workflows.importWorkflow') || 'Library'}</span>
      </Button>

      <Button variant="toolbar" onClick={handleImportJsonClick} title="JSON" className="shrink-0">
        <FileJson className="h-4 w-4" />
        <span>JSON</span>
      </Button>
    </>
  );

  const headerActions = (
    // A espinha é estreita no mobile E na faixa em que o rail já entrou mas a
    // janela ainda é curta: abaixo de `lg` sobram só a busca e o CTA. As
    // secundárias vão pro corpo (ver secondaryActions).
    <div className="flex items-center gap-1 sm:gap-3">
      {/* Search de projetos: expande INLINE dentro do header (não é popup
          flutuante); colapsa ao sair vazio. Fica visualmente distinto do
          Cmd+K global da espinha (que é navegação, não filtro de lista). */}
      {/* Largura do campo ABERTO. Era `sm:flex-none sm:w-[200px] md:w-[240px]`:
          largura fixa E `flex-none` (= `flex: none`, shrink 0), ou seja o campo
          crescia justo onde o rail tirava 240px e ainda se recusava a ceder.
          Aberto, a busca sozinha estourava a espinha em +76 (820px), +111
          (1024px) e +31 (1280px) — o mesmo defeito de faixa, latente porque a
          medição padrão pega o campo colapsado.
          Agora a largura acompanha o rail (encolhe em `md`, volta a crescer em
          `lg`/`xl`) e `flex-initial` mantém o shrink ligado como válvula: se
          faltar espaço, quem cede é o filtro — nunca uma ação nem a pílula de
          créditos, que seguem `shrink-0`. */}
      {showSearch ? (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('canvas.searchProjects') || 'Buscar projetos...'}
          iconSize={14}
          className="h-10 bg-neutral-900/40 border-white/10 text-xs font-mono"
          containerClassName="min-w-0 flex-1 max-w-[8.5rem] sm:flex-initial sm:max-w-none sm:w-[180px] md:w-[140px] lg:w-[180px] xl:w-[200px]"
          autoFocus
          onBlur={() => {
            if (!searchQuery.trim()) setShowSearch(false);
          }}
        />
      ) : (
        <Button
          variant="ghost"
          onClick={() => setShowSearch(true)}
          className="shrink-0 p-1.5 sm:p-2 text-neutral-500 hover:text-brand-cyan transition-colors rounded-md hover:bg-neutral-900/40"
          title={t('canvas.searchProjects') || 'Buscar projetos'}
        >
          <Search size={18} />
        </Button>
      )}

      <div className="h-6 w-[1px] bg-neutral-800/60 mx-1 hidden md:block" />

      <div className="hidden xl:contents">{secondaryActions}</div>

      {/* CTA: o label segue a MESMA lógica do rail. Aparece em `sm` (640–767,
          sem rail, janela inteira disponível), some em `md` (768–1023, onde o
          rail já levou 240px e a espinha ficou com ~496px) e volta em `lg`.
          Sem label o botão é ícone + `title` — o padrão já validado no mobile,
          não um terceiro comportamento. */}
      <Button
        variant="brand"
        onClick={handleCreateNew}
        title={t('canvas.newProject') || 'New Project'}
        className="shrink-0 h-10 px-2 sm:px-6 md:px-2 lg:px-6 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-bold uppercase tracking-widest text-2xs rounded-md transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline md:hidden lg:inline">
          {t('canvas.newProject') || 'New Project'}
        </span>
      </Button>

      <Input
        ref={importJsonInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportJsonFileChange}
      />
    </div>
  );

  if (isLoadingAccess || isLoading) {
    return (
      <PageShell
        pageId="canvas-projects-loading"
        title={t('canvas.projects.title') || 'Projects'}
        microTitle="Canvas // Workspace"
        description={t('canvas.projects.manage_your_visual_canvas_projects')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-neutral-900 border border-neutral-800/60 rounded-md p-6 md:p-8"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <SkeletonLoader height="12rem" className="w-full rounded-md mb-4" />
              <div className="flex items-center gap-2 mb-2">
                <SkeletonLoader height="1.25rem" className="w-5 rounded" />
                <SkeletonLoader height="1.5rem" className="flex-1" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <SkeletonLoader height="0.875rem" className="w-3.5 rounded" />
                <SkeletonLoader height="0.875rem" className="w-24" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonLoader height="2.5rem" className="flex-1 rounded-md" />
                <SkeletonLoader height="2.5rem" className="w-12 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!hasAccess) return null;

  const countStr = (() => {
    const count = filteredProjects.length;
    const total = projects.length;
    const isSingular = count === 1;
    if (searchQuery.trim()) {
      return locale === 'pt-BR'
        ? `${count} de ${total} ${isSingular ? 'projeto' : 'projetos'} encontrados`
        : `${count} of ${total} ${isSingular ? 'project' : 'projects'} found`;
    } else {
      return locale === 'pt-BR'
        ? `Gerencie ${count} ${isSingular ? 'projeto' : 'projetos'}`
        : `Manage ${count} ${isSingular ? 'project' : 'projects'}`;
    }
  })();

  return (
    <PageShell
      pageId="canvas-projects"
      seoTitle={t('canvas.seoTitle') || 'Canvas Editor'}
      seoDescription={t('canvas.seoDescription') || 'Editor visual baseado em fluxos.'}
      title={t('canvas.projects.title') || 'Projects'}
      microTitle="Canvas // Workspace"
      description={countStr}
      breadcrumb={[
        { label: t('apps.home') || 'Home', to: '/' },
        { label: t('canvas.title') || 'Canvas', to: '/canvas' },
        { label: t('canvas.projects.title') || 'Projects' },
      ]}
      actions={headerActions}
      noBackground
    >
      <div className="relative z-10">
        {/* Secundárias abaixo de `xl` — mesmas ações da espinha, só
            reposicionadas (ver secondaryActions: o corte acompanha o rail). */}
        <div className="flex xl:hidden items-center gap-2 mb-4">{secondaryActions}</div>

        {loadError && projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <FolderKanban size={64} className="text-destructive/60 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-400 mb-2">
              {t('canvas.loadFailedTitle')?.toUpperCase() || 'COULD NOT LOAD PROJECTS'}
            </h2>
            <p className="text-sm text-neutral-500 font-mono mb-6">
              {t('canvas.loadFailedBody') ||
                'Something went wrong loading your projects. Your work is safe — try again.'}
            </p>
            <Button
              variant="ghost"
              onClick={loadProjects}
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 hover:border-neutral-600 font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              {t('common.retry') || 'Try Again'}
            </Button>
          </div>
        ) : filteredProjects.length === 0 && projects.length > 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <FolderKanban size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
              {t('canvas.noProjectsFound')?.toUpperCase() || 'NO PROJECTS FOUND'}
            </h2>
            <p className="text-sm text-neutral-600 font-mono mb-6">
              {searchQuery.trim()
                ? t('canvas.noProjectsMatchSearch') || 'No projects match your search query.'
                : t('canvas.noProjectsForBrand') ||
                  'No canvas projects are linked to the active brand.'}
            </p>
            {searchQuery.trim() ? (
              <Button
                variant="ghost"
                onClick={() => setSearchQuery('')}
                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-neutral-600 font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                {t('canvas.clearSearch') || 'Clear Search'}
              </Button>
            ) : (
              // Sem busca ativa, "nenhum encontrado" não pode ser um beco sem
              // saída — o dono desta marca ainda pode criar o primeiro projeto
              // dela aqui, mesma ação do header.
              <Button
                variant="brand"
                onClick={handleCreateNew}
                className="px-6 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2"
              >
                <Pickaxe className="h-4 w-4" />
                {t('canvas.createFirstProjectButton') || 'Create Your First Project'}
              </Button>
            )}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <FolderKanban size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
              {t('canvas.noProjectsYet')?.toUpperCase() || 'NO PROJECTS YET'}
            </h2>
            <p className="text-sm text-neutral-600 font-mono mb-6">
              {t('canvas.createFirstProject') ||
                'Create your first canvas project to start working with nodes.'}
            </p>
            <Button
              variant="brand"
              onClick={handleCreateNew}
              className="px-6 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2"
            >
              <Pickaxe className="h-4 w-4" />
              {t('canvas.createFirstProjectButton') || 'Create Your First Project'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredProjects.map((project) => {
              const nodeCount = Array.isArray(project.nodes) ? project.nodes.length : 0;
              const edgeCount = Array.isArray(project.edges) ? project.edges.length : 0;
              const thumbnail = getProjectThumbnail(project);

              return (
                <div
                  key={project._id}
                  className="bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/60 rounded-xl p-5 hover:border-neutral-700 transition-[color,background-color,border-color,box-shadow,filter] duration-500 group cursor-pointer overflow-hidden shadow-xl"
                  onClick={() => {
                    if (editingProjectId !== project._id) {
                      handleView(project);
                    }
                  }}
                >
                  <div className="relative w-full h-48 mb-6 rounded-lg overflow-hidden bg-neutral-900/50 border border-neutral-800/60">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.name || 'Project preview'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderKanban className="h-10 w-10 text-neutral-800" strokeWidth={1} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {editingProjectId === project._id ? (
                          <Input
                            ref={editingInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleNameEditSave(project._id)}
                            onKeyDown={(e) => handleNameEditKeyDown(e, project._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 font-bold text-neutral-200 font-manrope text-lg bg-transparent border-b border-brand-cyan/40 focus:border-neutral-600 focus:outline-none px-1 h-auto py-0"
                          />
                        ) : (
                          <h3
                            className="font-bold text-neutral-200 font-manrope text-lg line-clamp-1 cursor-text group-hover:text-brand-cyan transition-colors"
                            onClick={(e) => handleNameEditStart(project, e)}
                            title={t('canvas.clickToEdit') || 'Click to edit'}
                          >
                            {/* `'Untitled'` is the literal the backend persists as the
                                default project name — it is a sentinel, not user text,
                                so it gets localized on RENDER only. `project.name` keeps
                                the literal (rename/export still round-trip it). */}
                            {!project.name || project.name === 'Untitled'
                              ? t('canvas.untitled')
                              : project.name}
                          </h3>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-2 text-2xs text-neutral-500 font-mono mb-4 uppercase tracking-widest"
                        title={`${t('canvas.lastEdited')}: ${formatDate(
                          project.updatedAt || project.createdAt
                        )}`}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(project.updatedAt || project.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-2xs text-neutral-500 font-mono mb-6 uppercase tracking-widest opacity-60 min-h-[1.25rem]">
                    {nodeCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
                      </span>
                    )}
                    {edgeCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                        {edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(project);
                      }}
                      className="flex-1 h-10 bg-white/5 border border-white/10 hover:border-neutral-700 hover:bg-brand-cyan/10 hover:text-brand-cyan rounded-lg text-xs font-bold uppercase tracking-wider text-neutral-400 transition-[color,background-color,border-color,opacity] duration-300 flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      {t('canvas.open') || 'Open'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(project._id, e)}
                      disabled={deletingId === project._id}
                      className="w-10 h-10 bg-white/5 border border-white/10 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive rounded-lg text-neutral-500 transition-[color,background-color,border-color,opacity] duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Community workflows — link your brand, run a ready-made workflow ── */}
      <section
        className="relative z-10 mt-16 pt-10 border-t border-neutral-800/60"
        data-vsn-region="community-workflows"
      >
        <div className="flex items-end justify-between gap-4 mb-6">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
              <Globe size={16} className="text-neutral-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-200">
                {t('canvas.community.title')}
              </h2>
              <p className="text-xs text-neutral-600 font-mono mt-0.5">
                {t('canvas.community.subtitle')}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setShowWorkflowLibrary(true)}
            className="shrink-0 h-9 px-3 text-2xs font-bold uppercase tracking-widest text-neutral-500 hover:text-brand-cyan"
          >
            {t('canvas.community.viewAll')}
          </Button>
        </div>

        {loadingCommunity ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonLoader key={i} height="14rem" className="w-full rounded-md" />
            ))}
          </div>
        ) : communityWorkflows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {communityWorkflows.slice(0, 8).map((workflow) => (
              <WorkflowCard
                key={workflow._id}
                workflow={workflow}
                onClick={() => handleLoadWorkflow(workflow)}
                onToggleLike={() => handleCommunityLike(workflow._id)}
                onDuplicate={() => handleCommunityDuplicate(workflow._id)}
                isAuthenticated={isAuthenticated === true}
                canEdit={false}
                t={t}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2 rounded-xl border border-dashed border-neutral-800/60">
            <Globe size={28} className="text-neutral-700" strokeWidth={1.2} />
            <p className="text-xs text-neutral-600 font-mono">{t('canvas.community.empty')}</p>
          </div>
        )}
      </section>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={async () => {
            setShowAuthModal(false);
            hasLoadedProjectsRef.current = false;
            await loadProjects();
          }}
          isSignUp={false}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProjectToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t('canvas.deleteProject') || 'Delete Project'}
        message={
          t('canvas.deleteProjectMessage') ||
          'Are you sure you want to delete this project? This action cannot be undone.'
        }
        confirmText={t('canvas.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        variant="danger"
      />

      <WorkflowLibraryModal
        isOpen={showWorkflowLibrary}
        onClose={() => setShowWorkflowLibrary(false)}
        onLoadWorkflow={handleLoadWorkflow}
        isAuthenticated={isAuthenticated === true}
        isAdmin={isAdmin}
        t={t}
      />
    </PageShell>
  );
};
