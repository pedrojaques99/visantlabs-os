import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Eye, EyeOff } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import {
  saveGeminiApiKey,
  deleteGeminiApiKey,
  hasGeminiApiKey,
  saveSeedreamApiKey,
  deleteSeedreamApiKey,
  hasSeedreamApiKey,
  saveOpenAiApiKey,
  deleteOpenAiApiKey,
  hasOpenAiApiKey,
  getLlmPreferences,
  saveLlmPreferences,
  type LlmPreferences,
} from '@/services/userSettingsService';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';
import { ApiKeyPolicyModal } from '../ApiKeyPolicyModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/badge';
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
  labels: {
    getKey: string;
    active: string;
    show: string;
    hide: string;
    remove: string;
    save: string;
  };
}

const KeyRow: React.FC<KeyRowProps> = ({
  id,
  label,
  getKeyUrl,
  getKeyLabel,
  value,
  onChange,
  show,
  onToggleShow,
  hasKey,
  isLoading,
  onSave,
  onDelete,
  placeholder,
  labels,
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-foreground truncate">
          {label}
        </label>
        {hasKey && <Badge variant="success">{labels.active}</Badge>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => window.open(getKeyUrl, '_blank', 'noopener,noreferrer')}
        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {getKeyLabel ?? labels.getKey}
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
        className="w-full pr-10 font-mono text-sm"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? labels.hide : labels.show}
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
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          {labels.remove}
        </Button>
      )}
      <Button
        variant="brand"
        type="button"
        onClick={onSave}
        disabled={isLoading || !value.trim()}
        className="text-xs px-4 min-w-[80px] flex items-center justify-center"
      >
        {isLoading ? <GlitchLoader size={14} /> : labels.save}
      </Button>
    </div>
  </div>
);

// ── Section divider ────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ title: string }> = ({ title }) => (
  <div className="pt-6 border-t border-border">
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────

export const ApiSettings: React.FC = () => {
  const { t } = useTranslation();

  const [isChecking, setIsChecking] = useState(true);
  // Falha ao ler o estado das chaves ≠ "nenhuma chave": sem isso, a tela dizia
  // que o usuário não tinha chave nenhuma quando a API caiu.
  const [checkFailed, setCheckFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  // BYOK keys are hidden by default — revealed only when the user opts in
  const [showByokKeys, setShowByokKeys] = useState(false);

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
  const [llmPrefs, setLlmPrefs] = useState<LlmPreferences>({
    llmProvider: 'gemini',
    ollamaUrl: '',
    ollamaModel: '',
  });
  const [llmDirty, setLlmDirty] = useState(false);
  const [isSavingLlm, setIsSavingLlm] = useState(false);

  const loadState = useCallback(async () => {
    setIsChecking(true);
    setCheckFailed(false);
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
    } catch (err) {
      console.error('[ApiSettings] load failed:', err);
      setCheckFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const keyLabels = {
    getKey: t('profile.byok.getKey'),
    active: t('profile.byok.active'),
    show: t('profile.byok.showKey'),
    hide: t('profile.byok.hideKey'),
    remove: t('profile.byok.remove'),
    save: t('common.save'),
  };

  // ── Gemini handlers ──────────────────────────────────────────────────
  const saveGemini = async () => {
    if (!geminiKey.trim()) return;
    setIsLoading(true);
    try {
      await saveGeminiApiKey(geminiKey.trim());
      toast.success(t('profile.byok.keySaved', { provider: 'Gemini' }));
      setGeminiKey('');
      setHasGemini(true);
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteGemini = async () => {
    setIsLoading(true);
    try {
      await deleteGeminiApiKey();
      toast.success(t('profile.byok.keyRemoved', { provider: 'Gemini' }));
      setHasGemini(false);
      setGeminiKey('');
      setConfirmDeleteGemini(false);
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.removeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Seedream handlers ────────────────────────────────────────────────
  const saveSeedream = async () => {
    if (!seedreamKey.trim()) return;
    setIsLoading(true);
    try {
      await saveSeedreamApiKey(seedreamKey.trim());
      toast.success(t('profile.byok.keySaved', { provider: 'Seedream' }));
      setSeedreamKey('');
      setHasSeedream(true);
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSeedream = async () => {
    setIsLoading(true);
    try {
      await deleteSeedreamApiKey();
      toast.success(t('profile.byok.keyRemoved', { provider: 'Seedream' }));
      setHasSeedream(false);
      setSeedreamKey('');
      setConfirmDeleteSeedream(false);
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.removeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── OpenAI handlers ──────────────────────────────────────────────────
  const saveOpenai = async () => {
    if (!openaiKey.trim()) return;
    setIsLoading(true);
    try {
      await saveOpenAiApiKey(openaiKey.trim());
      toast.success(t('profile.byok.keySaved', { provider: 'OpenAI' }));
      setOpenaiKey('');
      setHasOpenai(true);
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.saveFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteOpenai = async () => {
    setIsLoading(true);
    try {
      await deleteOpenAiApiKey();
      toast.success(t('profile.byok.keyRemoved', { provider: 'OpenAI' }));
      setHasOpenai(false);
      setOpenaiKey('');
      setConfirmDeleteOpenai(false);
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.removeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // ── LLM preferences ──────────────────────────────────────────────────
  const updateLlm = <K extends keyof LlmPreferences>(key: K, value: LlmPreferences[K]) => {
    setLlmPrefs((prev) => ({ ...prev, [key]: value }));
    setLlmDirty(true);
  };

  const saveLlm = async () => {
    if (llmPrefs.llmProvider === 'ollama' && !/^https?:\/\/.+/.test(llmPrefs.ollamaUrl.trim())) {
      toast.error(t('profile.byok.invalidOllamaUrl'));
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
      toast.success(t('profile.byok.prefsSaved'));
    } catch (e: any) {
      toast.error(e.message || t('profile.byok.prefsSaveFailed'));
    } finally {
      setIsSavingLlm(false);
    }
  };

  const byokActiveCount = (hasGemini ? 1 : 0) + (hasSeedream ? 1 : 0) + (hasOpenai ? 1 : 0);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-12">
        <GlitchLoader size={20} />
      </div>
    );
  }

  if (checkFailed) {
    return <ErrorState title={t('profile.byok.loadFailed')} onRetry={loadState} />;
  }

  return (
    <div className="space-y-6 w-full mx-auto animate-in fade-in duration-300">
      <Card className="bg-card border border-border rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">
            {t('profile.byok.title')}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            {t('profile.byok.encrypted')}{' '}
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {t('profile.byok.privacyPolicy')}
            </button>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* BYOK keys — hidden by default, revealed on demand */}
          {!showByokKeys ? (
            <button
              type="button"
              onClick={() => setShowByokKeys(true)}
              className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-left hover:border-ring transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t('profile.byok.byokTitle')}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {byokActiveCount === 1
                    ? t('profile.byok.activeOne')
                    : byokActiveCount > 1
                      ? t('profile.byok.activeMany', { count: byokActiveCount })
                      : t('profile.byok.byokHint')}
                </p>
              </div>
              <span className="text-xs text-foreground shrink-0">
                {t('profile.byok.configure')}
              </span>
            </button>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Gemini */}
              <KeyRow
                id="gemini-key"
                label="Google Gemini"
                getKeyUrl="https://aistudio.google.com/app/apikey"
                value={geminiKey}
                onChange={setGeminiKey}
                show={showGemini}
                onToggleShow={() => setShowGemini((v) => !v)}
                hasKey={hasGemini}
                isLoading={isLoading}
                onSave={saveGemini}
                onDelete={() => setConfirmDeleteGemini(true)}
                placeholder="AIza…"
                labels={keyLabels}
              />

              {/* Seedream */}
              <SectionDivider title="Seedream (BytePlus)" />
              <KeyRow
                id="seedream-key"
                label="Seedream"
                getKeyUrl="https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey"
                value={seedreamKey}
                onChange={setSeedreamKey}
                show={showSeedream}
                onToggleShow={() => setShowSeedream((v) => !v)}
                hasKey={hasSeedream}
                isLoading={isLoading}
                onSave={saveSeedream}
                onDelete={() => setConfirmDeleteSeedream(true)}
                placeholder="Seedream API key"
                labels={keyLabels}
              />

              {/* OpenAI */}
              <SectionDivider title="OpenAI" />
              <KeyRow
                id="openai-key"
                label="OpenAI (GPT-Image)"
                getKeyUrl="https://platform.openai.com/api-keys"
                value={openaiKey}
                onChange={setOpenaiKey}
                show={showOpenai}
                onToggleShow={() => setShowOpenai((v) => !v)}
                hasKey={hasOpenai}
                isLoading={isLoading}
                onSave={saveOpenai}
                onDelete={() => setConfirmDeleteOpenai(true)}
                placeholder="sk-…"
                labels={keyLabels}
              />

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setShowByokKeys(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('profile.byok.hideKeys')}
                </Button>
              </div>
            </div>
          )}

          {/* LLM Preferences */}
          <SectionDivider title={t('profile.byok.languageModel')} />

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                {t('profile.byok.adminChatProvider')}
              </label>
              <Select
                value={llmPrefs.llmProvider}
                onChange={(v) => updateLlm('llmProvider', v as 'gemini' | 'ollama')}
                options={[
                  { value: 'gemini', label: t('profile.byok.providerGemini') },
                  { value: 'ollama', label: t('profile.byok.providerOllama') },
                ]}
              />
            </div>

            {llmPrefs.llmProvider === 'ollama' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="ollama-url" className="text-sm font-semibold text-foreground">
                      Ollama URL
                    </label>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      onClick={() =>
                        window.open('https://ollama.com/download', '_blank', 'noopener,noreferrer')
                      }
                      className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('profile.byok.installOllama')} <ExternalLink size={11} />
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
                  <label htmlFor="ollama-model" className="text-sm font-semibold text-foreground">
                    {t('profile.byok.model')}
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
                  <p className="text-xs text-muted-foreground">{t('profile.byok.modelHint')}</p>
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
                {isSavingLlm ? <GlitchLoader size={14} /> : t('common.save')}
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
        title={t('profile.byok.removeTitle', { provider: 'Gemini' })}
        message={t('profile.byok.removeMessage', { provider: 'Gemini' })}
        variant="danger"
      />
      <ConfirmationModal
        isOpen={confirmDeleteSeedream}
        onClose={() => setConfirmDeleteSeedream(false)}
        onConfirm={deleteSeedream}
        title={t('profile.byok.removeTitle', { provider: 'Seedream' })}
        message={t('profile.byok.removeMessage', { provider: 'Seedream' })}
        variant="danger"
      />
      <ConfirmationModal
        isOpen={confirmDeleteOpenai}
        onClose={() => setConfirmDeleteOpenai(false)}
        onConfirm={deleteOpenai}
        title={t('profile.byok.removeTitle', { provider: 'OpenAI' })}
        message={t('profile.byok.removeMessage', { provider: 'OpenAI' })}
        variant="danger"
      />

      <ApiKeyPolicyModal isOpen={showPolicyModal} onClose={() => setShowPolicyModal(false)} />
    </div>
  );
};
