import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Lock, Eye, EyeOff, Sparkles, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { saveGeminiApiKey, deleteGeminiApiKey, hasGeminiApiKey } from '../../services/userSettingsService';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { ApiKeyPolicyModal } from '../ApiKeyPolicyModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { GlitchLoader } from '../ui/GlitchLoader';

export const ApiSettings: React.FC = () => {
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [hasKey, setHasKey] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showPolicyModal, setShowPolicyModal] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        checkApiKeyStatus();
    }, []);

    const checkApiKeyStatus = async () => {
        setIsChecking(true);
        try {
            const hasSavedKey = await hasGeminiApiKey();
            setHasKey(hasSavedKey);
            if (hasSavedKey) {
                setApiKey('');
            }
        } catch (error) {
            console.error('Failed to check API key status:', error);
        } finally {
            setIsChecking(false);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            toast.error(t('configuration.error') || 'A chave da API não pode estar vazia');
            return;
        }

        setIsLoading(true);
        try {
            await saveGeminiApiKey(apiKey.trim());
            toast.success(t('configuration.saved') || 'Chave da API salva com sucesso');
            setApiKey('');
            setHasKey(true);
        } catch (error: any) {
            console.error('Failed to save API key:', error);
            toast.error(error.message || t('configuration.error') || 'Falha ao salvar chave da API');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        setIsLoading(true);
        try {
            await deleteGeminiApiKey();
            toast.success(t('configuration.deleted') || 'Chave da API removida com sucesso');
            setHasKey(false);
            setApiKey('');
            setShowDeleteConfirm(false);
        } catch (error: any) {
            console.error('Failed to delete API key:', error);
            toast.error(error.message || 'Falha ao remover a chave da API');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && apiKey.trim() && !isLoading) {
            handleSave();
        }
    };

    if (isChecking) {
        return (
            <div className="flex items-center justify-center py-12">
                <GlitchLoader size={20} />
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full mx-auto animate-in fade-in duration-500">
            <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-2xl shadow-xl shadow-black/20">
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-cyan/10 to-blue-500/10 border border-brand-cyan/20 flex items-center justify-center shadow-lg shadow-brand-cyan/5">
                                <Sparkles size={24} className="text-brand-cyan" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold font-manrope text-zinc-100 mb-1">
                                    {t('configuration.title') || 'Configuração'}
                                </CardTitle>
                                <CardDescription className="text-zinc-500 font-mono text-xs">
                                    Gerencie suas chaves de API e conexões externas
                                </CardDescription>
                            </div>
                        </div>
                        {hasKey && (
                            <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs font-mono text-green-400 font-medium">Ativo</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Info Box */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Lock size={64} />
                        </div>
                        <div className="flex items-start gap-3 relative z-10">
                            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                                <Lock size={16} className="text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-zinc-300 font-medium font-manrope">
                                    {t('configuration.privateKey') || "Sua chave é mantida privada"}
                                </p>
                                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                                    {t('configuration.info') || "Usar sua própria chave de API permite que você utilize sua própria cota e créditos do Google."}
                                    <br />
                                    {t('configuration.warning') || "Sua chave é criptografada e armazenada com segurança. Apenas você pode acessá-la."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label htmlFor="api-key-input" className="text-sm font-semibold text-zinc-300 font-manrope">
                                {t('configuration.geminiApiKey') || 'Chave da API Gemini'}
                            </label>
                            <button
                                type="button"
                                onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                                className="flex items-center gap-1.5 text-xs text-brand-cyan hover:text-brand-cyan/80 font-mono transition-colors group"
                            >
                                <span>{t('configuration.getApiKey') || 'Obter chave'}</span>
                                <ExternalLink size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </button>
                        </div>

                        <div className="relative group">
                            <input
                                id="api-key-input"
                                ref={inputRef}
                                type={showApiKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={hasKey ? '••••••••••••••••••••••••••••••••' : (t('configuration.apiKeyPlaceholder') || 'Insira sua chave da API Gemini')}
                                disabled={hasKey && !apiKey}
                                className="w-full bg-black/40 px-4 py-3.5 pr-12 rounded-xl border border-zinc-800 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 text-sm text-zinc-200 font-mono placeholder:text-zinc-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-all duration-150"
                                aria-label={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
                                tabIndex={-1}
                            >
                                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {hasKey && !apiKey && (
                            <p className="text-xs text-zinc-500 font-mono pl-1">
                                {t('configuration.updateHint') || 'Para atualizar, basta colar sua nova chave acima.'}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-start pt-2">
                        <button
                            type="button"
                            onClick={() => setShowPolicyModal(true)}
                            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400 font-mono transition-colors"
                        >
                            <Lock size={12} />
                            <span>{t('configuration.policyLink') || 'Política de Privacidade e Segurança'}</span>
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-6 border-t border-zinc-800/50">
                        {hasKey && (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isLoading}
                                className="px-4 py-2.5 bg-zinc-900/50 hover:bg-red-500/10 disabled:bg-zinc-900/30 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-400 hover:text-red-400 border border-zinc-800/50 hover:border-red-500/30 font-medium rounded-xl transition-all duration-200 text-xs font-mono"
                            >
                                {t('configuration.delete') || 'Remover Chave'}
                            </button>
                        )}
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isLoading || !apiKey.trim()}
                            className="px-8 py-2.5 bg-brand-cyan hover:bg-brand-cyan/90 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all duration-200 text-sm font-mono shadow-lg shadow-brand-cyan/20 hover:shadow-brand-cyan/30 disabled:shadow-none min-w-[100px] flex items-center justify-center"
                        >
                            {isLoading ? (
                                <GlitchLoader size={16} />
                            ) : (
                                t('configuration.save') || 'Salvar Alterações'
                            )}
                        </button>
                    </div>
                </CardContent>
            </Card>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title={t('configuration.delete') || 'Excluir Chave da API'}
                message={t('configuration.deleteConfirmMessage') || "Tem certeza de que deseja excluir sua chave de API? Você precisará inseri-la novamente para usar sua própria cota."}
                variant="danger"
            />

            <ApiKeyPolicyModal
                isOpen={showPolicyModal}
                onClose={() => setShowPolicyModal(false)}
            />
        </div>
    );
};
