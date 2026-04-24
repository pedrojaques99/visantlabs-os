import React, { useState, useEffect } from 'react';
import { ExternalLink, Lock, Eye, EyeOff, Diamond, Cpu } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import {
    saveGeminiApiKey, deleteGeminiApiKey, hasGeminiApiKey,
    saveSeedreamApiKey, deleteSeedreamApiKey, hasSeedreamApiKey,
    saveOpenAiApiKey, deleteOpenAiApiKey, hasOpenAiApiKey,
    getLlmPreferences, saveLlmPreferences, type LlmPreferences,
} from '@/services/userSettingsService';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { ApiKeyPolicyModal } from '../ApiKeyPolicyModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FigmaTokenSetup } from '../settings/FigmaTokenSetup';

// ── Reusable key-row component ─────────────────────────────────────────────

interface KeyRowProps {
    id: string;
    label: string;
    getKeyUrl: string;
    getKeyLabel?: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggleShow: () => void;
    hasKey: boolean;
    isLoading: boolean;
    onSave: () => void;
    onDelete: () => void;
    placeholder?: string;
}

const KeyRow: React.FC<KeyRowProps> = ({
    id, label, getKeyUrl, getKeyLabel = 'Get key',
    value, onChange, show, onToggleShow,
    hasKey, isLoading, onSave, onDelete,
    placeholder,
}) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <label htmlFor={id} className="text-sm font-semibold text-neutral-300 font-manrope">
                    {label}
                </label>
                {hasKey && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <span className="text-[10px] font-mono text-green-400">active</span>
                    </span>
                )}
            </div>
            <Button
                variant="ghost"
                type="button"
                onClick={() => window.open(getKeyUrl, '_blank')}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-cyan font-mono transition-colors"
            >
                {getKeyLabel}
                <ExternalLink size={11} />
            </Button>
        </div>

        <div className="relative">
            <Input
                id={id}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && value.trim() && !isLoading && onSave()}
                placeholder={hasKey ? '••••••••••••••••••••••••' : placeholder}
                disabled={hasKey && !value}
                className="w-full bg-neutral-950/70 pr-10 font-mono text-sm"
                autoComplete="off"
            />
            <button
                type="button"
                onClick={onToggleShow}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                tabIndex={-1}
                aria-label={show ? 'Hide key' : 'Show key'}
            >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>

        <div className="flex items-center gap-2 justify-end">
            {hasKey && (
                <Button
                    variant="ghost"
                    type="button"
                    onClick={onDelete}
                    disabled={isLoading}
                    className="text-xs text-neutral-500 hover:text-red-400 font-mono"
                >
                    Remove
                </Button>
            )}
            <Button
                variant="brand"
                type="button"
                onClick={onSave}
                disabled={isLoading || !value.trim()}
                className="text-xs px-4 min-w-[80px] flex items-center justify-center"
            >
                {isLoading ? <GlitchLoader size={14} /> : 'Save'}
            </Button>
        </div>
    </div>
);

// ── Section divider ────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-2 pt-6 border-t border-neutral-800/50">
        <span className="text-neutral-500">{icon}</span>
        <h3 className="text-sm font-semibold text-neutral-300 font-manrope">{title}</h3>
    </div>
);

// ── Main component ─────────────────────────────────────────────────────────

export const ApiSettings: React.FC = () => {
    const { t } = useTranslation();

    const [isChecking, setIsChecking] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showPolicyModal, setShowPolicyModal] = useState(false);

    // Gemini
    const [geminiKey, setGeminiKey] = useState('');
    const [showGemini, setShowGemini] = useState(false);
    const [hasGemini, setHasGemini] = useState(false);
    const [confirmDeleteGemini, setConfirmDeleteGemini] = useState(false);

    // Seedream
    const [seedreamKey, setSeedreamKey] = useState('');
    const [showSeedream, setShowSeedream] = useState(false);
    const [hasSeedream, setHasSeedream] = useState(false);
    const [confirmDeleteSeedream, setConfirmDeleteSeedream] = useState(false);

    // OpenAI
    const [openaiKey, setOpenaiKey] = useState('');
    const [showOpenai, setShowOpenai] = useState(false);
    const [hasOpenai, setHasOpenai] = useState(false);
    const [confirmDeleteOpenai, setConfirmDeleteOpenai] = useState(false);

    // LLM preferences
    const [llmPrefs, setLlmPrefs] = useState<LlmPreferences>({ llmProvider: 'gemini', ollamaUrl: '', ollamaModel: '' });
    const [llmDirty, setLlmDirty] = useState(false);
    const [isSavingLlm, setIsSavingLlm] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [g, s, o, prefs] = await Promise.all([
                    hasGeminiApiKey(),
                    hasSeedreamApiKey(),
                    hasOpenAiApiKey(),
                    getLlmPreferences(),
                ]);
                setHasGemini(g);
                setHasSeedream(s);
                setHasOpenai(o);
                setLlmPrefs(prefs);
            } finally {
                setIsChecking(false);
            }
        })();
    }, []);

    // ── Gemini handlers ──────────────────────────────────────────────────
    const saveGemini = async () => {
        if (!geminiKey.trim()) return;
        setIsLoading(true);
        try {
            await saveGeminiApiKey(geminiKey.trim());
            toast.success('Gemini key saved');
            setGeminiKey('');
            setHasGemini(true);
        } catch (e: any) {
            toast.error(e.message || 'Failed to save key');
        } finally { setIsLoading(false); }
    };

    const deleteGemini = async () => {
        setIsLoading(true);
        try {
            await deleteGeminiApiKey();
            toast.success('Gemini key removed');
            setHasGemini(false);
            setGeminiKey('');
            setConfirmDeleteGemini(false);
        } catch (e: any) {
            toast.error(e.message || 'Failed to remove key');
        } finally { setIsLoading(false); }
    };

    // ── Seedream handlers ────────────────────────────────────────────────
    const saveSeedream = async () => {
        if (!seedreamKey.trim()) return;
        setIsLoading(true);
        try {
            await saveSeedreamApiKey(seedreamKey.trim());
            toast.success('Seedream key saved');
            setSeedreamKey('');
            setHasSeedream(true);
        } catch (e: any) {
            toast.error(e.message || 'Failed to save key');
        } finally { setIsLoading(false); }
    };

    const deleteSeedream = async () => {
        setIsLoading(true);
        try {
            await deleteSeedreamApiKey();
            toast.success('Seedream key removed');
            setHasSeedream(false);
            setSeedreamKey('');
            setConfirmDeleteSeedream(false);
        } catch (e: any) {
            toast.error(e.message || 'Failed to remove key');
        } finally { setIsLoading(false); }
    };

    // ── OpenAI handlers ──────────────────────────────────────────────────
    const saveOpenai = async () => {
        if (!openaiKey.trim()) return;
        setIsLoading(true);
        try {
            await saveOpenAiApiKey(openaiKey.trim());
            toast.success('OpenAI key saved');
            setOpenaiKey('');
            setHasOpenai(true);
        } catch (e: any) {
            toast.error(e.message || 'Failed to save key');
        } finally { setIsLoading(false); }
    };

    const deleteOpenai = async () => {
        setIsLoading(true);
        try {
            await deleteOpenAiApiKey();
            toast.success('OpenAI key removed');
            setHasOpenai(false);
            setOpenaiKey('');
            setConfirmDeleteOpenai(false);
        } catch (e: any) {
            toast.error(e.message || 'Failed to remove key');
        } finally { setIsLoading(false); }
    };

    // ── LLM preferences ──────────────────────────────────────────────────
    const updateLlm = <K extends keyof LlmPreferences>(key: K, value: LlmPreferences[K]) => {
        setLlmPrefs(prev => ({ ...prev, [key]: value }));
        setLlmDirty(true);
    };

    const saveLlm = async () => {
        if (llmPrefs.llmProvider === 'ollama' && !/^https?:\/\/.+/.test(llmPrefs.ollamaUrl.trim())) {
            toast.error('Enter a valid Ollama URL (e.g. http://localhost:11434)');
            return;
        }
        setIsSavingLlm(true);
        try {
            const saved = await saveLlmPreferences({
                llmProvider: llmPrefs.llmProvider,
                ollamaUrl: llmPrefs.ollamaUrl.trim(),
                ollamaModel: llmPrefs.ollamaModel.trim(),
            });
            setLlmPrefs(saved);
            setLlmDirty(false);
            toast.success('Preferences saved');
        } catch (e: any) {
            toast.error(e.message || 'Failed to save preferences');
        } finally { setIsSavingLlm(false); }
    };

    if (isChecking) {
        return (
            <div className="flex items-center justify-center py-12">
                <GlitchLoader size={20} />
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full mx-auto animate-in fade-in duration-300">
            <Card className="bg-neutral-900 border border-neutral-800/50 rounded-md">
                <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md bg-neutral-800 border border-neutral-700/50 flex items-center justify-center shrink-0">
                            <Lock size={18} className="text-neutral-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold font-manrope text-neutral-100">
                                API Keys
                            </CardTitle>
                            <CardDescription className="text-xs text-neutral-500 mt-0.5">
                                Keys are encrypted with AES-256 and never exposed.{' '}
                                <button
                                    type="button"
                                    onClick={() => setShowPolicyModal(true)}
                                    className="text-neutral-400 hover:text-neutral-300 underline underline-offset-2 transition-colors"
                                >
                                    Privacy policy
                                </button>
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-4">
                    {/* Gemini */}
                    <KeyRow
                        id="gemini-key"
                        label="Google Gemini"
                        getKeyUrl="https://aistudio.google.com/app/apikey"
                        getKeyLabel="Get key"
                        value={geminiKey}
                        onChange={setGeminiKey}
                        show={showGemini}
                        onToggleShow={() => setShowGemini(v => !v)}
                        hasKey={hasGemini}
                        isLoading={isLoading}
                        onSave={saveGemini}
                        onDelete={() => setConfirmDeleteGemini(true)}
                        placeholder="AIza…"
                    />

                    {/* Seedream */}
                    <SectionDivider icon={<Diamond size={14} />} title="Seedream (APIFree.ai)" />
                    <KeyRow
                        id="seedream-key"
                        label="Seedream"
                        getKeyUrl="https://www.apifree.ai/console"
                        getKeyLabel="Get key"
                        value={seedreamKey}
                        onChange={setSeedreamKey}
                        show={showSeedream}
                        onToggleShow={() => setShowSeedream(v => !v)}
                        hasKey={hasSeedream}
                        isLoading={isLoading}
                        onSave={saveSeedream}
                        onDelete={() => setConfirmDeleteSeedream(true)}
                        placeholder="Seedream API key"
                    />

                    {/* OpenAI */}
                    <SectionDivider icon={<Diamond size={14} />} title="OpenAI" />
                    <KeyRow
                        id="openai-key"
                        label="OpenAI (GPT-Image)"
                        getKeyUrl="https://platform.openai.com/api-keys"
                        getKeyLabel="Get key"
                        value={openaiKey}
                        onChange={setOpenaiKey}
                        show={showOpenai}
                        onToggleShow={() => setShowOpenai(v => !v)}
                        hasKey={hasOpenai}
                        isLoading={isLoading}
                        onSave={saveOpenai}
                        onDelete={() => setConfirmDeleteOpenai(true)}
                        placeholder="sk-…"
                    />

                    {/* LLM Preferences */}
                    <SectionDivider icon={<Cpu size={14} />} title="Language Model" />

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-neutral-300 font-manrope">
                                Admin Chat Provider
                            </label>
                            <Select
                                value={llmPrefs.llmProvider}
                                onChange={(v) => updateLlm('llmProvider', v as 'gemini' | 'ollama')}
                                options={[
                                    { value: 'gemini', label: 'Gemini (cloud, default)' },
                                    { value: 'ollama', label: 'Ollama (local / self-hosted)' },
                                ]}
                            />
                        </div>

                        {llmPrefs.llmProvider === 'ollama' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="ollama-url" className="text-sm font-semibold text-neutral-300 font-manrope">
                                            Ollama URL
                                        </label>
                                        <Button
                                            variant="ghost"
                                            type="button"
                                            onClick={() => window.open('https://ollama.com/download', '_blank')}
                                            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-cyan font-mono"
                                        >
                                            Install Ollama <ExternalLink size={11} />
                                        </Button>
                                    </div>
                                    <Input
                                        id="ollama-url"
                                        type="url"
                                        value={llmPrefs.ollamaUrl}
                                        onChange={(e) => updateLlm('ollamaUrl', e.target.value)}
                                        placeholder="http://localhost:11434"
                                        className="font-mono text-sm"
                                        autoComplete="off"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="ollama-model" className="text-sm font-semibold text-neutral-300 font-manrope">
                                        Model
                                    </label>
                                    <Input
                                        id="ollama-model"
                                        type="text"
                                        value={llmPrefs.ollamaModel}
                                        onChange={(e) => updateLlm('ollamaModel', e.target.value)}
                                        placeholder="llama3.1"
                                        className="font-mono text-sm"
                                        autoComplete="off"
                                    />
                                    <p className="text-xs text-neutral-600 font-mono">
                                        e.g. llama3.1, mistral, qwen2.5
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button
                                variant="brand"
                                type="button"
                                onClick={saveLlm}
                                disabled={isSavingLlm || !llmDirty}
                                className="text-xs px-4 min-w-[80px] flex items-center justify-center"
                            >
                                {isSavingLlm ? <GlitchLoader size={14} /> : 'Save'}
                            </Button>
                        </div>
                    </div>

                    {/* Figma */}
                    <FigmaTokenSetup />
                </CardContent>
            </Card>

            {/* Confirmation modals */}
            <ConfirmationModal
                isOpen={confirmDeleteGemini}
                onClose={() => setConfirmDeleteGemini(false)}
                onConfirm={deleteGemini}
                title="Remove Gemini key"
                message="Your Gemini API key will be deleted. You can add a new one at any time."
                variant="danger"
            />
            <ConfirmationModal
                isOpen={confirmDeleteSeedream}
                onClose={() => setConfirmDeleteSeedream(false)}
                onConfirm={deleteSeedream}
                title="Remove Seedream key"
                message="Your Seedream API key will be deleted. You can add a new one at any time."
                variant="danger"
            />
            <ConfirmationModal
                isOpen={confirmDeleteOpenai}
                onClose={() => setConfirmDeleteOpenai(false)}
                onConfirm={deleteOpenai}
                title="Remove OpenAI key"
                message="Your OpenAI API key will be deleted. You can add a new one at any time."
                variant="danger"
            />

            <ApiKeyPolicyModal
                isOpen={showPolicyModal}
                onClose={() => setShowPolicyModal(false)}
            />
        </div>
    );
};
