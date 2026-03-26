import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { expertApi, ExpertChatMessage } from '@/services/expertApi';
import { X, Bot, Loader2, Sparkles, FileText, Image as ImageIcon, Video, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { fileToBase64 } from '@/utils/fileUtils';
import { ChatMessage } from '../shared/chat/ChatMessage';
import { ChatInput } from '../shared/chat/ChatInput';
import { toast } from 'sonner';
import { GEMINI_MODELS } from '@/constants/geminiModels';

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
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() && attachedFiles.length === 0) return;
        if (isLoading || isIngesting) return;

        const currentInput = input;
        const currentFiles = [...attachedFiles];
        
        // 1. If there are files, ingest them first
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
                        },
                        { text: `Conteúdo de ${file.name}` }
                    ];
                    await expertApi.ingest(parts, { fileName: file.name, fileType: file.type }, projectId);
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

        // 2. Add user message
        const userMsg: ExpertChatMessage = { role: 'user', parts: [{ text: currentInput }] };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setAttachedFiles([]);
        setIsLoading(true);

        // 3. Call Chat API
        try {
            const history = messages.slice(1); // Skip initial message
            const response = await expertApi.chat(currentInput, history, projectId, selectedModel);
            
            setMessages(prev => [...prev, {
                role: 'model',
                parts: [{ text: response.text }]
            }]);
        } catch (error) {
            console.error('Chat error:', error);
            toast.error('Erro ao consultar o especialista.');
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
                            mode === 'modal' ? "w-full h-screen md:h-[85vh] md:max-w-2xl flex flex-col shadow-2xl" : "w-full h-full flex flex-col"
                        )}
                    >
                        <GlassPanel className={cn(
                            "h-full flex flex-1 flex-col overflow-hidden",
                            mode === 'modal' ? "rounded-none md:rounded-2xl" : "rounded-none md:rounded-2xl border-none md:border"
                        )} padding="none">
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/5 bg-white/5">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-lg shrink-0">
                                        <Sparkles size={16} className="md:w-[20px]" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-neutral-100 text-sm md:text-base truncate">Especialista em Branding</h3>
                                        <p className="text-[10px] md:text-xs text-neutral-400">Metodologia Visant Labs</p>
                                    </div>
                                </div>
                                {mode === 'modal' && (
                                    <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 h-8 w-8">
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
                                            <span className="text-xs text-neutral-500">O Especialista está pensando...</span>
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
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
