import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Unplug, Trash2, Shield, Clock, Bot } from '@/lib/ui/icons';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PageShell } from '../components/ui/PageShell';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatDateShort } from '@/utils/localeUtils';

const OAUTH_BASE = '';

interface ConnectedApp {
  id: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const KNOWN_SCOPES = new Set(['read', 'write', 'generate']);

export const ConnectedAppsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ConnectedApp | null>(null);

  const fetchApps = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadFailed(false);
      const res = await fetch(`${OAUTH_BASE}/oauth/authorized-apps`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApps(data.apps || []);
    } catch (err) {
      console.error('[ConnectedApps] load failed:', err);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isCheckingAuth) fetchApps();
  }, [isAuthenticated, isCheckingAuth, fetchApps]);

  const handleRevoke = async () => {
    const target = revokeTarget;
    if (!target) return;
    try {
      const res = await fetch(`${OAUTH_BASE}/oauth/authorized-apps/${target.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t('connectedApps.revoked', { name: target.clientName }));
      setApps((prev) => prev.filter((a) => a.id !== target.id));
    } catch (err) {
      console.error('[ConnectedApps] revoke failed:', err);
      toast.error(t('connectedApps.revokeFailed'));
    }
  };

  const scopeLabel = (s: string) => (KNOWN_SCOPES.has(s) ? t(`connectedApps.scope.${s}`) : s);

  if (isCheckingAuth) return <GlitchLoader />;

  const title = t('nav.profile.connectedApps');

  return (
    <PageShell
      pageId="connected-apps"
      seoTitle={title}
      seoDescription={t('connectedApps.description')}
      title={title}
      description={t('connectedApps.description')}
      breadcrumb={[{ label: t('common.profile'), to: '/profile' }, { label: title }]}
      width="5xl"
    >
      {!isAuthenticated ? (
        <EmptyState
          icon={Shield}
          title={t('connectedApps.signInTitle')}
          description={t('connectedApps.signInBody')}
          actionLabel={t('auth.signIn')}
          onAction={() => navigate('/login')}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <GlitchLoader />
        </div>
      ) : loadFailed ? (
        <ErrorState title={t('connectedApps.loadFailed')} onRetry={fetchApps} />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={t('connectedApps.emptyTitle')}
          description={t('connectedApps.emptyBody')}
        />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {apps.map((app) => (
            <Card key={app.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Unplug className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{app.clientName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-1">
                        {app.scopes.map((s) => (
                          <Badge key={s} variant="secondary">
                            {scopeLabel(s)}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateShort(app.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={t('connectedApps.revoke')}
                  title={t('connectedApps.revoke')}
                  onClick={() => setRevokeTarget(app)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title={t('connectedApps.revokeTitle')}
        message={t('connectedApps.revokeMessage', { name: revokeTarget?.clientName ?? '' })}
        confirmText={t('connectedApps.revoke')}
        variant="danger"
      />
    </PageShell>
  );
};
