import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, Copy, Trash2, Plus, AlertTriangle, Check, Clock, Eye, EyeOff } from '@/lib/ui/icons';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useLayout } from '@/hooks/useLayout';
import { trackEvent } from '@/utils/analytics';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { PageShell } from '../components/ui/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_BASE } from '@/config/api';
import { useTranslation } from '@/hooks/useTranslation';
import { copyToClipboard } from '@/utils/clipboard';
import { formatDateShort } from '@/utils/localeUtils';
import { cn } from '@/lib/utils';

interface ApiKeyRaw {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsed: string | null;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
}

interface ApiKey extends ApiKeyRaw {
  status: 'active' | 'revoked' | 'expired';
}

function toApiKey(raw: ApiKeyRaw): ApiKey {
  let status: ApiKey['status'] = 'active';
  if (!raw.active) status = 'revoked';
  else if (raw.expiresAt && new Date(raw.expiresAt) < new Date()) status = 'expired';
  return { ...raw, status };
}

const AVAILABLE_SCOPES = ['read', 'write', 'generate'] as const;

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  if (!token) return {};
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Create key form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Newly created key display
  const [createdKeyRaw, setCreatedKeyRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRawKey, setShowRawKey] = useState(true);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadFailed(false);
      const res = await fetch(`${API_BASE}/api-keys`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawKeys: ApiKeyRaw[] = data.keys || data || [];
      setKeys(rawKeys.map(toApiKey));
    } catch (err) {
      console.error('[ApiKeys] load failed:', err);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isCheckingAuth) {
      fetchKeys();
    }
  }, [isAuthenticated, isCheckingAuth, fetchKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      toast.error(t('api.keys.please_enter_a_name_for_the_key'));
      return;
    }
    if (newKeyScopes.length === 0) {
      toast.error(t('api.keys.select_at_least_one_scope'));
      return;
    }

    setIsCreating(true);
    try {
      const body: any = { name: newKeyName.trim(), scopes: newKeyScopes };
      if (newKeyExpiry) body.expiresAt = newKeyExpiry;

      const res = await fetch(`${API_BASE}/api-keys/create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || t('api.keys.createFailed'));
      }

      const data = await res.json();
      setCreatedKeyRaw(data.key);
      const newKey = toApiKey({
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        lastUsed: null,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        active: true,
      });
      setKeys((prev) => [newKey, ...prev]);
      setShowCreateForm(false);
      setNewKeyName('');
      setNewKeyScopes(['read']);
      setNewKeyExpiry('');
      trackEvent('api_key_created', { scopes: newKeyScopes });
      toast.success(t('api.keys.createdToast'));
    } catch (err: any) {
      toast.error(err?.message || t('api.keys.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async () => {
    const target = revokeTarget;
    if (!target) return;
    try {
      const res = await fetch(`${API_BASE}/api-keys/${target.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKeys((prev) => prev.filter((k) => k.id !== target.id));
      toast.success(t('api.keys.revokedToast'));
    } catch (err) {
      console.error('[ApiKeys] revoke failed:', err);
      toast.error(t('api.keys.revokeFailed'));
    }
  };

  const handleCopyKey = async (text: string) => {
    try {
      await copyToClipboard(text);
      setCopied(true);
      toast.success(t('api.keys.copied_to_clipboard'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('api.keys.copyFailed'));
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const formatDate = (dateStr: string | null) => (dateStr ? formatDateShort(dateStr) : '');

  const scopeLabel = (s: string) =>
    (AVAILABLE_SCOPES as readonly string[]).includes(s) ? t(`connectedApps.scope.${s}`) : s;

  const openCreateForm = () => {
    setShowCreateForm(true);
    setCreatedKeyRaw(null);
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center py-24">
        <GlitchLoader size={32} />
      </div>
    );
  }

  const title = t('nav.profile.apiKeys');

  const statusBadge = (status: ApiKey['status']) =>
    status === 'active' ? (
      <Badge variant="success">{t('api.keys.statusActive')}</Badge>
    ) : status === 'expired' ? (
      <Badge variant="neutral">{t('api.keys.statusExpired')}</Badge>
    ) : (
      <Badge variant="destructive">{t('api.keys.statusRevoked')}</Badge>
    );

  return (
    <PageShell
      pageId="api-keys"
      seoTitle={title}
      seoDescription={t('api.keys.manage_your_api_keys_for_agent_and_progr')}
      title={title}
      description={t('api.keys.manage_your_api_keys_for_agent_and_progr')}
      breadcrumb={[{ label: t('common.profile'), to: '/profile' }, { label: title }]}
      actions={
        isAuthenticated ? (
          <Button variant="brand" onClick={openCreateForm} className="shrink-0">
            <Plus size={16} />
            {t('api.keys.createNew')}
          </Button>
        ) : undefined
      }
    >
      {!isAuthenticated ? (
        <EmptyState
          icon={Key}
          title={t('api.keys.please_sign_in_to_manage_api_keys')}
          actionLabel={t('auth.signIn')}
          onAction={() => navigate('/login')}
        />
      ) : (
        <div className="space-y-6">
          {/* Newly created key: shown once */}
          {createdKeyRaw && (
            <Card className="bg-warning/5 border border-warning/30 rounded-xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-warning font-medium text-sm">
                      {t('api.keys.save_your_api_key_now')}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {t('api.keys.this_key_will_not_be_shown_again_copy_it')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-muted border border-border rounded-md p-3 font-mono text-sm">
                  <code className="flex-1 break-all text-foreground">
                    {showRawKey ? createdKeyRaw : createdKeyRaw.replace(/./g, '•')}
                  </code>
                  <Button
                    variant="action"
                    onClick={() => setShowRawKey(!showRawKey)}
                    title={showRawKey ? t('api.keys.hideKey') : t('api.keys.showKey')}
                    aria-label={showRawKey ? t('api.keys.hideKey') : t('api.keys.showKey')}
                  >
                    {showRawKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button
                    variant="action"
                    onClick={() => handleCopyKey(createdKeyRaw)}
                    title={t('api.keys.copy_to_clipboard')}
                    aria-label={t('api.keys.copy_to_clipboard')}
                  >
                    {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreatedKeyRaw(null)}
                  className="mt-3 text-muted-foreground"
                >
                  {t('common.dismiss')}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Create key form */}
          {showCreateForm && (
            <Card className="bg-card border border-border rounded-xl">
              <CardContent className="p-4 md:p-6">
                <h2 className="text-lg font-medium text-foreground mb-4">
                  {t('api.keys.createTitle')}
                </h2>
                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <label
                      htmlFor="api-key-name"
                      className="block text-sm font-medium text-muted-foreground mb-1.5"
                    >
                      {t('api.keys.name')}
                    </label>
                    <Input
                      id="api-key-name"
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={t('api.keys.namePlaceholder')}
                      autoFocus
                    />
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-muted-foreground mb-1.5">
                      {t('api.keys.scopes')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_SCOPES.map((scope) => {
                        const selected = newKeyScopes.includes(scope);
                        return (
                          <Button
                            variant="ghost"
                            key={scope}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleScope(scope)}
                            className={cn(
                              'h-auto px-3 py-2 border text-sm',
                              selected
                                ? 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan'
                                : 'bg-muted/40 border-border text-muted-foreground'
                            )}
                          >
                            <span className="font-medium">{scopeLabel(scope)}</span>
                            <span className="text-xs text-muted-foreground">
                              {t(`api.keys.scopeDesc.${scope}`)}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="api-key-expiry"
                      className="block text-sm font-medium text-muted-foreground mb-1.5"
                    >
                      {t('api.keys.expiry')}
                    </label>
                    <Input
                      id="api-key-expiry"
                      type="date"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="max-w-xs"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="brand" type="submit" disabled={isCreating}>
                      {isCreating ? <GlitchLoader size={14} /> : <Plus size={16} />}
                      {isCreating ? t('api.keys.creating') : t('api.keys.create')}
                    </Button>
                    <Button variant="ghost" type="button" onClick={() => setShowCreateForm(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Keys list */}
          <Card className="bg-card border border-border rounded-xl">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <GlitchLoader size={24} />
                </div>
              ) : loadFailed && keys.length === 0 ? (
                // Fetch failed: never show the "create your first key" empty
                // state, keys may exist server-side.
                <ErrorState title={t('api.keys.load_failed')} onRetry={fetchKeys} />
              ) : keys.length === 0 ? (
                <EmptyState
                  icon={Key}
                  title={t('api.keys.no_api_keys_yet')}
                  description={t('api.keys.emptyBody')}
                  actionLabel={t('api.keys.createNew')}
                  onAction={openCreateForm}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted-foreground font-medium text-xs">
                          {t('api.keys.name')}
                        </th>
                        <th className="text-left p-4 text-muted-foreground font-medium text-xs">
                          {t('api.keys.key')}
                        </th>
                        <th className="text-left p-4 text-muted-foreground font-medium text-xs">
                          {t('api.keys.scopes_2')}
                        </th>
                        <th className="text-left p-4 text-muted-foreground font-medium text-xs hidden md:table-cell">
                          {t('api.keys.last_used')}
                        </th>
                        <th className="text-left p-4 text-muted-foreground font-medium text-xs hidden md:table-cell">
                          {t('api.keys.created')}
                        </th>
                        <th className="text-left p-4 text-muted-foreground font-medium text-xs">
                          {t('api.keys.status')}
                        </th>
                        <th className="p-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => (
                        <tr
                          key={key.id}
                          className="border-b border-border hover:bg-muted/40 transition-colors"
                        >
                          <td className="p-4 text-foreground font-medium">{key.name}</td>
                          <td className="p-4">
                            <code className="text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded">
                              {key.keyPrefix}••••••••
                            </code>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map((scope) => (
                                <Badge key={scope} variant="neutral">
                                  {scopeLabel(scope)}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground text-xs hidden md:table-cell">
                            {key.lastUsed ? (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(key.lastUsed)}
                              </span>
                            ) : (
                              t('api.keys.never')
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground text-xs hidden md:table-cell">
                            {formatDate(key.createdAt)}
                          </td>
                          <td className="p-4">{statusBadge(key.status)}</td>
                          <td className="p-4 text-right">
                            {key.status === 'active' && (
                              <Button
                                variant="danger"
                                size="icon-sm"
                                onClick={() => setRevokeTarget(key)}
                                title={t('api.keys.revoke_key')}
                                aria-label={t('api.keys.revoke_key')}
                              >
                                <Trash2 size={16} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevokeKey}
        title={t('api.keys.revoke_api_key')}
        message={t('api.keys.revokeMessage', { name: revokeTarget?.name ?? '' })}
        confirmText={t('api.keys.revoke_key')}
        variant="danger"
      />
    </PageShell>
  );
};
