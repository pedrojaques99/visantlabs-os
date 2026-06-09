import React, { useState, useEffect, useCallback } from 'react';
import { Unplug, Trash2, Shield, Clock, Bot } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { SEO } from '../components/SEO';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '@/components/ui/button';
const OAUTH_BASE = '';
import { formatDateShort } from '@/utils/localeUtils';

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

const SCOPE_LABELS: Record<string, string> = {
  read: 'Read',
  write: 'Write',
  generate: 'Generate',
};

export const ConnectedAppsPage: React.FC = () => {
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ConnectedApp | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchApps = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${OAUTH_BASE}/oauth/authorized-apps`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch connected apps');
      const data = await res.json();
      setApps(data.apps || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load connected apps');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isCheckingAuth) fetchApps();
  }, [isAuthenticated, isCheckingAuth, fetchApps]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`${OAUTH_BASE}/oauth/authorized-apps/${revokeTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to revoke access');
      toast.success(`Revoked access for ${revokeTarget.clientName}`);
      setApps((prev) => prev.filter((a) => a.id !== revokeTarget.id));
      setRevokeTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke');
    } finally {
      setIsRevoking(false);
    }
  };

  if (isCheckingAuth) return <GlitchLoader />;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Sign in to manage your connected applications.
            </p>
            <a href="/login">
              <Button>Sign In</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Connected Apps — Visant Labs"
        description="Manage AI agents and applications connected to your Visant Labs account via OAuth."
      />
      <GridDotsBackground />

      <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
        <BackButton />

        <BreadcrumbWithBack className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/developer">Developer</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Connected Apps</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </BreadcrumbWithBack>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Connected Apps</h1>
          <p className="text-sm text-muted-foreground">
            AI agents and applications authorized to access your account via OAuth.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <GlitchLoader />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center text-destructive">{error}</CardContent>
          </Card>
        ) : apps.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="text-sm font-medium mb-1">No connected apps</h3>
              <p className="text-xs text-muted-foreground">
                When an AI agent connects to your account via OAuth, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <Card key={app.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Unplug className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{app.clientName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex gap-1">
                          {app.scopes.map((s) => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {SCOPE_LABELS[s] || s}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateShort(app.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setRevokeTarget(app)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {revokeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="max-w-sm w-full mx-4">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold mb-2">Revoke access?</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  <strong>{revokeTarget.clientName}</strong> will no longer be able to access your
                  account. You can re-authorize it later.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRevokeTarget(null)}
                    disabled={isRevoking}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                  >
                    {isRevoking ? 'Revoking…' : 'Revoke'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
};
