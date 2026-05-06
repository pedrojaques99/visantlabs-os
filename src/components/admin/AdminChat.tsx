import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAutoScrollToBottom } from '@/hooks/chat/useAutoScrollToBottom';
import { useSessionWebSocket, type SessionWsEvent } from '@/hooks/chat/useSessionWebSocket';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { adminChatApi, AdminChatMessage, AdminChatSession, ToolCallRecord, PendingBrandKnowledgeApproval, PendingCreativePlan } from '@/services/adminChatApi';
import { X, Bot, Shield, FileText, Image as ImageIcon, Video, Paperclip, Plus, Trash2, ChevronLeft, ChevronRight, BookOpen, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { fileToBase64 } from '@/utils/fileUtils';
import { ChatMessage } from '../shared/chat/ChatMessage';
import { ChatInput } from '../shared/chat/ChatInput';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { GlitchPickaxe } from '@/components/ui/GlitchPickaxe';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { usePasteImage } from '@/hooks/usePasteImage';
import { toast } from 'sonner';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { useBrandImport } from '@/hooks/queries/useBrandImport';
import { Select } from '@/components/ui/select';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import { BrandReadOnlyView } from '@/components/brand/BrandReadOnlyView';
import { Diamond, PanelRightOpen, PanelRightClose, Upload } from 'lucide-react';
import { useLayout } from '@/hooks/useLayout';
import { useMediaQuery } from '@/hooks/use-media-query';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';

interface AdminChatProps {
    mode?: 'modal' | 'inline';
    isOpen?: boolean;
    onClose?: () => void;
}

export const AdminChat: React.FC<AdminChatProps> = ({
    mode = 'inline',
    isOpen = true,
    onClose
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { data: brandGuidelines } = useBrandGuidelines();
    const queryClient = useQueryClient();
    const { user } = useLayout();
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const isLargeScreen = useMediaQuery('(min-width: 1280px)');

    // Session management
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<AdminChatMessage[]>([
        {
            role: 'assistant',
            content: 'Olá Administrador. Sou seu Assistente Estratégico de Agência. Estou aqui para ajudar com posicionamento, naming, estratégia e análise profunda. Você pode vincular este chat a uma Brand Guideline para contexto extra ou subir documentos estratégicos.',
            timestamp: new Date().toISOString()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [selectedBrandId, setSelectedBrandId] = useState<string>('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>(GEMINI_MODELS.PRO_3_1); // Default admin model
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [mediaPanelOpen, setMediaPanelOpen] = useState(true);
    const [wizardOpen, setWizardOpen] = useState(false);
    const brandImportInputRef = useRef<HTMLInputElement>(null);
    const brandImport = useBrandImport(selectedBrandId || undefined);

    // Resolve the full brand (logos + media) from the list for the side panel
    const selectedBrand = React.useMemo(
        () => (brandGuidelines || []).find((b: any) => b.id === selectedBrandId),
        [brandGuidelines, selectedBrandId]
    );

    // O(1) lookup by id — used to show brand avatars in session list
    const brandById = React.useMemo(() => {
        const map = new Map<string, any>();
        (brandGuidelines || []).forEach((b: any) => { if (b?.id) map.set(b.id, b); });
        return map;
    }, [brandGuidelines]);

    const handleBrandImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        await brandImport.importFiles(files);
    }, [brandImport]);

    // Contrato: 1 sessão = 1 marca travada. Primeira escolha persiste no DB
    // e trava o dropdown. Para trocar de marca, o usuário cria outra sessão.
    // Sem isso, o backend leria brandGuidelineId estagnado → logo vaza entre
    // sessões.
    const handleBrandChange = useCallback(async (nextBrandId: string) => {
        const prev = selectedBrandId;
        setSelectedBrandId(nextBrandId);
        if (!currentSessionId || !nextBrandId) return;
        try {
            await adminChatApi.updateBrand(currentSessionId, nextBrandId);
            queryClient.invalidateQueries({ queryKey: ['admin-chat-sessions'] });
        } catch (err: any) {
            setSelectedBrandId(prev);
            toast.error(err?.message || 'Falha ao travar marca da sessão');
        }
    }, [currentSessionId, selectedBrandId, queryClient]);
    const [inflightToolCalls, setInflightToolCalls] = useState<ToolCallRecord[]>([]);
    const [pendingApprovals, setPendingApprovals] = useState<PendingBrandKnowledgeApproval[]>([]);
    const [resolvingPendingId, setResolvingPendingId] = useState<string | null>(null);
    const [pendingPlan, setPendingPlan] = useState<PendingCreativePlan | null>(null);
    const [planAnswers, setPlanAnswers] = useState<Record<number, string>>({});
    const [approvingPlan, setApprovingPlan] = useState(false);
    const [planModeActive, setPlanModeActive] = useState(false);
    const [textMode, setTextMode] = useState<'layers' | 'image' | 'both'>('layers');

    // Derive plan from last assistant message as fallback when WS event was missed
    const activePlan = React.useMemo(() => {
        if (pendingPlan) return pendingPlan;
        if (isLoading) return null;
        const last = messages[messages.length - 1];
        if (last?.role !== 'assistant') return null;
        const planTool = (last.toolCalls || []).find(
            (tc: any) => tc.name === 'propose_creative_plan' && tc.status === 'done' && tc.args?.proposals?.length
        );
        if (!planTool) return null;
        return { id: planTool.id, ...planTool.args } as PendingCreativePlan;
    }, [pendingPlan, messages, isLoading]);

    const messagesEndRef = useAutoScrollToBottom<HTMLDivElement>([messages, isLoading, activePlan]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load sessions
    const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
      queryKey: ['admin-chat-sessions'],
      queryFn: () => adminChatApi.listSessions(),
      staleTime: 30000,
      gcTime: 60000,
    });

    // WebSocket: real-time team broadcast das mensagens da sessão
    const handleWsEvent = useCallback((ev: SessionWsEvent) => {
        if (ev.type === 'TOOL_CALL_START' && ev.payload) {
            const { toolCallId, name, args, startedAt } = ev.payload;
            setInflightToolCalls((prev) => {
                if (prev.some(tc => tc.id === toolCallId)) return prev;
                return [...prev, { id: toolCallId, name, args, status: 'running', startedAt }];
            });
            return;
        }
        if (ev.type === 'TOOL_CALL_END' && ev.payload) {
            const { toolCallId, status, endedAt, errorMessage, summary } = ev.payload;
            setInflightToolCalls((prev) =>
                prev.map(tc => tc.id === toolCallId ? { ...tc, status, endedAt, errorMessage, summary } : tc)
            );
            return;
        }
        if (ev.type === 'APPROVAL_REQUIRED' && ev.payload) {
            const pending: PendingBrandKnowledgeApproval = ev.payload;
            setPendingApprovals(prev => {
                if (prev.some(p => p.id === pending.id)) return prev;
                return [...prev, pending];
            });
            return;
        }
        if (ev.type === 'APPROVAL_RESOLVED' && ev.payload) {
            const { pendingId, status, resolvedByUserId, resolvedAt } = ev.payload;
            setPendingApprovals(prev =>
                prev.map(p => p.id === pendingId ? { ...p, status, resolvedByUserId, resolvedAt } : p)
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
        path: '/admin-chat/ws',
        sessionId: currentSessionId,
        onEvent: handleWsEvent,
    });

    const createNewSession = async () => {
        try {
            const session = await adminChatApi.createSession(undefined);
            setSelectedBrandId('');
            setCurrentSessionId(session._id);
            setPendingApprovals([]);
            setPendingPlan(null);
            setPlanAnswers({});
            setMessages([
                {
                    role: 'assistant',
                    content: 'Nova sessão estratégica iniciada. Como posso ajudar com sua marca hoje?',
                    timestamp: new Date().toISOString()
                }
            ]);
            await refetchSessions();
            return session._id;
        } catch (error) {
            console.error('Session creation error:', error);
            toast.error('Erro ao criar sessão estratégica.');
            throw error;
        }
    };

    const loadSession = async (sessionId: string) => {
        try {
            const session = await adminChatApi.getSession(sessionId);
            setCurrentSessionId(sessionId);
            setSelectedBrandId(session.brandGuidelineId || '');
            setPendingPlan(null);
            setPlanAnswers({});
            setPendingApprovals(
                (session.pendingApprovals || []).filter(p => p.status === 'pending')
            );

            if (session.messages && session.messages.length > 0) {
                setMessages(session.messages);
            } else {
                setMessages([
                    {
                        role: 'assistant',
                        content: 'Sessão carregada. Como deseja prosseguir?',
                        timestamp: new Date().toISOString()
                    }
                ]);
            }
        } catch (error) {
            console.error('Load session error:', error);
            toast.error('Erro ao carregar sessão.');
        }
    };

    const deleteSession = async (sessionId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        setDeletingSessionId(sessionId);
        try {
            await adminChatApi.deleteSession(sessionId);
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
                setMessages([
                    {
                        role: 'assistant',
                        content: 'Bem-vindo ao Chat Estratégico Admin. Selecione uma sessão ou inicie uma nova.',
                        timestamp: new Date().toISOString()
                    }
                ]);
            }
            await refetchSessions();
            toast.success('Sessão deletada.');
        } catch (error) {
            console.error('Delete session error:', error);
            toast.error('Erro ao deletar sessão.');
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
                        await adminChatApi.uploadToSession(sessionId, source, base64, undefined, file.name);
                    }
                    toast.success('Documentos estratégicos ingeridos na sessão!');
                } catch (error) {
                    console.error('Ingestion error:', error);
                    toast.error('Erro ao processar arquivos.');
                    setIsIngesting(false);
                    return;
                }
                setIsIngesting(false);
            }

            // 3. Add user message with attachments
            const now = new Date().toISOString();
            const attachments = currentFiles.map(file => ({
                type: (file.type === 'application/pdf' ? 'pdf' : 'image') as 'image' | 'pdf',
                dataUrl: URL.createObjectURL(file),
                name: file.name,
            }));
            const userMsg: AdminChatMessage = {
                role: 'user',
                content: currentInput || (currentFiles.length > 0 ? `📎 ${currentFiles.map(f => f.name).join(', ')}` : ''),
                timestamp: now,
                attachments: attachments.length > 0 ? attachments : undefined
            };
            setMessages(prev => [...prev, userMsg]);
            setInput('');
            setAttachedFiles([]);
            setIsLoading(true);
            setInflightToolCalls([]);

            // 4. Send message to session
            try {
                const { reply, action, actionResult, creativeProjects, toolsUsed, toolCalls, generationId } = await adminChatApi.sendMessage(sessionId, currentInput, planModeActive, textMode);
                if (planModeActive) setPlanModeActive(false);

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: reply,
                    timestamp: new Date().toISOString(),
                    action,
                    actionResult,
                    creativeProjects,
                    toolCalls,
                    generationId
                }]);
                setInflightToolCalls([]);

                if (action) {
                    console.log('Admin Action detected:', action, actionResult);
                }

                if (toolsUsed && toolsUsed.length > 0) {
                    console.log('Tools used:', toolsUsed);
                }

                await refetchSessions();
            } catch (error) {
                console.error('Chat error:', error);
                toast.error('Erro ao consultar o assistente estratégico.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Ctrl+V paste — attach pasted images to the chat input
    usePasteImage((img) => {
        if (!img.file) return;
        setAttachedFiles(prev => [...prev, img.file as File]);
    }, isOpen);

    // Fetch a remote asset URL and attach it as a File (used by media kit click + drag).
    const attachAssetFromUrl = useCallback(async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${res.status}`);
            const blob = await res.blob();
            const nameFromUrl = url.split('/').pop()?.split('?')[0] || 'asset';
            const ext = blob.type.split('/')[1] || 'png';
            const fileName = nameFromUrl.includes('.') ? nameFromUrl : `${nameFromUrl}.${ext}`;
            const file = new File([blob], fileName, { type: blob.type || 'image/png' });
            setAttachedFiles(prev => [...prev, file]);
            toast.success(`Anexado: ${fileName}`);
        } catch (err: any) {
            toast.error(`Falha ao anexar asset: ${err?.message || 'erro'}`);
        }
    }, []);

    // Drag & drop — accept image/pdf files AND asset URLs (from media kit panel)
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const types = e.dataTransfer.types;
        if (types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain')) {
            setIsDraggingFile(true);
        }
    }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) setIsDraggingFile(false);
    }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);

        const files = Array.from(e.dataTransfer.files).filter(f =>
            f.type.startsWith('image/') || f.type === 'application/pdf'
        );
        if (files.length > 0) {
            setAttachedFiles(prev => [...prev, ...files]);
            return;
        }

        // Asset drag from MediaKitGallery — dataTransfer carries a URL
        const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (uri && /^https?:\/\//i.test(uri)) void attachAssetFromUrl(uri);
    }, [attachAssetFromUrl]);

    const approvePending = async (pendingId: string) => {
        if (!currentSessionId) return;
        setResolvingPendingId(pendingId);
        try {
            await adminChatApi.approvePending(currentSessionId, pendingId);
            toast.success('Salvo na memória da marca');
        } catch (err: any) {
            toast.error(err?.message || 'Falha ao aprovar');
        } finally {
            setResolvingPendingId(null);
        }
    };

    const approvePlan = async () => {
        if (!pendingPlan || !currentSessionId) return;
        setApprovingPlan(true);
        const answers = pendingPlan.questions
            .map((q, i) => planAnswers[i]?.trim() ? `${q}: ${planAnswers[i].trim()}` : null)
            .filter(Boolean)
            .join(' | ');
        const msg = answers
            ? `Aprovado. ${answers}. Pode gerar os mockups propostos.`
            : 'Aprovado. Pode gerar os mockups propostos.';
        setPendingPlan(null);
        setPlanAnswers({});
        setInput(msg);
        // trigger send programmatically via ref trick — easier: just set input and auto-send
        setApprovingPlan(false);
        // Directly invoke send logic
        setIsLoading(true);
        setInflightToolCalls([]);
        const userMsg: AdminChatMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        try {
            const result = await adminChatApi.sendMessage(currentSessionId, msg, false, textMode);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: result.reply,
                timestamp: new Date().toISOString(),
                creativeProjects: result.creativeProjects,
                toolCalls: result.toolCalls,
                generationId: result.generationId,
            }]);
            setInflightToolCalls([]);
            await refetchSessions();
        } catch {
            toast.error('Erro ao aprovar plano.');
        } finally {
            setIsLoading(false);
        }
    };

    const rejectPending = async (pendingId: string) => {
        if (!currentSessionId) return;
        setResolvingPendingId(pendingId);
        try {
            await adminChatApi.rejectPending(currentSessionId, pendingId);
            toast.info('Rejeitado — nada salvo');
        } catch (err: any) {
            toast.error(err?.message || 'Falha ao rejeitar');
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
                <div className={cn(
                    mode === 'modal'
                        ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        : "w-full h-full flex flex-col"
                )}>
                    <motion.div
                        initial={mode === 'modal' ? { opacity: 0, scale: 0.95, y: 20 } : false}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "bg-neutral-900 overflow-hidden flex",
                            mode === 'modal' 
                                ? "w-full h-screen md:h-[85vh] md:max-w-4xl rounded-2xl border border-white/5 shadow-2xl" 
                                : "w-full h-full rounded-none"
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
                        <aside className={cn(
                            "flex flex-col bg-neutral-950 border-r border-white/5 transition-all duration-200 ease-in-out",
                            // Mobile: overlay drawer
                            !isDesktop && "fixed inset-y-0 left-0 z-40 w-72",
                            !isDesktop && !sidebarOpen && "-translate-x-full",
                            // Desktop: push layout
                            isDesktop && (sidebarOpen ? "w-72" : "w-0 overflow-hidden")
                        )}>
                            {/* Top — New session + Shield brand mark */}
                            <div className="p-3 space-y-1">
                                <div className="flex items-center gap-2 px-3 py-2 mb-1">
                                    <Shield className="h-4 w-4 text-neutral-400" />
                                    <span className="text-sm font-semibold text-neutral-200">Admin</span>
                                </div>
                                <button
                                    onClick={createNewSession}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5 hover:text-neutral-100 transition-colors"
                                >
                                    <Plus size={16} className="opacity-60" />
                                    <span>Nova sessão</span>
                                </button>
                            </div>

                            {/* Sessions section */}
                            <div className="flex-1 overflow-y-auto px-3 pb-3">
                                <div className="px-3 py-2 text-xs text-neutral-500">Recentes</div>
                                {loadingSessions ? (
                                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-500">
                                        <GlitchLoader size={12} />
                                        Carregando…
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-neutral-600">
                                        Nenhuma sessão ainda.
                                    </div>
                                ) : (
                                    <div className="space-y-0.5">
                                        {sessions.map((session: any) => (
                                            <div
                                                key={session._id}
                                                onClick={() => loadSession(session._id)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group relative cursor-pointer",
                                                    currentSessionId === session._id
                                                        ? "bg-white/10 text-neutral-100"
                                                        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        {session.brandGuidelineId && brandById.get(session.brandGuidelineId) && (
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
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded shrink-0"
                                                            aria-label="Deletar sessão"
                                                        >
                                                            <Trash2 size={12} className="text-red-500/60 hover:text-red-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* User footer */}
                            {user && (
                                <div className="p-3 border-t border-white/5">
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
                                                {user.isAdmin ? 'Admin · Nível 4' : user.userCategory || 'Conta'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </aside>

                        {/* Main Chat Area */}
                        <div
                            className="flex flex-col flex-1 min-w-0 bg-[#080808] relative"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            {isDraggingFile && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/5 border-2 border-dashed border-white/20 rounded-lg pointer-events-none backdrop-blur-sm">
                                    <div className="flex flex-col items-center gap-2 text-neutral-300">
                                        <Paperclip size={28} />
                                        <span className="text-xs">Solte para anexar</span>
                                    </div>
                                </div>
                            )}
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-white/5 bg-black/20 gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <button
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-neutral-400 shrink-0"
                                        aria-label="Alternar sidebar"
                                    >
                                        {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                                    </button>
                                    <h3 className="text-sm font-semibold text-neutral-200 truncate leading-tight">
                                        {sessions.find(s => s._id === currentSessionId)?.title || 'Nova sessão'}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="hidden md:block w-44">
                                        <Select
                                            options={(brandGuidelines || []).map((brand: any) => ({
                                                value: brand.id,
                                                label: brand.identity?.name || brand.id,
                                                icon: <BrandAvatar brand={brand} size={16} rounded="sm" />
                                            }))}
                                            value={selectedBrandId}
                                            onChange={handleBrandChange}
                                            placeholder="Marca contexto"
                                            className="text-xs"
                                            variant="node"
                                            disabled={!!sessions.find(s => s._id === currentSessionId)?.brandGuidelineId}
                                            footer={
                                                <button
                                                    type="button"
                                                    onClick={() => setWizardOpen(true)}
                                                    className="flex items-center gap-2 w-full px-2 py-2 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 transition-colors"
                                                >
                                                    <Plus size={12} />
                                                    Nova marca
                                                </button>
                                            }
                                        />
                                    </div>

                                    {isLargeScreen && selectedBrandId && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setMediaPanelOpen(v => !v)}
                                            className="hover:bg-white/10 h-8 w-8 shrink-0 text-neutral-400"
                                            aria-label={mediaPanelOpen ? 'Ocultar media kit' : 'Mostrar media kit'}
                                        >
                                            {mediaPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                                        </Button>
                                    )}

                                    {mode === 'modal' && (
                                        <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose} className="hover:bg-white/10 h-8 w-8 shrink-0">
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
                                        feature="admin-chat"
                                    />
                                ))}

                                {/* Pending brand knowledge approvals */}
                                {pendingApprovals.filter(p => p.status === 'pending').map(pending => (
                                    <div key={pending.id} className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-amber-400/30 flex items-center justify-center shadow-lg shrink-0">
                                            <BookOpen size={16} className="text-amber-400" />
                                        </div>
                                        <div className="flex-1 max-w-[85%] rounded-2xl border border-amber-400/30 bg-amber-400/[0.04] p-4 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-amber-400/80">
                                                    Salvar na memória da marca?
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-neutral-100">{pending.title}</p>
                                                {pending.reason && (
                                                    <p className="text-xs text-neutral-500 mt-1 italic">{pending.reason}</p>
                                                )}
                                            </div>
                                            <div className="text-xs text-neutral-300 bg-black/30 rounded-lg p-3 border border-white/5 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                {pending.content}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={() => approvePending(pending.id)}
                                                    disabled={resolvingPendingId === pending.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs rounded-md transition-colors"
                                                >
                                                    <Check size={12} />
                                                    Aprovar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={() => rejectPending(pending.id)}
                                                    disabled={resolvingPendingId === pending.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs rounded-md transition-colors"
                                                >
                                                    <X size={12} />
                                                    Rejeitar
                                                </Button>
                                                {resolvingPendingId === pending.id && (
                                                    <GlitchLoader size={12} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Creative plan proposal card */}
                                {activePlan && (
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center shadow-lg shrink-0">
                                            <Bot size={16} className="text-neutral-300" />
                                        </div>
                                        <div className="flex-1 max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                                            {activePlan.summary && (
                                                <p className="text-xs text-neutral-400">{activePlan.summary}</p>
                                            )}

                                            {activePlan.proposals?.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">Variações propostas</p>
                                                    {activePlan.proposals.map((p, i) => (
                                                        <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/5">
                                                            <span className="text-xs text-neutral-500 shrink-0 mt-px">{i + 1}.</span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium text-neutral-200">{p.title}</p>
                                                                {p.aspectRatio && (
                                                                    <p className="text-[11px] text-neutral-600 mt-0.5">{p.aspectRatio}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {activePlan.questions && activePlan.questions.length > 0 && (
                                                <div className="space-y-2.5">
                                                    <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">Perguntas</p>
                                                    {activePlan.questions.map((q, i) => (
                                                        <div key={i} className="space-y-1">
                                                            <label className="text-xs text-neutral-300">{q}</label>
                                                            <input
                                                                type="text"
                                                                value={planAnswers[i] || ''}
                                                                onChange={e => setPlanAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                                                                placeholder="Resposta opcional..."
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
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs rounded-md transition-colors"
                                                >
                                                    {approvingPlan ? <GlitchLoader size={12} /> : <Check size={12} />}
                                                    Aprovar e gerar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={() => { setPendingPlan(null); setPlanAnswers({}); }}
                                                    disabled={approvingPlan}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs rounded-md transition-colors"
                                                >
                                                    <X size={12} />
                                                    Cancelar
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
                                            {inflightToolCalls.some(tc => tc.name === 'generate_or_update_mockup') && (
                                                <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] group">
                                                    <SkeletonLoader width="100%" height="100%" className="h-full w-full" variant="rectangular" />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <GlitchPickaxe />
                                                    </div>
                                                </div>
                                            )}
                                            {inflightToolCalls.length > 0 && (
                                                <div className="space-y-1.5 pt-2 border-t border-white/5">
                                                    {inflightToolCalls.map(tc => (
                                                        <div
                                                            key={tc.id}
                                                            className={cn(
                                                                'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs',
                                                                tc.status === 'error'
                                                                    ? 'bg-red-500/5 border-red-500/20 text-red-300'
                                                                    : tc.status === 'running'
                                                                    ? 'bg-white/5 border-white/10 text-neutral-200'
                                                                    : 'bg-white/[0.02] border-white/5 text-neutral-400'
                                                            )}
                                                        >
                                                            {tc.status === 'running' ? (
                                                                <GlitchLoader size={12} className="shrink-0" />
                                                            ) : tc.status === 'error' ? (
                                                                <Trash2 size={12} className="shrink-0" />
                                                            ) : (
                                                                <FileText size={12} className="shrink-0 text-green-400/70" />
                                                            )}
                                                            <span className="truncate flex-1">{tc.name}</span>
                                                            <span className="text-xs opacity-60">
                                                                {tc.status === 'error' ? (tc.errorMessage || 'falhou').slice(0, 40) : tc.summary || tc.status}
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
                            <div className="border-t border-white/5 bg-black/40 backdrop-blur-md py-8 px-10">
                                <div className="max-w-5xl mx-auto w-full">
                                {/* File Attachments */}
                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4 px-1">
                                        {attachedFiles.map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-md border border-white/10 text-xs text-neutral-300">
                                                {getFileIcon(file.type)}
                                                <span className="truncate max-w-[120px]">{file.name}</span>
                                                <button onClick={() => removeFile(i)} className="hover:text-red-400 ml-1" aria-label="Remover anexo">
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
                                        onClick={() => setPlanModeActive(v => !v)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors',
                                            planModeActive
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                                : 'bg-white/[0.03] border-white/10 text-neutral-500 hover:text-neutral-300 hover:border-white/20'
                                        )}
                                        title="Modo Plano: o agente propõe variações e faz perguntas antes de gerar"
                                    >
                                        <Diamond size={11} className={planModeActive ? 'text-emerald-400' : 'opacity-50'} />
                                        Modo Plano
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
                                                    mode === 'layers' ? 'Texto via layers editáveis (sem texto na imagem)'
                                                    : mode === 'image' ? 'Texto baked na imagem Gemini (sem layers de texto)'
                                                    : 'Texto na imagem + layers (pode conflitar)'
                                                }
                                            >
                                                {mode === 'layers' ? 'Layers' : mode === 'image' ? 'Img' : 'Ambos'}
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
                                    placeholder="Digite sua consulta estratégica..."
                                    showAttach={true}
                                    onAttachClick={() => fileInputRef.current?.click()}
                                    selectedModel={selectedModel}
                                    onModelChange={setSelectedModel}
                                    showModelSelector={true}
                                    modelSelectorType={textMode === 'layers' ? 'chat' : 'image'}
                                />
                                </div>
                            </div>
                        </div>

                        {/* Right-side: Brand Media Kit panel — click-to-attach, drag-to-chat */}
                        {isLargeScreen && selectedBrand && mediaPanelOpen && (
                            <aside className="flex flex-col bg-neutral-950 border-l border-white/5 w-80 shrink-0">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold text-neutral-200 truncate leading-tight">
                                            Media Kit
                                        </h4>
                                        <p className="text-xs text-neutral-500 truncate leading-tight">
                                            {(selectedBrand as any).identity?.name || 'Marca'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
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
                                            aria-label="Importar PDF ou imagens para extrair logos, cores, tipografia"
                                            title="Importar PDF/imagens → extrai logos, cores, tipografia, tokens e media"
                                        >
                                            {brandImport.isPending ? (
                                                <GlitchLoader size={14} />
                                            ) : (
                                                <Upload size={14} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setMediaPanelOpen(false)}
                                            className="p-1 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5 transition-colors"
                                            aria-label="Fechar painel"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
                                    <p className="text-xs text-neutral-500 mb-3 px-1">
                                        Clique ou arraste para o chat
                                    </p>
                                    <MediaKitGallery
                                        guidelineId={(selectedBrand as any).id}
                                        media={(selectedBrand as any).media || []}
                                        logos={(selectedBrand as any).logos || []}
                                        onMediaChange={() => queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })}
                                        onLogosChange={() => queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })}
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
                                        sections={['identity', 'manifesto', 'archetypes', 'personas', 'voiceValues', 'guidelines', 'colors', 'typography']}
                                    />
                                </div>
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
