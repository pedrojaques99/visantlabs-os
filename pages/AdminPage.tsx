import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, RefreshCw, Users, Settings, ChevronUp, ChevronDown, Search, TrendingUp, TrendingDown, User, Image, CreditCard, HardDrive, UserPlus, Link2, Database } from 'lucide-react';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
import { authService } from '../services/authService';
import { SEO } from '../components/SEO';

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  subscriptionStatus: string;
  subscriptionTier: string;
  monthlyCredits: number | null;
  creditsUsed: number | null;
  totalCreditsEarned: number | null;
  createdAt: string;
  updatedAt: string;
  creditsRemaining: number;
  manualCredits: number;
  mockupCount: number;
  transactionCount: number;
  referralCode?: string | null;
  referralCount?: number | null;
  referredBy?: string | null;
}

interface GenerationStats {
  imagesByModel: {
    [model: string]: {
      total: number;
      byResolution: { [resolution: string]: number };
    };
  };
  videos: {
    total: number;
    byModel: { [model: string]: number };
  };
  textTokens: {
    totalSteps: number;
    estimatedTokens: number;
    totalPromptLength: number;
    inputTokens: number;
    outputTokens: number;
  };
  byFeature: {
    mockupmachine: { images: number; videos: number; textSteps: number; promptGenerations: number };
    canvas: { images: number; videos: number; textSteps: number; promptGenerations: number };
    brandingmachine: { images: number; videos: number; textSteps: number; promptGenerations: number };
    'prompt-generation': { total: number; inputTokens: number; outputTokens: number };
  };
}

interface AdminResponse {
  totalUsers: number;
  totalMockupsGenerated: number;
  totalMockupsSaved: number;
  totalCreditsUsed: number;
  totalStorageUsed?: number;
  referralStats?: {
    totalReferralCount: number;
    totalReferredUsers: number;
    usersWithReferralCode: number;
  };
  users: AdminUser[];
  generationStats?: GenerationStats;
}

const ADMIN_API = '/api/admin/users';

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${value} ${sizes[i]}`;
}

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AdminResponse | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof AdminUser | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleFetch = async () => {
    const token = authService.getToken();
    if (!token) {
      setError('Você precisa estar autenticado para acessar esta página.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(ADMIN_API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(t('admin.accessDenied'));
        }
        throw new Error(t('admin.failedToLoadData'));
      }

      const result = (await response.json()) as AdminResponse;
      setData(result);
    } catch (fetchError: any) {
      console.error('Erro ao carregar dados do admin:', fetchError);
      setData(null);
      setError(fetchError.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    handleFetch();
  };

  // Check if user is admin and load data
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (isCheckingAuth) return;
      
      if (isUserAuthenticated === true) {
        try {
          const user = await authService.verifyToken();
          const userIsAdmin = user?.isAdmin || false;
          setIsAdmin(userIsAdmin);
          
          // Load data if user is admin
          if (userIsAdmin) {
            handleFetch();
          }
        } catch (error) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserAuthenticated, isCheckingAuth]);

  const isAuthenticated = isUserAuthenticated === true && isAdmin === true && data !== null;

  const totals = useMemo(() => {
    if (!data) {
      return {
        manualCredits: 0,
        monthlyCredits: 0,
        creditsUsed: 0,
      };
    }

    return data.users.reduce(
      (acc, user) => {
        acc.manualCredits += user.manualCredits || 0;
        acc.monthlyCredits += user.monthlyCredits || 0;
        acc.creditsUsed += user.creditsUsed || 0;
        return acc;
      },
      { manualCredits: 0, monthlyCredits: 0, creditsUsed: 0 }
    );
  }, [data]);

  const userLookup = useMemo(() => {
    if (!data) return {};
    return data.users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, AdminUser>);
  }, [data]);

  const filteredAndSortedUsers = useMemo(() => {
    if (!data) return [];
    
    let filtered = data.users;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        return 0;
      });
    }
    
    return filtered;
  }, [data, searchQuery, sortField, sortDirection]);

  const handleSort = (field: keyof AdminUser) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <>
      <SEO
        title={t('admin.title')}
        description={t('admin.description')}
        noindex={true}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-6xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
        {/* Header Compacto */}
        <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="mb-4">
              <BreadcrumbWithBack to="/">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/">{t('apps.home')}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{t('admin.title') || 'Admin'}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </BreadcrumbWithBack>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="h-6 w-6 md:h-8 md:w-8 text-[#52ddeb]" />
                  <h1 className="text-2xl md:text-3xl font-semibold font-manrope text-zinc-300">
                    Painel Administrativo
                  </h1>
                </div>
                <p className="text-zinc-500 font-mono text-sm md:text-base ml-9 md:ml-11">
                  Visualize usuários, assinaturas e créditos em tempo real
                </p>
              </div>
              
              {isAuthenticated && data && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={location.pathname === '/admin' ? 'default' : 'outline'}
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Usuários
                  </Button>
                  <Button
                    variant={location.pathname === '/admin/presets' ? 'default' : 'outline'}
                    onClick={() => navigate('/admin/presets')}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Presets
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isCheckingAuth && (
          <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl max-w-md mx-auto">
            <CardContent className="p-6 md:p-8 text-center">
              <GlitchLoader size={32} />
            </CardContent>
          </Card>
        )}

        {!isCheckingAuth && !isAuthenticated && (
          <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl max-w-md mx-auto">
            <CardContent className="p-6 md:p-8 space-y-4 text-center">
              {isUserAuthenticated === false ? (
                <>
                  <p className="text-zinc-400 font-mono mb-4">
                    Você precisa estar logado para acessar esta página.
                  </p>
                  <Button
                    onClick={() => navigate('/')}
                    className="bg-[#52ddeb]/80 hover:bg-[#52ddeb] text-black"
                  >
                    Fazer Login
                  </Button>
                </>
              ) : isAdmin === false ? (
                <>
                  <p className="text-zinc-400 font-mono mb-4">
                    Acesso negado. Você precisa ser um administrador para acessar esta página.
                  </p>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono">
                      {error}
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        )}

        {isAuthenticated && data && (
          <Tabs defaultValue="overview" className="space-y-6">
            <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <TabsList className="bg-transparent border-0">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-[#52ddeb]/80 data-[state=active]:text-black">
                      Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="users" className="data-[state=active]:bg-[#52ddeb]/80 data-[state=active]:text-black">
                      Usuários
                    </TabsTrigger>
                    {data.generationStats && (
                      <TabsTrigger value="stats" className="data-[state=active]:bg-[#52ddeb]/80 data-[state=active]:text-black">
                        Estatísticas
                      </TabsTrigger>
                    )}
                  </TabsList>
                  <Button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <TabsContent value="overview" className="space-y-6">
              {/* Main KPI Cards - Bento Box Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Total Users - Large Card */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl md:col-span-2 lg:col-span-1">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <User className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                        <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                        <span>+12.5%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-4xl font-bold text-zinc-300 mb-2 font-mono">
                        {data.totalUsers}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Total Usuários</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Crescimento este mês</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Mockups Generated */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <Image className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                        <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                        <span>+8.2%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {data.totalMockupsGenerated}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Mockups Gerados</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Total de gerações</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Mockups Saved */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <Database className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                        <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                        <span>+5.1%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {data.totalMockupsSaved}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Mockups Salvos</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Armazenados no sistema</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Credits Used */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl md:col-span-2">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                        <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                        <span>+15.3%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-4xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {data.totalCreditsUsed.toLocaleString()}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Créditos Usados</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Consumo total da plataforma</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Storage Used */}
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <HardDrive className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                        <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                        <span>+2.8%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {data.totalStorageUsed !== undefined ? formatBytes(data.totalStorageUsed) : '—'}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Armazenamento Total</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Espaço utilizado</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Referral Stats - Bento Box Cards */}
              {data.referralStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Link2 className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                          <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                          <span>+10.2%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                          {data.referralStats.totalReferralCount}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Indicações Registradas</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">Total de referências</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <UserPlus className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                          <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                          <span>+7.5%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                          {data.referralStats.totalReferredUsers}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Usuários Indicados</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">Novos usuários via referência</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Link2 className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                          <TrendingUp className="h-3 w-3 text-[#52ddeb]" />
                          <span>+3.1%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                          {data.referralStats.usersWithReferralCode}
                        </p>
                        <p className="text-sm text-zinc-500 font-mono">Links Ativos</p>
                        <p className="text-xs text-zinc-400 font-mono mt-1">Códigos de referência ativos</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {data.generationStats && (
              <TabsContent value="stats" className="space-y-6">
                {/* Images by Model - Individual Cards */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-300 font-mono">Imagens por Modelo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {Object.entries(data.generationStats.imagesByModel).map(([model, stats]) => (
                      <Card key={model} className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                              <Image className="h-6 w-6 text-[#52ddeb]" />
                            </div>
                          </div>
                          <div className="mb-4">
                            <p className="text-sm font-semibold text-[#52ddeb] font-mono mb-2">{model}</p>
                            <p className="text-3xl font-bold text-zinc-300 font-mono">{stats.total}</p>
                            <p className="text-xs text-zinc-500 font-mono mt-1">imagens geradas</p>
                          </div>
                          {Object.keys(stats.byResolution).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                              <p className="text-xs text-zinc-500 font-mono mb-2 uppercase">Por Resolução:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(stats.byResolution).map(([resolution, count]) => (
                                  <Badge key={resolution} variant="outline" className="text-xs bg-black/40 border-zinc-700/50">
                                    {resolution}: {count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Videos - Individual Card */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-300 font-mono">Vídeos</h3>
                  <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                          <Image className="h-6 w-6 text-[#52ddeb]" />
                        </div>
                      </div>
                      <div className="mb-4">
                        <p className="text-3xl font-bold text-zinc-300 font-mono mb-2">{data.generationStats.videos.total}</p>
                        <p className="text-sm text-zinc-500 font-mono">Total de Vídeos</p>
                      </div>
                      {Object.keys(data.generationStats.videos.byModel).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-zinc-800/50">
                          <p className="text-xs text-zinc-500 font-mono mb-2 uppercase">Por Modelo:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(data.generationStats.videos.byModel).map(([model, count]) => (
                              <Badge key={model} variant="outline" className="text-xs bg-black/40 border-zinc-700/50">
                                {model}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Text Tokens - Individual Cards */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-300 font-mono">Tokens de Texto (Branding)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-zinc-300 font-mono mb-2">{data.generationStats.textTokens.totalSteps}</p>
                          <p className="text-xs text-zinc-500 font-mono">Total Passos</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-[#52ddeb] font-mono mb-2">{data.generationStats.textTokens.inputTokens.toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Input Tokens</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-[#52ddeb] font-mono mb-2">{data.generationStats.textTokens.outputTokens.toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Output Tokens</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-zinc-300 font-mono mb-2">{(data.generationStats.textTokens.inputTokens + data.generationStats.textTokens.outputTokens).toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Total Tokens</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-zinc-300 font-mono mb-2">{data.generationStats.textTokens.totalPromptLength.toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Chars Prompt</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Prompt Generations - Individual Cards */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-300 font-mono">Geração de Prompts Automáticos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-zinc-300 font-mono mb-2">{data.generationStats.byFeature['prompt-generation'].total}</p>
                          <p className="text-xs text-zinc-500 font-mono">Total</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-[#52ddeb] font-mono mb-2">{data.generationStats.byFeature['prompt-generation'].inputTokens.toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Input Tokens</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-[#52ddeb] font-mono mb-2">{data.generationStats.byFeature['prompt-generation'].outputTokens.toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Output Tokens</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                      <CardContent className="p-6">
                        <div className="mb-4">
                          <p className="text-2xl font-bold text-zinc-300 font-mono mb-2">{(data.generationStats.byFeature['prompt-generation'].inputTokens + data.generationStats.byFeature['prompt-generation'].outputTokens).toLocaleString()}</p>
                          <p className="text-xs text-zinc-500 font-mono">Total Tokens</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* By Feature - Individual Cards */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-300 font-mono">Por Feature</h3>
                  <div className="grid grid-cols-3 gap-4 md:gap-6">
                    {(['mockupmachine', 'canvas', 'brandingmachine'] as const).map((feature) => {
                      const stats = data.generationStats.byFeature[feature];
                      return (
                        <Card key={feature} className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                                <Image className="h-6 w-6 text-[#52ddeb]" />
                              </div>
                            </div>
                            <div className="mb-4">
                              <p className="text-sm font-semibold text-[#52ddeb] font-mono mb-3 uppercase">{feature}</p>
                              <div className="space-y-2 text-xs font-mono">
                                <p className="text-zinc-300">Imagens: <span className="text-[#52ddeb] font-bold">{stats.images}</span></p>
                                <p className="text-zinc-300">Vídeos: <span className="text-[#52ddeb] font-bold">{stats.videos}</span></p>
                                <p className="text-zinc-300">Passos Texto: <span className="text-[#52ddeb] font-bold">{stats.textSteps}</span></p>
                                <p className="text-zinc-300">Prompts Gerados: <span className="text-[#52ddeb] font-bold">{stats.promptGenerations}</span></p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="users" className="space-y-6">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <Users className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                        {data.users.length}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Total Usuários</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Cadastrados no sistema</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {data.users.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing').length}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Assinaturas Ativas</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Usuários com plano ativo</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <CreditCard className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {totals.monthlyCredits + totals.manualCredits}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Créditos Distribuídos</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Total de créditos atribuídos</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-[#52ddeb]/10 rounded-lg">
                        <Image className="h-6 w-6 text-[#52ddeb]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-[#52ddeb] mb-2 font-mono">
                        {data.users.reduce((sum, u) => sum + (u.mockupCount || 0), 0)}
                      </p>
                      <p className="text-sm text-zinc-500 font-mono">Mockups Criados</p>
                      <p className="text-xs text-zinc-400 font-mono mt-1">Total de mockups gerados</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Search Card */}
              <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 transition-all duration-300 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3 text-zinc-300 font-mono mb-2">
                        <Search className="h-5 w-5 text-[#52ddeb]" />
                        Buscar Usuários
                      </CardTitle>
                      <CardDescription className="text-zinc-500 font-mono">
                        {searchQuery
                          ? `${filteredAndSortedUsers.length} de ${data.users.length} usuários encontrados`
                          : `${data.users.length} usuários cadastrados`}
                      </CardDescription>
                    </div>
                    <div className="relative w-full md:w-auto md:min-w-[300px]">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <Input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-black/40 border-zinc-800/50 text-zinc-300 placeholder:text-zinc-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Table Card */}
              <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-[#52ddeb]/30 transition-all duration-300 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-zinc-300 font-mono">
                    <Users className="h-5 w-5 text-[#52ddeb]" />
                    Lista de Usuários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800/50 hover:bg-transparent">
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('name')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Usuário
                            {sortField === 'name' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('subscriptionTier')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Assinatura
                            {sortField === 'subscriptionTier' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('creditsRemaining')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Créditos
                            {sortField === 'creditsRemaining' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('referralCount')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Indicações
                            {sortField === 'referralCount' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('mockupCount')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Mockups
                            {sortField === 'mockupCount' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('transactionCount')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Transações
                            {sortField === 'transactionCount' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-zinc-500 font-mono">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSort('createdAt')}
                            className="flex items-center gap-2 h-auto p-0 font-mono text-zinc-500 hover:text-zinc-300"
                          >
                            Criado em
                            {sortField === 'createdAt' && (
                              sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-zinc-500 font-mono py-8">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedUsers.map((user) => (
                          <TableRow key={user.id} className="border-zinc-800/30 text-zinc-300 hover:bg-black/20 transition-colors">
                            <TableCell className="px-4 py-4">
                              <p className="font-medium text-zinc-200">{user.name || t('admin.noName')}</p>
                              <p className="text-xs text-zinc-500 font-mono">{user.email}</p>
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              <Badge variant="outline" className="bg-[#52ddeb]/10 text-[#52ddeb] border-[#52ddeb]/30 font-mono mb-1">
                                {user.subscriptionTier}
                              </Badge>
                              <p className="text-xs text-zinc-500 font-mono mt-1">{user.subscriptionStatus}</p>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-xs font-mono space-y-1">
                              <p>{t('admin.monthly')}: {user.monthlyCredits ?? 0}</p>
                              <p>{t('admin.used')}: {user.creditsUsed ?? 0}</p>
                              <p className="text-[#52ddeb]">{t('admin.remaining')}: {user.creditsRemaining}</p>
                              <p>{t('admin.manual')}: {user.manualCredits}</p>
                            </TableCell>
                            <TableCell className="px-4 py-4 text-xs font-mono space-y-1">
                              <p>{t('admin.made')}: {user.referralCount ?? 0}</p>
                              <p>{t('admin.code')}: {user.referralCode || '—'}</p>
                              <p className="text-[11px] text-zinc-500">
                                {user.referredBy
                                  ? `${t('admin.referredBy')}: ${userLookup[user.referredBy]?.name || userLookup[user.referredBy]?.email || t('admin.unknown')}`
                                  : t('admin.directOrigin')}
                              </p>
                            </TableCell>
                            <TableCell className="px-4 py-4 font-mono">{user.mockupCount}</TableCell>
                            <TableCell className="px-4 py-4 font-mono">{user.transactionCount}</TableCell>
                            <TableCell className="px-4 py-4 text-xs font-mono text-zinc-400">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
      </div>
    </>
  );
};

export default AdminPage;

