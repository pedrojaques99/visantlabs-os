import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Key, Copy, Trash2, Plus, Shield, AlertTriangle, Check, X, Clock, Eye, EyeOff } from 'lucide-react';
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
} from "../components/ui/BreadcrumbWithBack";
import { BackButton } from "../components/ui/BackButton";
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { API_BASE } from '@/config/api';

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

const AVAILABLE_SCOPES = [
  { value: 'read', label: 'Read', description: 'Read access to resources' },
  { value: 'write', label: 'Write', description: 'Create and modify resources' },
  { value: 'generate', label: 'Generate', description: 'Use AI generation endpoints' },
];

function getAuthHeaders(): Record<string, string> {
  const token = authService.getToken();
  if (!token) return {};
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const ApiKeysPage: React.FC = () => {
  const { isAuthenticated, isCheckingAuth } = useLayout();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api-keys`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const data = await res.json();
      const rawKeys: ApiKeyRaw[] = data.keys || data || [];
      setKeys(rawKeys.map(toApiKey));
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
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
      toast.error('Please enter a name for the key');
      return;
    }
    if (newKeyScopes.length === 0) {
      toast.error('Select at least one scope');
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
        throw new Error(errData.error || 'Failed to create API key');
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
      setKeys(prev => [newKey, ...prev]);
      setShowCreateForm(false);
      setNewKeyName('');
      setNewKeyScopes(['read']);
      setNewKeyExpiry('');
      toast.success('API key created successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`${API_BASE}/api-keys/${revokeTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to revoke API key');
      setKeys(prev => prev.filter(k => k.id !== revokeTarget.id));
      setRevokeTarget(null);
      toast.success('API key revoked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke API key');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const scopeColor = (scope: string) => {
    switch (scope) {
      case 'read': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'write': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'generate': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  // Loading state
  if (isCheckingAuth || (isLoading && keys.length === 0)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <GlitchLoader size={32} />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono mb-4">Please sign in to manage API keys</p>
          <BackButton className="px-4 py-2 bg-neutral-800/50 text-neutral-400 rounded-md text-sm font-mono hover:bg-neutral-700/50 transition-colors mb-0" to="/" />
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="API Keys" description="Manage your API keys for agent and programmatic access" noindex={true} />
      <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">

        </div>
        <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10 space-y-6">

          {/* Header Card */}
          <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
            <CardContent className="p-4 md:p-6">
              <div className="mb-4">
                <BreadcrumbWithBack to="/profile">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/">Home</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link to="/profile">Profile</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>API Keys</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </BreadcrumbWithBack>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Key className="h-6 w-6 md:h-8 md:w-8 text-brand-cyan" />
                    <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-neutral-300">
                      API Keys
                    </h1>
                  </div>
                  <p className="text-neutral-500 font-mono text-sm md:text-base ml-9 md:ml-11">
                    Create and manage API keys for agent and programmatic access
                  </p>
                </div>
                <Button variant="ghost"
                  onClick={() => { setShowCreateForm(true); setCreatedKeyRaw(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-brand-cyan text-black rounded-md font-medium text-sm hover:bg-brand-cyan/90 transition-colors shrink-0"
                >
                  <Plus size={16} />
                  Create New Key
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono flex items-center gap-2">
              <X size={16} />
              {error}
            </div>
          )}

          {/* Newly Created Key Banner */}
          {createdKeyRaw && (
            <Card className="bg-amber-500/5 border border-amber-500/30 rounded-xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-semibold text-sm">Save your API key now</p>
                    <p className="text-amber-400/70 text-xs mt-1">This key will not be shown again. Copy it and store it securely.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-700/50 rounded-md p-3 font-mono text-sm">
                  <code className="flex-1 break-all text-neutral-200">
                    {showRawKey ? createdKeyRaw : createdKeyRaw.replace(/./g, '\u2022')}
                  </code>
                  <Button variant="ghost"
                    onClick={() => setShowRawKey(!showRawKey)}
                    className="p-1.5 hover:bg-neutral-700/50 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                    title={showRawKey ? 'Hide key' : 'Show key'}
                  >
                    {showRawKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button variant="ghost"
                    onClick={() => handleCopyKey(createdKeyRaw)}
                    className="p-1.5 hover:bg-neutral-700/50 rounded transition-colors text-neutral-400 hover:text-neutral-200"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </Button>
                </div>
                <Button variant="ghost"
                  onClick={() => setCreatedKeyRaw(null)}
                  className="mt-3 text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
                >
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Create Key Form */}
          {showCreateForm && (
            <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
              <CardContent className="p-4 md:p-6">
                <h2 className="text-lg font-semibold text-neutral-200 mb-4 flex items-center gap-2">
                  <Shield size={18} className="text-brand-cyan" />
                  Create New API Key
                </h2>
                <form onSubmit={handleCreateKey} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Name</label>
                    <Input
                      type="text"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="e.g. Production Agent, CI/CD Pipeline"
                      className="w-full px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-md text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-brand-cyan/50 transition-colors"
                      autoFocus
                    />
                  </div>

                  {/* Scopes */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Scopes</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_SCOPES.map(scope => (
                        <Button variant="ghost"
                          key={scope.value}
                          type="button"
                          onClick={() => toggleScope(scope.value)}
                          className={`px-3 py-2 rounded-md border text-sm transition-colors ${newKeyScopes.includes(scope.value)
                            ? 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan'
                            : 'bg-neutral-800/30 border-neutral-700/50 text-neutral-500 hover:border-neutral-600'
                            }`}
                        >
                          <span className="font-medium">{scope.label}</span>
                          <span className="text-xs ml-1.5 opacity-70">— {scope.description}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                      Expiry <span className="text-neutral-600">(optional)</span>
                    </label>
                    <Input
                      type="date"
                      value={newKeyExpiry}
                      onChange={e => setNewKeyExpiry(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full max-w-xs px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-md text-sm text-neutral-200 focus:outline-none focus:border-brand-cyan/50 transition-colors"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button variant="brand"
                      type="submit"
                      disabled={isCreating}
                      className="flex items-center gap-2 px-4 py-2.5 bg-brand-cyan text-black rounded-md font-medium text-sm hover:bg-brand-cyan/90 transition-colors disabled:opacity-50"
                    >
                      {isCreating ? <GlitchLoader size={14} /> : <Plus size={16} />}
                      {isCreating ? 'Creating...' : 'Create Key'}
                    </Button>
                    <Button variant="ghost"
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2.5 bg-neutral-800/50 text-neutral-400 rounded-md text-sm hover:bg-neutral-700/50 transition-colors"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Keys List */}
          <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <GlitchLoader size={24} />
                </div>
              ) : keys.length === 0 ? (
                <div className="p-12 text-center">
                  <Key className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
                  <p className="text-neutral-400 font-medium mb-1">No API keys yet</p>
                  <p className="text-neutral-600 text-sm font-mono">
                    Create your first key to start using the API programmatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800/50">
                        <th className="text-left p-4 text-neutral-500 font-medium font-mono text-xs uppercase ">Name</th>
                        <th className="text-left p-4 text-neutral-500 font-medium font-mono text-xs uppercase ">Key</th>
                        <th className="text-left p-4 text-neutral-500 font-medium font-mono text-xs uppercase ">Scopes</th>
                        <th className="text-left p-4 text-neutral-500 font-medium font-mono text-xs uppercase  hidden md:table-cell">Last Used</th>
                        <th className="text-left p-4 text-neutral-500 font-medium font-mono text-xs uppercase  hidden md:table-cell">Created</th>
                        <th className="text-left p-4 text-neutral-500 font-medium font-mono text-xs uppercase ">Status</th>
                        <th className="text-right p-4 text-neutral-500 font-medium font-mono text-xs uppercase "></th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map(key => (
                        <tr key={key.id} className="border-b border-neutral-800/30 hover:bg-neutral-800/20 transition-colors">
                          <td className="p-4 text-neutral-200 font-medium">{key.name}</td>
                          <td className="p-4">
                            <code className="text-neutral-500 font-mono text-xs bg-neutral-800/50 px-2 py-1 rounded">
                              {key.keyPrefix}••••••••
                            </code>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map(scope => (
                                <Badge key={scope} className={`text-xs border ${scopeColor(scope)}`}>
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-neutral-500 text-xs font-mono hidden md:table-cell">
                            {key.lastUsed ? (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(key.lastUsed)}
                              </span>
                            ) : (
                              <span className="text-neutral-600">Never</span>
                            )}
                          </td>
                          <td className="p-4 text-neutral-500 text-xs font-mono hidden md:table-cell">
                            {formatDate(key.createdAt)}
                          </td>
                          <td className="p-4">
                            {key.status === 'active' ? (
                              <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs">
                                Active
                              </Badge>
                            ) : key.status === 'expired' ? (
                              <Badge className="bg-neutral-500/20 text-neutral-400 border border-neutral-500/30 text-xs">
                                Expired
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
                                Revoked
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {key.status === 'active' && (
                              <Button variant="ghost"
                                onClick={() => setRevokeTarget(key)}
                                className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                title="Revoke key"
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

          {/* Revoke Confirmation Overlay */}
          {revokeTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <Card className="bg-neutral-900 border border-neutral-800/50 rounded-xl max-w-md w-full mx-4">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-500/10 rounded-md">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-200">Revoke API Key</h3>
                  </div>
                  <p className="text-neutral-400 text-sm mb-1">
                    Are you sure you want to revoke <span className="text-neutral-200 font-medium">"{revokeTarget.name}"</span>?
                  </p>
                  <p className="text-neutral-500 text-xs mb-6">
                    This action cannot be undone. Any applications using this key will lose access immediately.
                  </p>
                  <div className="flex items-center gap-3 justify-end">
                    <Button variant="ghost"
                      onClick={() => setRevokeTarget(null)}
                      className="px-4 py-2 bg-neutral-800/50 text-neutral-400 rounded-md text-sm hover:bg-neutral-700/50 transition-colors"
                      disabled={isRevoking}
                    >
                      Cancel
                    </Button>
                    <Button variant="destructive"
                      onClick={handleRevokeKey}
                      disabled={isRevoking}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-md text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {isRevoking ? <GlitchLoader size={14} /> : <Trash2 size={14} />}
                      {isRevoking ? 'Revoking...' : 'Revoke Key'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </>
  );
};
