// TODO: dívida herdada do AdminChat original (não corrigida nesta passada
// para não expandir o escopo):
// - O backdrop do modal é feito à mão (`fixed inset-0 ... bg-black/40`)
//   em vez do componente `Modal` canônico — precisa migrar sem perder o modo
//   'panel' (não-modal) que este shell também suporta.
// (i18n das strings hardcoded já resolvido — namespace `chatShell` em src/locales.)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getPreferredImageModel } from '@/utils/modelPreferences';
import { useAutoScrollToBottom } from '@/hooks/chat/useAutoScrollToBottom';
import { useSessionWebSocket, type SessionWsEvent } from '@/hooks/chat/useSessionWebSocket';
import { useTranslation } from '@/hooks/useTranslation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  type ChatSessionApi,
  AdminChatMessage,
  ToolCallRecord,
  PendingBrandKnowledgeApproval,
  PendingCreativePlan,
} from '@/services/adminChatApi';
import {
  X,
  Bot,
  FileText,
  Image as ImageIcon,
  Video,
  Paperclip,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Check,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fileToBase64 } from '@/utils/fileUtils';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import type { AspectRatio, Resolution } from '@/types/types';
import { usePasteImage } from '@/hooks/usePasteImage';
import { toast } from 'sonner';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { useBrandImport } from '@/hooks/queries/useBrandImport';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { Select } from '@/components/ui/select';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import { BrandReadOnlyView } from '@/components/brand/BrandReadOnlyView';
import { CommunityPresetsSidebar } from '@/components/canvas/CommunityPresetsSidebar';
import { Diamond, PanelRightOpen, PanelRightClose, Upload } from 'lucide-react';
import { useLayout } from '@/hooks/useLayout';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { useMediaQuery } from '@/hooks/use-media-query';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { glassSurface } from '@/lib/ui/glass';

/** Copy that differs between chat surfaces (Admin Chat vs Brand Copilot). */
export interface ChatShellStrings {
  /** Label next to the icon at the top of the sidebar. */
  sidebarLabel: string;
  /** First assistant message when no session is loaded yet. */
  welcome: string;
  /** Assistant message shown right after creating a new session. */
  newSession: string;
  /** Assistant message shown when a session loads with no history. */
  sessionLoaded: string;
  /** Assistant message shown after deleting the current session. */
  selectSession: string;
  /** Input placeholder. */
  inputPlaceholder: string;
}

export interface ChatShellProps {
  mode?: 'modal' | 'inline';
  isOpen?: boolean;
  onClose?: () => void;
  /** Session/message API bound to the surface's base path (admin-chat vs copilot). */
  api: ChatSessionApi;
  /** WS path relative to the API base, e.g. `/admin-chat/ws`. */
  wsPath: string;
  /** react-query cache key for the session list (must differ per surface). */
  sessionsQueryKey: string;
  /** Feedback feature tag forwarded to ChatMessage. */
  feature: 'admin-chat' | 'copilot';
  /** Icon at the top of the sidebar. */
  sidebarIcon?: React.ReactNode;
  strings: ChatShellStrings;
  /**
   * First-run empty state: clickable suggestions that fill the input.
   * Shown while the conversation only has the welcome message.
   */
  suggestions?: string[];
  /**
   * Semeia o input na montagem (ex.: comando agêntico do Cmd+K → `/copilot?prompt=`).
   * Reflete no campo sem enviar — o usuário revisa e manda.
   */
  initialInput?: string;
  /**
   * Intercept request failures (e.g. 403 subscription_required → upsell).
   * Return true when handled to suppress the default error toast.
   */
  onRequestError?: (error: unknown) => boolean;
}

export const ChatShell: React.FC<ChatShellProps> = ({
  mode = 'inline',
  isOpen = true,
  onClose,
  api,
  wsPath,
  sessionsQueryKey,
  feature,
  sidebarIcon,
  strings,
  suggestions,
  initialInput,
  onRequestError,
}) => {
  const { t } = useTranslation();
  const { data: brandGuidelines } = useBrandGuidelines();
  const queryClient = useQueryClient();
  const { user } = useLayout();
  // Dentro do AppShell o rail já mostra o usuário (AuthButton no topbar): o
  // footer de usuário do ChatShell viraria um 2º card redundante. Some.
  const inShell = useInAppShell();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isLargeScreen = useMediaQuery('(min-width: 1280px)');

  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminChatMessage[]>([
    {
      role: 'assistant',
      content: strings.welcome,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState(initialInput ?? '');

  // Semeia o input quando o prompt vem por fora (Cmd+K → ?prompt=). Só reflete
  // no campo (não envia); reage a mudança de valor (nova navegação), sem
  // sobrescrever o que o usuário digitou (mesmo valor → não refaz).
  useEffect(() => {
    if (initialInput) setInput(initialInput);
  }, [initialInput]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  // Copilot herda a marca ativa do app (SSoT): topbar/rail dizem "Aurora Coffee",
  // então o contexto do chat começa nela. Numa sessão nova é a 1ª escolha (ainda
  // destravável); sessões já com marca respeitam a marca salva.
  const activeBrandId = useActiveBrandSafe()?.activeBrandId ?? '';
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => getPreferredImageModel() || 'gpt-image-2'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [resolution, setResolution] = useState<Resolution>('2K');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<'media' | 'prompts'>('media');
  const [wizardOpen, setWizardOpen] = useState(false);
  const brandImportInputRef = useRef<HTMLInputElement>(null);
  const brandImport = useBrandImport(selectedBrandId || undefined);

  // Resolve the full brand (logos + media) from the list for the side panel
  const selectedBrand = React.useMemo(
    () => (brandGuidelines || []).find((b: any) => b.id === selectedBrandId),
    [brandGuidelines, selectedBrandId]
  );

  // No load inicial (ainda sem sessão), adota a marca ativa. Não sobrescreve
  // sessão carregada (currentSessionId) nem escolha explícita (selectedBrandId).
  useEffect(() => {
    if (!selectedBrandId && activeBrandId && !currentSessionId) {
      setSelectedBrandId(activeBrandId);
    }
  }, [activeBrandId, selectedBrandId, currentSessionId]);

  // O(1) lookup by id — used to show brand avatars in session list
  const brandById = React.useMemo(() => {
    const map = new Map<string, any>();
    (brandGuidelines || []).forEach((b: any) => {
      if (b?.id) map.set(b.id, b);
    });
    return map;
  }, [brandGuidelines]);

  const handleBrandImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      await brandImport.importFiles(files);
    },
    [brandImport]
  );

  // Contrato: 1 sessão = 1 marca travada. Primeira escolha persiste no DB
  // e trava o dropdown. Para trocar de marca, o usuário cria outra sessão.
  // Sem isso, o backend leria brandGuidelineId estagnado → logo vaza entre
  // sessões.
  const handleBrandChange = useCallback(
    async (nextBrandId: string) => {
      const prev = selectedBrandId;
      setSelectedBrandId(nextBrandId);
      if (!currentSessionId || !nextBrandId) return;
      try {
        await api.updateBrand(currentSessionId, nextBrandId);
        queryClient.invalidateQueries({ queryKey: [sessionsQueryKey] });
      } catch (err: any) {
        setSelectedBrandId(prev);
        toast.error(err?.message || t('chatShell.lockBrandError'));
      }
    },
    [currentSessionId, selectedBrandId, queryClient, api, sessionsQueryKey, t]
  );
  const [inflightToolCalls, setInflightToolCalls] = useState<ToolCallRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingBrandKnowledgeApproval[]>([]);
  const [resolvingPendingId, setResolvingPendingId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PendingCreativePlan | null>(null);
  const [planAnswers, setPlanAnswers] = useState<Record<number, string>>({});
  const [approvingPlan, setApprovingPlan] = useState(false);
  const [dismissedPlanId, setDismissedPlanId] = useState<string | null>(null);
  const [planModeActive, setPlanModeActive] = useState(false);
  const [textMode, setTextMode] = useState<'layers' | 'image' | 'both'>('layers');

  // Derive plan from last assistant message as fallback when WS event was missed
  const activePlan = React.useMemo(() => {
    if (pendingPlan) return pendingPlan;
    if (isLoading) return null;
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant') return null;
    const planTool = (last.toolCalls || []).find(
      (tc: any) =>
        tc.name === 'propose_creative_plan' && tc.status === 'done' && tc.args?.proposals?.length
    );
    if (!planTool) return null;
    if (dismissedPlanId === planTool.id) return null;
    return { id: planTool.id, ...planTool.args } as PendingCreativePlan;
  }, [pendingPlan, messages, isLoading, dismissedPlanId]);

  const messagesEndRef = useAutoScrollToBottom<HTMLDivElement>([messages, isLoading, activePlan]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: [sessionsQueryKey],
    queryFn: () => api.listSessions(),
    staleTime: 30000,
    gcTime: 60000,
  });

  // First-run empty state: only the welcome message exists in the thread
  const showSuggestions =
    !!suggestions?.length && messages.length <= 1 && !isLoading && !isIngesting;

  // WebSocket: real-time team broadcast das mensagens da sessão
  const handleWsEvent = useCallback((ev: SessionWsEvent) => {
    if (ev.type === 'TOOL_CALL_START' && ev.payload) {
      const { toolCallId, name, args, startedAt } = ev.payload;
      setInflightToolCalls((prev) => {
        if (prev.some((tc) => tc.id === toolCallId)) return prev;
        return [...prev, { id: toolCallId, name, args, status: 'running', startedAt }];
      });
      return;
    }
    if (ev.type === 'TOOL_CALL_END' && ev.payload) {
      const { toolCallId, status, endedAt, errorMessage, summary } = ev.payload;
      setInflightToolCalls((prev) =>
        prev.map((tc) =>
          tc.id === toolCallId ? { ...tc, status, endedAt, errorMessage, summary } : tc
        )
      );
      return;
    }
    if (ev.type === 'APPROVAL_REQUIRED' && ev.payload) {
      const pending: PendingBrandKnowledgeApproval = ev.payload;
      setPendingApprovals((prev) => {
        if (prev.some((p) => p.id === pending.id)) return prev;
        return [...prev, pending];
      });
      return;
    }
    if (ev.type === 'APPROVAL_RESOLVED' && ev.payload) {
      const { pendingId, status, resolvedByUserId, resolvedAt } = ev.payload;
      setPendingApprovals((prev) =>
        prev.map((p) => (p.id === pendingId ? { ...p, status, resolvedByUserId, resolvedAt } : p))
      );
      return;
    }
    if (ev.type === 'CREATIVE_PLAN_PROPOSED' && ev.payload) {
      setPendingPlan(ev.payload as PendingCreativePlan);
      setPlanAnswers({});
      return;
    }
    if (ev.type === 'MESSAGE' && ev.payload) {
      const incoming: AdminChatMessage = ev.payload;
      setMessages((prev) => {
        const dup = prev.some(
          (m) =>
            m.timestamp === incoming.timestamp &&
            m.role === incoming.role &&
            m.content === incoming.content
        );
        return dup ? prev : [...prev, incoming];
      });
      if (incoming.role === 'assistant') {
        setInflightToolCalls([]);
      }
    }
  }, []);

  useSessionWebSocket({
    path: wsPath,
    sessionId: currentSessionId,
    onEvent: handleWsEvent,
  });

  const createNewSession = async () => {
    try {
      const session = await api.createSession(undefined);
      setSelectedBrandId(activeBrandId); // sessão nova herda a marca ativa
      setCurrentSessionId(session._id);
      setPendingApprovals([]);
      setPendingPlan(null);
      setPlanAnswers({});
      setMessages([
        {
          role: 'assistant',
          content: strings.newSession,
          timestamp: new Date().toISOString(),
        },
      ]);
      await refetchSessions();
      return session._id;
    } catch (error) {
      console.error('Session creation error:', error);
      if (!onRequestError?.(error)) {
        toast.error(t('chatShell.createSessionError'));
      }
      throw error;
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const session = await api.getSession(sessionId);
      setCurrentSessionId(sessionId);
      setSelectedBrandId(session.brandGuidelineId || '');
      setPendingPlan(null);
      setPlanAnswers({});
      setPendingApprovals((session.pendingApprovals || []).filter((p) => p.status === 'pending'));

      if (session.messages && session.messages.length > 0) {
        setMessages(session.messages);
      } else {
        setMessages([
          {
            role: 'assistant',
            content: strings.sessionLoaded,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Load session error:', error);
      toast.error(t('chatShell.loadSessionError'));
    }
  };

  const deleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setDeletingSessionId(sessionId);
    try {
      await api.deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([
          {
            role: 'assistant',
            content: strings.selectSession,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      await refetchSessions();
      toast.success(t('chatShell.sessionDeleted'));
    } catch (error) {
      console.error('Delete session error:', error);
      toast.error(t('chatShell.deleteSessionError'));
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (isLoading || isIngesting) return;

    const currentInput = input;
    const currentFiles = [...attachedFiles];

    try {
      // 1. Create session if needed
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createNewSession();
      }

      // 2. If there are files, ingest them first
      if (currentFiles.length > 0) {
        setIsIngesting(true);
        try {
          for (const file of currentFiles) {
            const { base64 } = await fileToBase64(file);
            let source: 'pdf' | 'image' = file.type === 'application/pdf' ? 'pdf' : 'image';
            await api.uploadToSession(sessionId, source, base64, undefined, file.name);
          }
          toast.success(t('chatShell.docsIngested'));
        } catch (error) {
          console.error('Ingestion error:', error);
          toast.error(t('chatShell.processFilesError'));
          setIsIngesting(false);
          return;
        }
        setIsIngesting(false);
      }

      // 3. Add user message with attachments
      const now = new Date().toISOString();
      const attachments = currentFiles.map((file) => ({
        type: (file.type === 'application/pdf' ? 'pdf' : 'image') as 'image' | 'pdf',
        dataUrl: URL.createObjectURL(file),
        name: file.name,
      }));
      const userMsg: AdminChatMessage = {
        role: 'user',
        content:
          currentInput ||
          (currentFiles.length > 0 ? `📎 ${currentFiles.map((f) => f.name).join(', ')}` : ''),
        timestamp: now,
        attachments: attachments.length > 0 ? attachments : undefined,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setAttachedFiles([]);
      setIsLoading(true);
      setInflightToolCalls(
        textMode === 'image' || textMode === 'both'
          ? [
              {
                id: '__optimistic_gen',
                name: 'generate_or_update_mockup',
                args: {},
                status: 'running' as const,
                startedAt: now,
              },
            ]
          : []
      );

      // 4. Send message to session
      try {
        const {
          reply,
          action,
          actionResult,
          creativeProjects,
          toolsUsed,
          toolCalls,
          generationId,
        } = await api.sendMessage(sessionId, currentInput, planModeActive, textMode, {
          model: selectedModel,
          aspectRatio,
          resolution,
        });
        if (planModeActive) setPlanModeActive(false);

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: reply,
            timestamp: new Date().toISOString(),
            action,
            actionResult,
            creativeProjects,
            toolCalls,
            generationId,
          },
        ]);
        setInflightToolCalls([]);

        if (action) {
          console.log('Chat action detected:', action, actionResult);
        }

        if (toolsUsed && toolsUsed.length > 0) {
          console.log('Tools used:', toolsUsed);
        }

        await refetchSessions();
      } catch (error) {
        console.error('Chat error:', error);
        setInflightToolCalls([]);
        if (!onRequestError?.(error)) {
          toast.error(t('chatShell.consultAssistantError'));
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Ctrl+V paste — attach pasted images to the chat input
  usePasteImage((img) => {
    if (!img.file) return;
    setAttachedFiles((prev) => [...prev, img.file as File]);
  }, isOpen);

  // Fetch a remote asset URL and attach it as a File (used by media kit click + drag).
  const attachAssetFromUrl = useCallback(
    async (url: string) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const blob = await res.blob();
        const nameFromUrl = url.split('/').pop()?.split('?')[0] || 'asset';
        const ext = blob.type.split('/')[1] || 'png';
        const fileName = nameFromUrl.includes('.') ? nameFromUrl : `${nameFromUrl}.${ext}`;
        const file = new File([blob], fileName, { type: blob.type || 'image/png' });
        setAttachedFiles((prev) => [...prev, file]);
        toast.success(t('chatShell.attached', { name: fileName }));
      } catch (err: any) {
        toast.error(
          t('chatShell.attachAssetError', { error: err?.message || t('chatShell.genericError') })
        );
      }
    },
    [t]
  );

  // Drag & drop — accept image/pdf files AND asset URLs (from media kit panel)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const types = e.dataTransfer.types;
    if (
      types.includes('Files') ||
      types.includes('text/uri-list') ||
      types.includes('text/plain')
    ) {
      setIsDraggingFile(true);
    }
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDraggingFile(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
      );
      if (files.length > 0) {
        setAttachedFiles((prev) => [...prev, ...files]);
        return;
      }

      // Asset drag from MediaKitGallery — dataTransfer carries a URL
      const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (uri && /^https?:\/\//i.test(uri)) void attachAssetFromUrl(uri);
    },
    [attachAssetFromUrl]
  );

  const approvePending = async (pendingId: string) => {
    if (!currentSessionId) return;
    setResolvingPendingId(pendingId);
    try {
      await api.approvePending(currentSessionId, pendingId);
      toast.success(t('chatShell.savedToBrandMemory'));
    } catch (err: any) {
      toast.error(err?.message || t('chatShell.approveError'));
    } finally {
      setResolvingPendingId(null);
    }
  };

  const approvePlan = async () => {
    if (!activePlan || !currentSessionId) return;
    setApprovingPlan(true);
    const answers = (activePlan.questions || [])
      .map((q, i) => (planAnswers[i]?.trim() ? `${q}: ${planAnswers[i].trim()}` : null))
      .filter(Boolean)
      .join(' | ');
    const msg = answers
      ? t('chatShell.planApprovedWithAnswers', { answers })
      : t('chatShell.planApproved');
    setPendingPlan(null);
    setPlanAnswers({});
    setInput(msg);
    // trigger send programmatically via ref trick — easier: just set input and auto-send
    setApprovingPlan(false);
    // Directly invoke send logic
    setIsLoading(true);
    setInflightToolCalls([]);
    const userMsg: AdminChatMessage = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const result = await api.sendMessage(currentSessionId, msg, false, textMode);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.reply,
          timestamp: new Date().toISOString(),
          creativeProjects: result.creativeProjects,
          toolCalls: result.toolCalls,
          generationId: result.generationId,
        },
      ]);
      setInflightToolCalls([]);
      await refetchSessions();
    } catch (error) {
      if (!onRequestError?.(error)) {
        toast.error(t('chatShell.approvePlanError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const rejectPending = async (pendingId: string) => {
    if (!currentSessionId) return;
    setResolvingPendingId(pendingId);
    try {
      await api.rejectPending(currentSessionId, pendingId);
      toast.info(t('chatShell.rejected'));
    } catch (err: any) {
      toast.error(err?.message || t('chatShell.rejectError'));
    } finally {
      setResolvingPendingId(null);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon size={14} />;
    if (type.startsWith('video/')) return <Video size={14} />;
    if (type === 'application/pdf') return <FileText size={14} />;
    return <Paperclip size={14} />;
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div
            className={cn(
              mode === 'modal'
                ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'
                : 'w-full h-full flex flex-col'
            )}
          >
            <motion.div
              initial={mode === 'modal' ? { opacity: 0, scale: 0.95, y: 20 } : false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                'bg-neutral-900 overflow-hidden flex',
                mode === 'modal'
                  ? 'w-full h-screen md:h-[85vh] md:max-w-4xl rounded-2xl border border-neutral-800 shadow-2xl'
                  : 'w-full h-full rounded-none'
              )}
            >
              {/* Mobile drawer backdrop */}
              {!isDesktop && sidebarOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                  onClick={() => setSidebarOpen(false)}
                  aria-hidden="true"
                />
              )}

              {/* Sidebar */}
              <aside
                className={cn(
                  'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 ease-in-out',
                  // Mobile: overlay drawer
                  !isDesktop && 'fixed inset-y-0 left-0 z-40 w-72',
                  !isDesktop && !sidebarOpen && '-translate-x-full',
                  // Desktop: push layout
                  isDesktop && (sidebarOpen ? 'w-72' : 'w-0 overflow-hidden')
                )}
              >
                {/* Top — New session + surface brand mark */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 mb-1">
                    {sidebarIcon ?? <Sparkles className="h-4 w-4 text-neutral-400" />}
                    <span className="text-sm font-semibold text-neutral-200">
                      {strings.sidebarLabel}
                    </span>
                  </div>
                  <button
                    onClick={createNewSession}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5 hover:text-neutral-100 transition-colors"
                  >
                    <Plus size={16} className="opacity-60" />
                    <span>{t('chatShell.newSession')}</span>
                  </button>
                </div>

                {/* Sessions section */}
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                  <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-sidebar-foreground/50">
                    {t('chatShell.sessions')}
                  </div>
                  {loadingSessions ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500">
                      <GlitchLoader size={12} />
                      {t('chatShell.loading')}
                    </div>
                  ) : sessions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-neutral-600">
                      {t('chatShell.noSessions')}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {sessions.map((session: any) => (
                        <div
                          key={session._id}
                          onClick={() => loadSession(session._id)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group relative cursor-pointer',
                            currentSessionId === session._id
                              ? 'bg-white/10 text-neutral-100'
                              : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {session.brandGuidelineId &&
                                brandById.get(session.brandGuidelineId) && (
                                  <BrandAvatar
                                    brand={brandById.get(session.brandGuidelineId)}
                                    size={18}
                                    rounded="sm"
                                  />
                                )}
                              <span className="truncate" title={session.title}>
                                {session.title}
                              </span>
                            </div>
                            {currentSessionId === session._id && (
                              <button
                                onClick={(e) => deleteSession(session._id, e)}
                                disabled={deletingSessionId === session._id}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded shrink-0"
                                aria-label={t('chatShell.deleteSession')}
                              >
                                <Trash2
                                  size={12}
                                  className="text-destructive/60 hover:text-destructive"
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* User footer — some dentro do AppShell (rail já mostra) */}
                {user && !inShell && (
                  <div className="p-3 border-t border-neutral-800">
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt={user.name || user.email}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-300 shrink-0">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-neutral-200 truncate leading-tight">
                          {user.name || user.email}
                        </div>
                        <div className="text-xs text-neutral-500 truncate leading-tight">
                          {user.isAdmin
                            ? t('chatShell.roleAdmin')
                            : user.userCategory || t('chatShell.roleAccount')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </aside>

              {/* Main Chat Area */}
              <div
                className="flex flex-col flex-1 min-w-0 bg-neutral-950 relative"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDraggingFile && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/5 border-2 border-dashed border-white/20 rounded-lg pointer-events-none backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-2 text-neutral-300">
                      <Paperclip size={28} />
                      <span className="text-xs">{t('chatShell.dropToAttach')}</span>
                    </div>
                  </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-neutral-800 bg-black/20 gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-neutral-400 shrink-0"
                      aria-label={t('chatShell.toggleSidebar')}
                    >
                      {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <h3 className="text-sm font-semibold text-neutral-200 truncate leading-tight">
                      {sessions.find((s) => s._id === currentSessionId)?.title ||
                        t('chatShell.newSession')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden md:block w-44">
                      <Select
                        options={(brandGuidelines || []).map((brand: any) => ({
                          value: brand.id,
                          label: brand.identity?.name || brand.id,
                          icon: <BrandAvatar brand={brand} size={16} rounded="sm" />,
                        }))}
                        value={selectedBrandId}
                        onChange={handleBrandChange}
                        placeholder={t('chatShell.brandContext')}
                        className="text-xs"
                        variant="node"
                        disabled={
                          !!sessions.find((s) => s._id === currentSessionId)?.brandGuidelineId
                        }
                        footer={
                          <button
                            type="button"
                            onClick={() => setWizardOpen(true)}
                            className="flex items-center gap-2 w-full px-2 py-2 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 transition-colors"
                          >
                            <Plus size={12} />
                            {t('chatShell.newBrand')}
                          </button>
                        }
                      />
                    </div>

                    {isLargeScreen && selectedBrandId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMediaPanelOpen((v) => !v)}
                        className="hover:bg-white/10 h-8 w-8 shrink-0 text-neutral-400"
                        aria-label={
                          mediaPanelOpen ? t('chatShell.hideMediaKit') : t('chatShell.showMediaKit')
                        }
                      >
                        {mediaPanelOpen ? (
                          <PanelRightClose size={16} />
                        ) : (
                          <PanelRightOpen size={16} />
                        )}
                      </Button>
                    )}

                    {mode === 'modal' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('chatShell.close')}
                        onClick={onClose}
                        className="hover:bg-white/10 h-8 w-8 shrink-0"
                      >
                        <X size={18} aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <div className="max-w-5xl mx-auto w-full p-8 md:px-16 md:py-12 lg:px-20 lg:py-16 space-y-10">
                    {messages.map((msg, i) => (
                      <ChatMessage
                        key={i}
                        role={msg.role as any}
                        content={msg.content}
                        t={t}
                        attachments={msg.attachments}
                        creativeProjects={msg.creativeProjects}
                        toolCalls={msg.toolCalls}
                        generationId={msg.generationId}
                        feature={feature}
                      />
                    ))}

                    {/* First-run suggestions — click fills the input */}
                    {showSuggestions && (
                      <div className="flex flex-col gap-2 pl-12 max-w-md">
                        {suggestions!.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setInput(s)}
                            className={cn(
                              'text-left px-4 py-3 rounded-xl text-xs text-neutral-300 hover:border-white/15 hover:text-neutral-100 flex items-center gap-2.5',
                              glassSurface.tile
                            )}
                          >
                            <Sparkles size={12} className="text-brand-cyan/70 shrink-0" />
                            <span>{s}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Pending brand knowledge approvals */}
                    {pendingApprovals
                      .filter((p) => p.status === 'pending')
                      .map((pending) => (
                        <div key={pending.id} className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-neutral-900 border border-warning/30 flex items-center justify-center shadow-lg shrink-0">
                            <BookOpen size={16} className="text-warning" />
                          </div>
                          <div className="flex-1 max-w-[85%] rounded-2xl border border-warning/30 bg-warning/[0.04] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-warning/80">
                                {t('chatShell.saveToBrandMemory')}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-100">
                                {pending.title}
                              </p>
                              {pending.reason && (
                                <p className="text-xs text-neutral-500 mt-1 italic">
                                  {pending.reason}
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-neutral-300 bg-black/30 rounded-lg p-3 border border-neutral-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {pending.content}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                type="button"
                                onClick={() => approvePending(pending.id)}
                                disabled={resolvingPendingId === pending.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 border border-success/30 text-success text-xs rounded-md transition-colors"
                              >
                                <Check size={12} />
                                {t('chatShell.approve')}
                              </Button>
                              <Button
                                variant="ghost"
                                type="button"
                                onClick={() => rejectPending(pending.id)}
                                disabled={resolvingPendingId === pending.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-xs rounded-md transition-colors"
                              >
                                <X size={12} />
                                {t('chatShell.reject')}
                              </Button>
                              {resolvingPendingId === pending.id && <GlitchLoader size={12} />}
                            </div>
                          </div>
                        </div>
                      ))}

                    {/* Creative plan proposal card */}
                    {/* TODO(copilot-credits): quando o backend expor o custo estimado do plano
                        (CREDIT_COSTS por proposta), mostrar o total em créditos aqui antes do
                        "Aprovar e gerar" — hoje o chat não recebe custo pré-geração. */}
                    {activePlan && (
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center shadow-lg shrink-0">
                          <Bot size={16} className="text-neutral-300" />
                        </div>
                        <div className="flex-1 max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                          {activePlan.summary && (
                            <p className="text-xs text-neutral-400">{activePlan.summary}</p>
                          )}

                          {activePlan.proposals?.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">
                                {t('chatShell.proposedVariations')}
                              </p>
                              {activePlan.proposals.map((p, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-black/30 border border-neutral-800"
                                >
                                  <span className="text-xs text-neutral-500 shrink-0 mt-px">
                                    {i + 1}.
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-neutral-200">
                                      {p.title}
                                    </p>
                                    {p.aspectRatio && (
                                      <p className="text-[11px] text-neutral-600 mt-0.5">
                                        {p.aspectRatio}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {activePlan.questions && activePlan.questions.length > 0 && (
                            <div className="space-y-2.5">
                              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">
                                {t('chatShell.questions')}
                              </p>
                              {activePlan.questions.map((q, i) => (
                                <div key={i} className="space-y-1">
                                  <label className="text-xs text-neutral-300">{q}</label>
                                  <input
                                    type="text"
                                    value={planAnswers[i] || ''}
                                    onChange={(e) =>
                                      setPlanAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                                    }
                                    placeholder={t('chatShell.optionalAnswer')}
                                    className="w-full px-3 py-1.5 rounded-md bg-black/40 border border-white/10 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-white/20 transition-colors"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={approvePlan}
                              disabled={approvingPlan || isLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 border border-success/30 text-success text-xs rounded-md transition-colors"
                            >
                              {approvingPlan ? <GlitchLoader size={12} /> : <Check size={12} />}
                              {t('chatShell.approveAndGenerate')}
                            </Button>
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() => {
                                setPendingPlan(null);
                                setPlanAnswers({});
                                if (activePlan?.id) setDismissedPlanId(activePlan.id);
                              }}
                              disabled={approvingPlan}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive text-xs rounded-md transition-colors"
                            >
                              <X size={12} />
                              {t('chatShell.cancel')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isLoading && (
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center shadow-lg">
                          <Bot size={16} className="text-neutral-300 animate-pulse" />
                        </div>
                        <div className="flex-1 max-w-[80%] space-y-3 py-1.5">
                          <PremiumGlitchLoader className="!text-xs" />
                          {inflightToolCalls.some(
                            (tc) => tc.name === 'generate_or_update_mockup'
                          ) && (
                            <GeneratingImageCard
                              isLoading
                              variant="tile"
                              aspectRatio="1/1"
                              className="w-full max-w-md"
                            />
                          )}
                          {inflightToolCalls.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                              {inflightToolCalls.map((tc) => (
                                <div
                                  key={tc.id}
                                  className={cn(
                                    'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs',
                                    tc.status === 'error'
                                      ? 'bg-destructive/5 border-destructive/20 text-destructive'
                                      : tc.status === 'running'
                                        ? 'bg-white/5 border-white/10 text-neutral-200'
                                        : 'bg-white/[0.03] border-neutral-800 text-neutral-400'
                                  )}
                                >
                                  {tc.status === 'running' ? (
                                    <GlitchLoader size={12} className="shrink-0" />
                                  ) : tc.status === 'error' ? (
                                    <Trash2 size={12} className="shrink-0" />
                                  ) : (
                                    <FileText size={12} className="shrink-0 text-success/70" />
                                  )}
                                  <span className="truncate flex-1">{tc.name}</span>
                                  <span className="text-xs opacity-60">
                                    {tc.status === 'error'
                                      ? (tc.errorMessage || t('chatShell.toolFailed')).slice(0, 40)
                                      : tc.summary || tc.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                </div>

                {/* Footer / Input */}
                <div className="border-t border-neutral-800 bg-black/40 backdrop-blur-md py-8 px-10">
                  <div className="max-w-5xl mx-auto w-full">
                    {/* File Attachments */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4 px-1">
                        {attachedFiles.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-md border border-white/10 text-xs text-neutral-300"
                          >
                            {getFileIcon(file.type)}
                            <span className="truncate max-w-[120px]">{file.name}</span>
                            <button
                              onClick={() => removeFile(i)}
                              className="hover:text-destructive ml-1"
                              aria-label={t('chatShell.removeAttachment')}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                    />

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setPlanModeActive((v) => !v)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors',
                          planModeActive
                            ? 'bg-success/10 border-success/30 text-success'
                            : 'bg-white/[0.03] border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/20'
                        )}
                        title={t('chatShell.planModeTooltip')}
                      >
                        <Diamond
                          size={11}
                          className={planModeActive ? 'text-success' : 'opacity-50'}
                        />
                        {t('chatShell.planMode')}
                      </button>

                      <div className="flex items-center rounded-md border border-white/10 overflow-hidden text-[11px] font-medium">
                        {(['layers', 'image', 'both'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setTextMode(mode)}
                            className={cn(
                              'px-2.5 py-1 transition-colors',
                              textMode === mode
                                ? 'bg-white/10 text-neutral-200'
                                : 'text-neutral-600 hover:text-neutral-400'
                            )}
                            title={
                              mode === 'layers'
                                ? t('chatShell.textModeLayersTooltip')
                                : mode === 'image'
                                  ? t('chatShell.textModeImageTooltip')
                                  : t('chatShell.textModeBothTooltip')
                            }
                          >
                            {mode === 'layers'
                              ? t('chatShell.textModeLayers')
                              : mode === 'image'
                                ? t('chatShell.textModeImage')
                                : t('chatShell.textModeBoth')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ChatInput
                      value={input}
                      onChange={setInput}
                      onSend={handleSend}
                      isLoading={isLoading}
                      isIngesting={isIngesting}
                      placeholder={strings.inputPlaceholder}
                      showAttach={true}
                      onAttachClick={() => fileInputRef.current?.click()}
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                      showModelSelector={true}
                      modelSelectorType={textMode === 'layers' ? 'chat' : 'image'}
                      aspectRatio={aspectRatio}
                      onAspectRatioChange={setAspectRatio}
                      resolution={resolution}
                      onResolutionChange={setResolution}
                      showOutputConfig={textMode !== 'layers'}
                    />
                  </div>
                </div>
              </div>

              {/* Right-side panel — Media Kit / Prompt Library */}
              {isLargeScreen && mediaPanelOpen && selectedBrand && (
                <aside className="flex flex-col bg-neutral-950 border-l border-neutral-800 w-80 shrink-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                    <div className="flex items-center bg-white/5 rounded-md p-0.5 gap-px">
                      {(['media', 'prompts'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setPanelTab(tab)}
                          className={cn(
                            'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                            panelTab === tab
                              ? 'bg-white/10 text-neutral-200'
                              : 'text-neutral-500 hover:text-neutral-300'
                          )}
                        >
                          {tab === 'media' ? t('chatShell.mediaKit') : t('chatShell.prompts')}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {panelTab === 'media' && selectedBrand && (
                        <>
                          <input
                            ref={brandImportInputRef}
                            type="file"
                            multiple
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={handleBrandImport}
                          />
                          <button
                            onClick={() => brandImportInputRef.current?.click()}
                            disabled={brandImport.isPending}
                            className="p-1.5 rounded-md text-neutral-500 hover:text-brand-cyan hover:bg-brand-cyan/10 transition-colors disabled:opacity-50"
                            aria-label={t('chatShell.importPdfImages')}
                            title={t('chatShell.importPdfImagesTooltip')}
                          >
                            {brandImport.isPending ? (
                              <GlitchLoader size={14} />
                            ) : (
                              <Upload size={14} />
                            )}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setMediaPanelOpen(false)}
                        className="p-1 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5 transition-colors"
                        aria-label={t('chatShell.closePanel')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {panelTab === 'media' ? (
                    <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
                      <p className="text-xs text-neutral-500 mb-3 px-1">
                        {t('chatShell.clickOrDrag')}
                      </p>
                      <MediaKitGallery
                        guidelineId={(selectedBrand as any).id}
                        media={(selectedBrand as any).media || []}
                        logos={(selectedBrand as any).logos || []}
                        onMediaChange={() =>
                          queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })
                        }
                        onLogosChange={() =>
                          queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })
                        }
                        compact
                        onAssetClick={(url) => attachAssetFromUrl(url)}
                        onAssetDragStart={(e, url) => {
                          e.dataTransfer.setData('text/uri-list', url);
                          e.dataTransfer.setData('text/plain', url);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      />
                      <BrandReadOnlyView
                        guideline={selectedBrand as any}
                        compact
                        sections={[
                          'identity',
                          'manifesto',
                          'archetypes',
                          'personas',
                          'voiceValues',
                          'guidelines',
                          'colors',
                          'typography',
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      <CommunityPresetsSidebar
                        variant="embedded"
                        onImportPreset={(preset) => {
                          setInput(preset.prompt || preset.description || '');
                        }}
                      />
                    </div>
                  )}
                </aside>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <BrandGuidelineWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(id) => {
          setWizardOpen(false);
          queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] });
          handleBrandChange(id);
          setMediaPanelOpen(true);
        }}
      />
    </>
  );
};
