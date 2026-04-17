import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { useQuery } from '@tanstack/react-query';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { adminChatApi, AdminChatMessage, AdminChatSession } from '@/services/adminChatApi';
import { X, Bot, Loader2, Shield, FileText, Image as ImageIcon, Video, Paperclip, Plus, Trash2, ChevronLeft, Menu, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { fileToBase64 } from '@/utils/fileUtils';
import { ChatMessage } from '../shared/chat/ChatMessage';
import { ChatInput } from '../shared/chat/ChatInput';
import { toast } from 'sonner';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { Select } from '@/components/ui/select';

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
    const [selectedModel, setSelectedModel] = useState<string>('gemini-2.0-flash'); // Default admin model

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load sessions
    const { data: sessions = [], isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
      queryKey: ['admin-chat-sessions'],
      queryFn: () => adminChatApi.listSessions(),
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
            const session = await adminChatApi.createSession(selectedBrandId || undefined);
            setCurrentSessionId(session._id);
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

            // 4. Send message to session
            try {
                const { reply, action, actionResult, creativeProjects, toolsUsed, generationId } = await adminChatApi.sendMessage(sessionId, currentInput);

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: reply,
                    timestamp: new Date().toISOString(),
                    action,
                    actionResult,
                    creativeProjects,
                    generationId
                }]);

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
                        : "w-full h-full flex flex-col min-h-[600px]"
                )}>
                    <motion.div
                        initial={mode === 'modal' ? { opacity: 0, scale: 0.95, y: 20 } : false}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "bg-neutral-900 border border-white/5 shadow-2xl overflow-hidden flex",
                            mode === 'modal' ? "w-full h-screen md:h-[85vh] md:max-w-4xl rounded-2xl" : "w-full h-full rounded-xl"
                        )}
                    >
                        {/* Sidebar */}
                        <div className={cn(
                            "flex flex-col bg-neutral-950/80 border-r border-white/5 transition-all duration-200 ease-in-out",
                            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
                        )}>
                            {/* New Session Button */}
                            <div className="p-4 border-b border-white/5">
                                <button
                                    onClick={createNewSession}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-cyan/20 border border-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan text-sm font-medium transition-all"
                                >
                                    <Plus size={16} />
                                    <span>Nova Sessão Admin</span>
                                </button>
                            </div>

                            {/* Sessions List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loadingSessions ? (
                                    <div className="flex items-center justify-center h-12 text-xs text-neutral-500 font-mono">
                                        <Loader2 size={12} className="animate-spin mr-2" />
                                        LISTING...
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="text-[10px] text-neutral-600 p-4 text-center font-mono uppercase tracking-widest">
                                        EMPTY REPOSITORY
                                    </div>
                                ) : (
                                    sessions.map((session: any) => (
                                        <div
                                            key={session._id}
                                            onClick={() => loadSession(session._id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors group relative",
                                                currentSessionId === session._id
                                                    ? "bg-white/10 text-white border border-white/5"
                                                    : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Hash size={12} className="shrink-0 opacity-30" />
                                                    <span className="truncate" title={session.title}>
                                                        {session.title}
                                                    </span>
                                                </div>
                                                {currentSessionId === session._id && (
                                                    <button
                                                        onClick={(e) => deleteSession(session._id, e)}
                                                        disabled={deletingSessionId === session._id}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded"
                                                    >
                                                        <Trash2 size={12} className="text-red-500/60 hover:text-red-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Main Chat Area */}
                        <div className="flex flex-col flex-1 min-w-0 bg-[#0C0C0C]">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <button
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 mr-1"
                                    >
                                        <Menu size={18} />
                                    </button>
                                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan shadow-lg shrink-0">
                                        <Shield size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-neutral-100 text-sm md:text-base tracking-tight truncate">
                                            Assistente Estratégico
                                        </h3>
                                        <p className="text-[10px] text-brand-cyan/60 font-mono uppercase tracking-[0.2em]">
                                            Admin Session
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Brand Context Selector */}
                                    {brandGuidelines && brandGuidelines.length > 0 && (
                                        <div className="hidden md:block w-48">
                                            <Select
                                                options={brandGuidelines.map((brand: any) => ({
                                                    value: brand.id,
                                                    label: brand.identity?.name || brand.id
                                                }))}
                                                value={selectedBrandId}
                                                onChange={setSelectedBrandId}
                                                placeholder="MARCA CONTEXTO"
                                                className="text-[10px] font-mono"
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
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                                {messages.map((msg, i) => (
                                    <ChatMessage
                                        key={i}
                                        role={msg.role as any}
                                        content={msg.content}
                                        t={t}
                                        attachments={msg.attachments}
                                        creativeProjects={msg.creativeProjects}
                                        generationId={msg.generationId}
                                        feature="admin-chat"
                                    />
                                ))}
                                {isLoading && (
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-brand-cyan/20 flex items-center justify-center shadow-lg">
                                            <Bot size={16} className="text-brand-cyan animate-pulse" />
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex items-center gap-3">
                                            <Loader2 size={16} className="animate-spin text-brand-cyan/40" />
                                            <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                                                Analyzing Strategic Data...
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} className="h-4" />
                            </div>

                            {/* Footer / Input */}
                            <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md">
                                {/* File Attachments */}
                                {attachedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-4 px-1">
                                        {attachedFiles.map((file, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-brand-cyan/10 rounded-md border border-brand-cyan/10 text-[10px] text-brand-cyan font-mono uppercase">
                                                {getFileIcon(file.type)}
                                                <span className="truncate max-w-[120px]">{file.name}</span>
                                                <button onClick={() => removeFile(i)} className="hover:text-red-400 ml-1">
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
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
