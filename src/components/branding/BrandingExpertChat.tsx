import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useQuery } from '@tanstack/react-query';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { expertApi, ExpertChatMessage } from '@/services/expertApi';
import { chatApi, ChatSession } from '@/services/chatApi';
import { X, Bot, Loader2, Diamond, FileText, Image as ImageIcon, Video, Paperclip, Plus, Trash2, ChevronLeft, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { fileToBase64 } from '@/utils/fileUtils';
import { ChatMessage } from '../shared/chat/ChatMessage';
import { ChatInput } from '../shared/chat/ChatInput';
import { toast } from 'sonner';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { Select } from '@/components/ui/select';

interface BrandingExpertChatProps {
    projectId?: string;
    isOpen?: boolean;
    onClose?: () => void;
    mode?: 'modal' | 'inline';
}

export const BrandingExpertChat: React.FC<BrandingExpertChatProps> = ({
    projectId,
    isOpen = true,
    onClose,
    mode = 'modal'
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const { data: brandGuidelines } = useBrandGuidelines();

    // Session management
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ExpertChatMessage[]>([
        {
            role: 'model',
            parts: [{ text: 'Olá! Sou seu Especialista em Branding da Visant Labs. Como posso ajudar com sua marca hoje? Você pode subir manuais, referências ou me perguntar sobre sua estratégia.' }]
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(GEMINI_MODELS.PRO_2_0);
    const [selectedBrandId, setSelectedBrandId] = useState<string>('');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [toolsBeingUsed, setToolsBeingUsed] = useState<string[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load sessions
    const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
      queryKey: ['chat-sessions'],
      queryFn: () => chatApi.listSessions(),
      staleTime: 30000,
      gcTime: 60000,
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const createNewSession = async () => {
        try {
            const session = await chatApi.createSession('Nova sessão', selectedBrandId || undefined);
            setCurrentSessionId(session._id);
            setMessages([
                {
                    role: 'model',
                    parts: [{ text: 'Olá! Sou seu Especialista em Branding da Visant Labs. Como posso ajudar com sua marca hoje? Você pode subir manuais, referências ou me perguntar sobre sua estratégia.' }]
                }
            ]);
            await refetchSessions();
            return session._id;
        } catch (error) {
            console.error('Session creation error:', error);
            toast.error('Erro ao criar sessão.');
            throw error;
        }
    };

    const loadSession = async (sessionId: string) => {
        try {
            const session = await chatApi.getSession(sessionId);
            setCurrentSessionId(sessionId);
            setSelectedBrandId(session.brandGuidelineId || '');

            // Convert to ExpertChatMessage format
            const convertedMessages: ExpertChatMessage[] = session.messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            // Add initial greeting if no messages
            if (convertedMessages.length === 0) {
                convertedMessages.push({
                    role: 'model',
                    parts: [{ text: 'Olá! Sou seu Especialista em Branding da Visant Labs. Como posso ajudar com sua marca hoje? Você pode subir manuais, referências ou me perguntar sobre sua estratégia.' }]
                });
            }

            setMessages(convertedMessages);
        } catch (error) {
            console.error('Load session error:', error);
            toast.error('Erro ao carregar sessão.');
        }
    };

    const deleteSession = async (sessionId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        setDeletingSessionId(sessionId);
        try {
            await chatApi.deleteSession(sessionId);
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
                setMessages([
                    {
                        role: 'model',
                        parts: [{ text: 'Olá! Sou seu Especialista em Branding da Visant Labs. Como posso ajudar com sua marca hoje? Você pode subir manuais, referências ou me perguntar sobre sua estratégia.' }]
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

    const startEditingTitle = (sessionId: string, currentTitle: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingSessionId(sessionId);
        setEditingTitle(currentTitle);
    };

    const saveEditedTitle = async (sessionId: string) => {
        if (!editingTitle.trim()) {
            setEditingSessionId(null);
            return;
        }

        try {
            await chatApi.renameSession(sessionId, editingTitle.trim());
            await refetchSessions();
            toast.success('Sessão renomeada.');
        } catch (error) {
            console.error('Rename session error:', error);
            toast.error('Erro ao renomear sessão.');
        } finally {
            setEditingSessionId(null);
            setEditingTitle('');
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
                        const parts = [
                            {
                                inlineData: {
                                    data: base64,
                                    mimeType: file.type
                                }
                            }
                        ];
                        await chatApi.uploadToSession(sessionId, parts, { fileName: file.name, fileType: file.type });
                    }
                    toast.success('Arquivos integrados à base de conhecimento!');
                } catch (error) {
                    console.error('Ingestion error:', error);
                    toast.error('Erro ao processar arquivos.');
                    setIsIngesting(false);
                    return;
                }
                setIsIngesting(false);
            }

            // 3. Add user message
            const userMsg: ExpertChatMessage = { role: 'user', parts: [{ text: currentInput }] };
            setMessages(prev => [...prev, userMsg]);
            setInput('');
            setAttachedFiles([]);
            setIsLoading(true);

            // 4. Send message to session
            try {
                setToolsBeingUsed([]);
                const { reply, toolsUsed } = await chatApi.sendMessage(sessionId, currentInput);

                if (toolsUsed?.length) {
                    setToolsBeingUsed(toolsUsed);
                }

                setMessages(prev => [...prev, {
                    role: 'model',
                    parts: [{ text: reply }]
                }]);

                // Clear tools feedback after a delay
                if (toolsUsed?.length) {
                    setTimeout(() => setToolsBeingUsed([]), 2000);
                }

                // Refresh sessions list to update timestamps
                await refetchSessions();
            } catch (error) {
                console.error('Chat error:', error);
                toast.error('Erro ao consultar o especialista.');
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


    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <ImageIcon size={14} />;
        if (type.startsWith('video/')) return <Video size={14} />;
        if (type === 'application/pdf') return <FileText size={14} />;
        return <Paperclip size={14} />;
    };

    return (
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
                            mode === 'modal' ? "w-full h-screen md:h-[85vh] md:max-w-4xl flex shadow-2xl" : "w-full h-full flex"
                        )}
                    >
                        {/* Sidebar */}
                        <div className={cn(
                            "flex flex-col bg-neutral-950/80 border-r border-white/5 transition-all duration-200 ease-in-out",
                            mode === 'modal' ? "rounded-l-2xl md:rounded-l-2xl" : "rounded-none",
                            sidebarOpen ? "w-48" : "w-0 overflow-hidden"
                        )}>
                            {/* New Session Button */}
                            <div className="p-3 border-b border-white/5">
                                <button
                                    onClick={createNewSession}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                                >
                                    <Plus size={16} />
                                    <span>Nova</span>
                                </button>
                            </div>

                            {/* Sessions List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loadingSessions ? (
                                    <div className="flex items-center justify-center h-12 text-xs text-neutral-500">
                                        Carregando...
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="text-xs text-neutral-500 p-2 text-center">
                                        Nenhuma sessão
                                    </div>
                                ) : (
                                    sessions.map((session: any) => (
                                        <div
                                            key={session._id}
                                            onClick={() => loadSession(session._id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors group relative",
                                                currentSessionId === session._id
                                                    ? "bg-white/15 text-white"
                                                    : "text-neutral-400 hover:bg-white/10 hover:text-neutral-200"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                {editingSessionId === session._id ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={editingTitle}
                                                        onChange={(e) => setEditingTitle(e.target.value)}
                                                        onBlur={() => saveEditedTitle(session._id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEditedTitle(session._id);
                                                            if (e.key === 'Escape') setEditingSessionId(null);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"
                                                        placeholder="Título da sessão"
                                                    />
                                                ) : (
                                                    <span
                                                        onDoubleClick={(e) => startEditingTitle(session._id, session.title, e)}
                                                        className="flex-1 truncate cursor-text hover:underline"
                                                        title={session.title}
                                                    >
                                                        {session.title}
                                                    </span>
                                                )}
                                                {currentSessionId === session._id && editingSessionId !== session._id && (
                                                    <button
                                                        onClick={(e) => deleteSession(session._id, e)}
                                                        disabled={deletingSessionId === session._id}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={14} className="text-red-400 hover:text-red-300" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Main Chat Area */}
                        <div className="flex flex-col flex-1 min-w-0">
                            {/* Mobile Sidebar Toggle */}
                            {mode === 'modal' && (
                                <div className="md:hidden flex items-center p-2 border-b border-white/5">
                                    <button
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
                                    </button>
                                </div>
                            )}

                        <GlassPanel className={cn(
                            "h-full flex flex-1 flex-col overflow-hidden",
                            mode === 'modal' ? "rounded-none md:rounded-r-2xl border-0 md:border-l md:border-white/5" : "rounded-none md:rounded-2xl border-none md:border"
                        )} padding="none">
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/5 bg-white/5 gap-3">
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-lg shrink-0">
                                        <Diamond size={16} className="md:w-[20px]" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-neutral-100 text-sm md:text-base truncate">Especialista em Branding</h3>
                                        <p className="text-[10px] md:text-xs text-neutral-400">Metodologia Visant Labs</p>
                                    </div>
                                </div>

                                {/* Brand Selector in Header */}
                                {brandGuidelines && brandGuidelines.length > 0 && (
                                    <div className="shrink-0">
                                        <Select
                                            options={brandGuidelines.map((brand: any) => ({
                                                value: brand.id,
                                                label: brand.identity?.name || brand.id
                                            }))}
                                            value={selectedBrandId}
                                            onChange={setSelectedBrandId}
                                            placeholder="Brand"
                                            className="text-xs"
                                            variant="node"
                                        />
                                    </div>
                                )}

                                {mode === 'modal' && (
                                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 h-8 w-8 shrink-0">
                                        <X size={18} />
                                    </Button>
                                )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin overflow-x-hidden" ref={scrollRef}>
                                {messages.map((msg, i) => (
                                    <ChatMessage 
                                        key={i}
                                        role={msg.role as any}
                                        content={msg.parts[0].text}
                                        t={t}
                                    />
                                ))}
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center">
                                            <Bot size={16} className="text-brand-cyan animate-pulse" />
                                        </div>
                                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-2">
                                            <Loader2 size={16} className="animate-spin text-neutral-500" />
                                            <span className="text-xs text-neutral-500">
                                                {toolsBeingUsed.length > 0
                                                    ? toolsBeingUsed.includes('web_search')
                                                        ? '🔍 Pesquisando na web...'
                                                        : `Usando ferramentas: ${toolsBeingUsed.join(', ')}...`
                                                    : 'O Especialista está pensando...'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} className="h-2 md:h-4" />
                            </div>

                            {/* Footer / Input - Native Feel */}
                            <div className="p-2 md:p-4 border-t border-white/5 bg-neutral-950/40 relative z-30 pb-[env(safe-area-inset-bottom,16px)]">
                                {/* Attached Files */}
                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2 px-1">
                                        {attachedFiles.map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded-md border border-white/5 text-[10px] text-neutral-300">
                                                {getFileIcon(file.type)}
                                                <span className="truncate max-w-[100px]">{file.name}</span>
                                                <button onClick={() => removeFile(i)} className="hover:text-red-400">
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
                                    accept="image/*,video/*,application/pdf"
                                />

                                <ChatInput
                                    value={input}
                                    onChange={setInput}
                                    onSend={handleSend}
                                    isLoading={isLoading}
                                    isIngesting={isIngesting}
                                    placeholder="Mensagem..."
                                    showAttach={authService.isAdmin()}
                                    onAttachClick={() => fileInputRef.current?.click()}
                                    selectedModel={selectedModel}
                                    onModelChange={setSelectedModel}
                                    showModelSelector={true}
                                />
                            </div>
                        </GlassPanel>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
