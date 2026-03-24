import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ShieldCheck, Plus, Edit2, Trash2, X, Save,
    CreditCard, Package, Link2, DollarSign,
    RefreshCw, Settings, CheckCircle2,
    AlertCircle, ChevronRight, Layout
} from 'lucide-react';
import { SearchBar } from '../components/ui/SearchBar';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Select } from '../components/ui/select';
import {
    BreadcrumbWithBack,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../components/ui/BreadcrumbWithBack";
import { useLayout } from '@/hooks/useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { SEO } from '../components/SEO';
import { MicroTitle } from '../components/ui/MicroTitle';

const ADMIN_API = '/api/admin/products';

interface Product {
    id: string;
    productId: string;
    type: 'credit_package' | 'subscription_plan';
    name: string;
    description: string | null;
    credits: number;
    priceBRL: number;
    priceUSD: number | null;
    stripeProductId: string | null;
    abacateProductId: string | null;
    abacateBillId: string | null;
    paymentLinkBRL: string | null;
    paymentLinkUSD: string | null;
    metadata: any | null;
    isActive: boolean;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

interface ProductFormData {
    productId: string;
    type: 'credit_package' | 'subscription_plan' | 'storage_plan';
    name: string;
    description: string;
    credits: number;
    priceBRL: number;
    priceUSD: string;
    stripeProductId: string;
    abacateProductId: string;
    abacateBillId: string;
    paymentLinkBRL: string;
    paymentLinkUSD: string;
    metadata: any;
    isActive: boolean;
    displayOrder: number;
}

export const AdminProductsPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [activeTab, setActiveTab] = useState<'credit_package' | 'subscription_plan' | 'storage_plan'>('credit_package');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState<ProductFormData>({
        productId: '',
        type: 'credit_package',
        name: '',
        description: '',
        credits: 0,
        priceBRL: 0,
        priceUSD: '',
        stripeProductId: '',
        abacateProductId: '',
        abacateBillId: '',
        paymentLinkBRL: '',
        paymentLinkUSD: '',
        isActive: true,
        displayOrder: 0,
        metadata: { features: [] },
    });

    // Check admin status and load data
    useEffect(() => {
        const checkAdminStatus = async () => {
            if (isCheckingAuth) return;
            if (isUserAuthenticated) {
                try {
                    const user = await authService.verifyToken();
                    const userIsAdmin = user?.isAdmin || false;
                    setIsAdmin(userIsAdmin);
                    if (userIsAdmin) handleFetch();
                } catch (err) {
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }
        };
        checkAdminStatus();
    }, [isUserAuthenticated, isCheckingAuth]);

    const handleFetch = async () => {
        const token = authService.getToken();
        if (!token) return;
        setIsLoading(true);
        try {
            const resp = await fetch(ADMIN_API, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error('Falha ao carregar produtos');
            const data = await resp.json();
            setProducts(data);
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSeedDefaults = async () => {
        if (!confirm('Deseja popular a base com os pacotes de créditos e planos padrão?')) return;
        const token = authService.getToken();
        if (!token) return;

        setIsLoading(true);
        try {
            const defaultProducts = [
                // Credit Packages
                { productId: 'credits_20', type: 'credit_package', name: '20 Créditos', credits: 20, priceBRL: 9.90, displayOrder: 0, paymentLinkBRL: 'https://buy.stripe.com/aFa6oA4A76hK2VUfVE0gw02', stripeProductId: 'prod_TSoYT6iN6okzqj' },
                { productId: 'credits_50', type: 'credit_package', name: '50 Créditos', credits: 50, priceBRL: 25.90, displayOrder: 1, paymentLinkBRL: 'https://buy.stripe.com/9B6eV65EbdKc3ZYaBk0gw08', stripeProductId: 'prod_TXViJlOBGY0yTa' },
                { productId: 'credits_100', type: 'credit_package', name: '100 Créditos', credits: 100, priceBRL: 45.90, displayOrder: 2, paymentLinkBRL: 'https://buy.stripe.com/28E00c4A7eOg0NM38S0gw09', stripeProductId: 'prod_TSoesFFm3kKj1E' },
                { productId: 'credits_500', type: 'credit_package', name: '500 Créditos', credits: 500, priceBRL: 198.00, displayOrder: 3, paymentLinkBRL: 'https://buy.stripe.com/3cI8wI9Ur0Xq9ki5h00gw07', stripeProductId: 'prod_TSoiFWVxxng27m' },
                // Plans (créditos dobrados para validação agressiva - usuários não usam 100%)
                { productId: 'plan_pro', type: 'subscription_plan', name: 'Plano Pro', credits: 300, priceBRL: 49.90, displayOrder: 4, description: '300 créditos/mês, Modo Experimental, Suporte Prioritário, 20GB Storage', metadata: { tier: 'pro', storageLimitGB: 20 } },
                { productId: 'plan_pro_annual', type: 'subscription_plan', name: 'Plano Pro Anual', credits: 3600, priceBRL: 499.00, displayOrder: 5, description: '3.600 créditos/ano, Modo Experimental, Suporte Prioritário, 20GB Storage', metadata: { tier: 'pro', storageLimitGB: 20, interval: 'year' } },
                { productId: 'plan_vision', type: 'subscription_plan', name: 'Plano Vision', credits: 800, priceBRL: 89.90, displayOrder: 6, description: '800 créditos/mês, Modo Experimental, Suporte Rápido, 100GB Storage', metadata: { tier: 'vision', storageLimitGB: 100 } },
                { productId: 'plan_vision_annual', type: 'subscription_plan', name: 'Plano Vision Anual', credits: 9600, priceBRL: 899.00, displayOrder: 7, description: '9.600 créditos/ano, Modo Experimental, Suporte Rápido, 100GB Storage', metadata: { tier: 'vision', storageLimitGB: 100, interval: 'year' } },
                // Storage Plans (standalone, for BYOK users or additional storage)
                { productId: 'storage_pro', type: 'storage_plan', name: 'Pro Storage', credits: 0, priceBRL: 9.90, displayOrder: 8, description: '5 GB de armazenamento para imagens e vídeos', metadata: { storageLimitGB: 5, billingCycle: 'monthly' } },
                { productId: 'storage_vision', type: 'storage_plan', name: 'Vision Storage', credits: 0, priceBRL: 29.90, displayOrder: 9, description: '50 GB de armazenamento, ideal para criadores de vídeo', metadata: { storageLimitGB: 50, billingCycle: 'monthly' } },
            ];

            for (const product of defaultProducts) {
                await fetch(ADMIN_API, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(product)
                });
            }

            toast.success('Produtos semeados com sucesso!');
            handleFetch();
        } catch (err: any) {
            toast.error('Erro ao semear: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setIsCreating(false);
        setFormData({
            productId: product.productId,
            type: product.type,
            name: product.name,
            description: product.description || '',
            credits: product.credits,
            priceBRL: product.priceBRL,
            priceUSD: product.priceUSD?.toString() || '',
            stripeProductId: product.stripeProductId || '',
            abacateProductId: product.abacateProductId || '',
            abacateBillId: product.abacateBillId || '',
            paymentLinkBRL: product.paymentLinkBRL || '',
            paymentLinkUSD: product.paymentLinkUSD || '',
            isActive: product.isActive,
            displayOrder: product.displayOrder,
            metadata: product.metadata || { features: [] },
        });
        setIsEditModalOpen(true);
    };

    const handleCreate = () => {
        setEditingId(null);
        setIsCreating(true);
        setFormData({
            productId: '',
            type: activeTab,
            name: '',
            description: '',
            credits: 0,
            priceBRL: 0,
            priceUSD: '',
            stripeProductId: '',
            abacateProductId: '',
            abacateBillId: '',
            paymentLinkBRL: '',
            paymentLinkUSD: '',
            isActive: true,
            displayOrder: products.length > 0 ? Math.max(...products.map(p => p.displayOrder)) + 1 : 0,
            metadata: { features: [] },
        });
        setIsEditModalOpen(true);
    };

    const handleSave = async () => {
        const token = authService.getToken();
        if (!token) return;

        if (!formData.productId || !formData.name) {
            toast.error('Preencha os campos obrigatórios (ID do Produto e Nome)');
            return;
        }

        setIsLoading(true);
        try {
            const url = isCreating ? ADMIN_API : `${ADMIN_API}/${editingId}`;
            const method = isCreating ? 'POST' : 'PUT';

            const payload = {
                ...formData,
                priceUSD: formData.priceUSD ? parseFloat(formData.priceUSD) : null,
            };

            const resp = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.error || 'Erro ao salvar produto');
            }

            toast.success(isCreating ? 'Produto criado!' : 'Produto atualizado!');
            handleFetch();
            setIsEditModalOpen(false);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja deletar este produto?')) return;
        const token = authService.getToken();
        if (!token) return;

        try {
            const resp = await fetch(`${ADMIN_API}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error('Erro ao deletar produto');
            toast.success('Produto removido');
            handleFetch();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const filteredProducts = products.filter(p =>
        p.type === activeTab &&
        (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.productId.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (!isCheckingAuth && isAdmin === false) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-white font-mono">
                Acesso negado. Administradores apenas.
            </div>
        );
    }

    return (
        <>
            <SEO title="Admin | Produtos" noindex={true} />
            <div className="min-h-screen bg-neutral-950 text-neutral-300 pt-14 relative pb-20">
                <div className="fixed inset-0 z-0">
                </div>

                <div className="max-w-7xl mx-auto px-4 pt-8 relative z-10">
                    <div className="mb-6">
                        <BreadcrumbWithBack to="/admin">
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink asChild><Link to="/admin">Admin</Link></BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Produtos</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </BreadcrumbWithBack>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-neutral-100 flex items-center gap-3">
                                <Package className="text-brand-cyan h-8 w-8" />
                                Gestão de Produtos
                            </h1>
                            <p className="text-neutral-500 mt-1">Gerencie pacotes de créditos e planos de assinatura.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleSeedDefaults}
                                variant="outline"
                                size="sm"
                                className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-neutral-400"
                            >
                                Semear Padrões
                            </Button>
                            <Button
                                onClick={handleFetch}
                                variant="outline"
                                size="sm"
                                className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800"
                            >
                                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                                Sincronizar
                            </Button>
                            <Button variant="brand" onClick={handleCreate}
                                className="bg-brand-cyan hover:bg-brand-cyan/90 text-neutral-950 font-bold"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Novo Produto
                            </Button>
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <TabsList className="bg-neutral-900 border border-neutral-800 p-1">
                                <TabsTrigger value="credit_package" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-brand-cyan">
                                    Pacotes de Créditos
                                </TabsTrigger>
                                <TabsTrigger value="subscription_plan" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-brand-cyan">
                                    Assinaturas
                                </TabsTrigger>
                                <TabsTrigger value="storage_plan" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-brand-cyan">
                                    Storage
                                </TabsTrigger>
                            </TabsList>

                            <div className="w-full md:w-64">
                                <SearchBar
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder="Buscar produto..."
                                    iconSize={16}
                                    className="bg-neutral-900 border-neutral-800 focus:border-brand-cyan/50"
                                    containerClassName="w-full"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {filteredProducts.map((product) => (
                                <Card key={product.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-all group">
                                    <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                                        <div>
                                            <CardTitle className="text-xl text-neutral-100">{product.name}</CardTitle>
                                            <CardDescription className="font-mono text-xs text-neutral-500">ID: {product.productId}</CardDescription>
                                        </div>
                                        <Badge variant={product.isActive ? "default" : "secondary"}
                                            className={cn(product.isActive ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-neutral-800 text-neutral-500 border-neutral-700")}>
                                            {product.isActive ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center justify-between text-sm py-2 border-b border-neutral-800/50">
                                            <span className="text-neutral-500">Preço BRL</span>
                                            <span className="text-neutral-200 font-bold">R$ {product.priceBRL.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-2 border-b border-neutral-800/50">
                                            <span className="text-neutral-500">Créditos</span>
                                            <span className="text-brand-cyan font-mono">{product.credits}</span>
                                        </div>

                                        {/* Unlimited indicator for subscription plans */}
                                        {product.type === 'subscription_plan' && product.metadata?.unlimitedResolutions?.length > 0 && (
                                            <div className="flex items-center gap-2 py-2 px-3 bg-brand-cyan/5 border border-brand-cyan/20 rounded-md">
                                                <span className="text-brand-cyan text-lg">∞</span>
                                                <div className="flex-1">
                                                    <span className="text-[10px] text-brand-cyan font-bold uppercase">Unlimited</span>
                                                    <p className="text-[10px] text-neutral-400">
                                                        {product.metadata.unlimitedModels?.length > 0 && 'NB2 '}
                                                        até {product.metadata.unlimitedResolutions[product.metadata.unlimitedResolutions.length - 1]}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            <div className="flex flex-col gap-1">
                                                <MicroTitle className="font-bold">Stripe</MicroTitle>
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    <CheckCircle2 className={cn("h-3 w-3", product.stripeProductId ? "text-green-500" : "text-neutral-700")} />
                                                    <span className="text-[10px] truncate max-w-full font-mono">{product.stripeProductId || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <MicroTitle className="font-bold">Payments</MicroTitle>
                                                <div className="flex items-center gap-1.5">
                                                    <Link2 className={cn("h-3 w-3", product.paymentLinkBRL ? "text-brand-cyan" : "text-neutral-700")} />
                                                    <span className="text-[10px]">{product.paymentLinkBRL ? 'Configurado' : 'Aguardando'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-4">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="flex-1 bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 hover:text-brand-cyan h-9"
                                                onClick={() => handleEdit(product)}
                                            >
                                                <Edit2 className="h-4 w-4 mr-2" />
                                                Editar
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="bg-neutral-950 border border-neutral-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 h-9"
                                                onClick={() => handleDelete(product.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {filteredProducts.length === 0 && !isLoading && (
                                <div className="col-span-full py-12 text-center bg-neutral-900/50 border border-dashed border-neutral-800 rounded-xl">
                                    <Package className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
                                    <p className="text-neutral-500">Nenhum produto encontrado nesta categoria.</p>
                                </div>
                            )}
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* Edit Modal / Slide-over */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-neutral-950 border border-neutral-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-md shadow-2xl slide-in-from-bottom duration-300">
                        <div className="p-6 border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-neutral-100">
                                    {isCreating ? 'Novo Produto' : 'Editar Produto'}
                                </h2>
                                <p className="text-neutral-500 text-sm">Preencha os detalhes do produto e links de pagamento.</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)} className="rounded-full">
                                <X className="h-6 w-6" />
                            </Button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">ID do Produto (único)</label>
                                    <Input
                                        placeholder="ex: credits_20, plan_pro"
                                        value={formData.productId}
                                        onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                                        className="bg-neutral-900 border-neutral-800 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">Tipo</label>
                                    <Select
                                        value={formData.type}
                                        onChange={(val: any) => setFormData({ ...formData, type: val })}
                                        options={[
                                            { value: 'credit_package', label: 'Pacote de Créditos' },
                                            { value: 'subscription_plan', label: 'Plano de Assinatura' },
                                            { value: 'storage_plan', label: 'Plano de Storage' }
                                        ]}
                                        className="bg-neutral-900 border-neutral-800"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">Nome Comercial</label>
                                    <Input
                                        placeholder="ex: Pacote Gamer"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="bg-neutral-900 border-neutral-800"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">Descrição</label>
                                    <Textarea
                                        placeholder="Descrição breve do que este produto oferece..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="bg-neutral-900 border-neutral-800 min-h-[80px]"
                                    />
                                </div>
                                {formData.type === 'subscription_plan' && (
                                    <>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-neutral-500 uppercase ">Benefícios (um por linha para lista em marcadores)</label>
                                            <Textarea
                                                placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3..."
                                                value={formData.metadata?.features ? (Array.isArray(formData.metadata.features) ? formData.metadata.features.join('\n') : '') : ''}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    metadata: {
                                                        ...formData.metadata,
                                                        features: e.target.value.split('\n').filter(Boolean)
                                                    }
                                                })}
                                                className="bg-neutral-900 border-neutral-800 min-h-[120px] font-manrope"
                                            />
                                        </div>

                                        {/* Unlimited Settings */}
                                        <div className="md:col-span-2 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg space-y-4">
                                            <h4 className="text-sm font-bold text-brand-cyan flex items-center gap-2">
                                                <span className="text-lg">∞</span> Configuração de Unlimited
                                            </h4>
                                            <p className="text-xs text-neutral-500">
                                                Defina quais modelos/resoluções são ilimitados (não consomem créditos) para este plano.
                                            </p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Tier ID</label>
                                                    <Input
                                                        placeholder="ex: starter, creator, agency, studio"
                                                        value={formData.metadata?.tier || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, tier: e.target.value }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Storage (GB)</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="20"
                                                        value={formData.metadata?.storageLimitGB || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, storageLimitGB: parseInt(e.target.value) || 0 }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-neutral-500 uppercase">Resoluções Unlimited (NB2)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['512px', '1K', '2K', '4K'].map((res) => {
                                                        const unlimitedRes = formData.metadata?.unlimitedResolutions || [];
                                                        const isChecked = unlimitedRes.includes(res);
                                                        return (
                                                            <label
                                                                key={res}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all",
                                                                    isChecked
                                                                        ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
                                                                        : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                                                )}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        const newRes = e.target.checked
                                                                            ? [...unlimitedRes, res]
                                                                            : unlimitedRes.filter((r: string) => r !== res);
                                                                        setFormData({
                                                                            ...formData,
                                                                            metadata: { ...formData.metadata, unlimitedResolutions: newRes }
                                                                        });
                                                                    }}
                                                                    className="sr-only"
                                                                />
                                                                <span className="text-sm font-mono">{res}</span>
                                                                {isChecked && <span className="text-xs">∞</span>}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[10px] text-neutral-600">
                                                    Marque as resoluções que não consomem créditos para assinantes deste plano.
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-xs font-bold text-neutral-500 uppercase">Modelos Unlimited</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { id: 'nb2', label: 'NB2 (Flash)', model: 'gemini-3.1-flash-image-preview' },
                                                        { id: 'pro', label: '4K Pro', model: 'gemini-3-pro-image-preview' },
                                                        { id: 'veo-fast', label: 'Veo Fast', model: 'veo-3.1-fast-generate-preview' },
                                                    ].map(({ id, label, model }) => {
                                                        const unlimitedModels = formData.metadata?.unlimitedModels || [];
                                                        const isChecked = unlimitedModels.includes(model);
                                                        return (
                                                            <label
                                                                key={id}
                                                                className={cn(
                                                                    "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all",
                                                                    isChecked
                                                                        ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
                                                                        : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                                                )}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        const newModels = e.target.checked
                                                                            ? [...unlimitedModels, model]
                                                                            : unlimitedModels.filter((m: string) => m !== model);
                                                                        setFormData({
                                                                            ...formData,
                                                                            metadata: { ...formData.metadata, unlimitedModels: newModels }
                                                                        });
                                                                    }}
                                                                    className="sr-only"
                                                                />
                                                                <span className="text-sm font-medium">{label}</span>
                                                                {isChecked && <span className="text-xs">∞</span>}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-neutral-500 uppercase">Intervalo</label>
                                                <Select
                                                    value={formData.metadata?.interval || 'month'}
                                                    onChange={(val: any) => setFormData({
                                                        ...formData,
                                                        metadata: { ...formData.metadata, interval: val }
                                                    })}
                                                    options={[
                                                        { value: 'month', label: 'Mensal' },
                                                        { value: 'year', label: 'Anual' }
                                                    ]}
                                                    className="bg-neutral-900 border-neutral-800 w-48"
                                                />
                                            </div>
                                        </div>

                                        {/* Rate Limits */}
                                        <div className="md:col-span-2 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg space-y-4">
                                            <h4 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                                                <span className="text-lg">⏱️</span> Limites de Uso
                                            </h4>
                                            <p className="text-xs text-neutral-500">
                                                Defina limites para proteger contra abuso, especialmente com unlimited ativado.
                                            </p>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Gerações/Dia</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="∞"
                                                        value={formData.metadata?.maxGenerationsPerDay || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxGenerationsPerDay: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Gerações/Hora</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="∞"
                                                        value={formData.metadata?.maxGenerationsPerHour || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxGenerationsPerHour: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Max Projetos</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="∞"
                                                        value={formData.metadata?.maxCanvasProjects || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxCanvasProjects: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Max Guidelines</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="∞"
                                                        value={formData.metadata?.maxBrandGuidelines || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxBrandGuidelines: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Max Ref Images</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="13"
                                                        value={formData.metadata?.maxRefImagesPerGen || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxRefImagesPerGen: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Max Vídeo (seg)</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="8"
                                                        value={formData.metadata?.maxVideoSeconds || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxVideoSeconds: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Resolução Max</label>
                                                    <Select
                                                        value={formData.metadata?.maxResolution || '4K'}
                                                        onChange={(val: any) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxResolution: val }
                                                        })}
                                                        options={[
                                                            { value: '512px', label: '512px' },
                                                            { value: '1K', label: '1K' },
                                                            { value: '2K', label: '2K' },
                                                            { value: '4K', label: '4K' }
                                                        ]}
                                                        className="bg-neutral-900 border-neutral-800"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Prioridade Fila</label>
                                                    <Select
                                                        value={formData.metadata?.queuePriority || 'normal'}
                                                        onChange={(val: any) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, queuePriority: val }
                                                        })}
                                                        options={[
                                                            { value: 'low', label: 'Baixa' },
                                                            { value: 'normal', label: 'Normal' },
                                                            { value: 'high', label: 'Alta' }
                                                        ]}
                                                        className="bg-neutral-900 border-neutral-800"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Feature Flags */}
                                        <div className="md:col-span-2 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg space-y-4">
                                            <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                                <span className="text-lg">🎛️</span> Features do Plano
                                            </h4>
                                            <p className="text-xs text-neutral-500">
                                                Ative ou desative funcionalidades específicas para este plano.
                                            </p>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {[
                                                    { key: 'hasFigmaPlugin', label: 'Plugin Figma', icon: '🔌' },
                                                    { key: 'hasApiAccess', label: 'API Access', icon: '🔗' },
                                                    { key: 'hasPublicPages', label: 'Páginas Públicas', icon: '🌐' },
                                                    { key: 'hasVideoGeneration', label: 'Geração de Vídeo', icon: '🎬' },
                                                    { key: 'hasAdvancedModels', label: 'Modelos Premium', icon: '💎' },
                                                    { key: 'hasSharedWorkspaces', label: 'Workspaces', icon: '👥' },
                                                    { key: 'hasTeamAnalytics', label: 'Analytics', icon: '📊' },
                                                    { key: 'hasPrioritySupport', label: 'Suporte Prioritário', icon: '⚡' },
                                                ].map(({ key, label, icon }) => {
                                                    const isChecked = formData.metadata?.[key] === true;
                                                    return (
                                                        <label
                                                            key={key}
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-2.5 rounded-md border cursor-pointer transition-all",
                                                                isChecked
                                                                    ? "bg-purple-500/10 border-purple-500/40 text-purple-400"
                                                                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    metadata: { ...formData.metadata, [key]: e.target.checked }
                                                                })}
                                                                className="sr-only"
                                                            />
                                                            <span>{icon}</span>
                                                            <span className="text-xs font-medium">{label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Max Membros Time</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="1 = individual"
                                                        value={formData.metadata?.maxTeamMembers || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, maxTeamMembers: parseInt(e.target.value) || 1 }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Retenção Histórico (dias)</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="30"
                                                        value={formData.metadata?.historyRetentionDays || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, historyRetentionDays: parseInt(e.target.value) || 30 }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Commercial Settings */}
                                        <div className="md:col-span-2 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg space-y-4">
                                            <h4 className="text-sm font-bold text-green-400 flex items-center gap-2">
                                                <span className="text-lg">💰</span> Configurações Comerciais
                                            </h4>
                                            <p className="text-xs text-neutral-500">
                                                Badges, trials e configurações de marketing.
                                            </p>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Trial (dias)</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="0 = sem trial"
                                                        value={formData.metadata?.trialDays || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, trialDays: parseInt(e.target.value) || 0 }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Desconto Anual %</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="20"
                                                        value={formData.metadata?.annualDiscountPercent || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, annualDiscountPercent: parseInt(e.target.value) || 0 }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Rollover %</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="0 = não rola"
                                                        value={formData.metadata?.creditRolloverPercent || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, creditRolloverPercent: parseInt(e.target.value) || 0 }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">SLA (horas)</label>
                                                    <Input
                                                        type="number"
                                                        placeholder="48"
                                                        value={formData.metadata?.slaResponseHours || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, slaResponseHours: parseInt(e.target.value) || null }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                                                {[
                                                    { key: 'isPopular', label: 'POPULAR', color: 'blue' },
                                                    { key: 'isBestValue', label: 'BEST VALUE', color: 'green' },
                                                    { key: 'isNew', label: 'NOVO', color: 'purple' },
                                                ].map(({ key, label, color }) => {
                                                    const isChecked = formData.metadata?.[key] === true;
                                                    return (
                                                        <label
                                                            key={key}
                                                            className={cn(
                                                                "flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border cursor-pointer transition-all",
                                                                isChecked
                                                                    ? `bg-${color}-500/10 border-${color}-500/40 text-${color}-400`
                                                                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    metadata: { ...formData.metadata, [key]: e.target.checked }
                                                                })}
                                                                className="sr-only"
                                                            />
                                                            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Badge Customizado</label>
                                                    <Input
                                                        placeholder="ex: 50% OFF"
                                                        value={formData.metadata?.badgeText || ''}
                                                        onChange={(e) => setFormData({
                                                            ...formData,
                                                            metadata: { ...formData.metadata, badgeText: e.target.value }
                                                        })}
                                                        className="bg-neutral-900 border-neutral-800 text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-neutral-500 uppercase">Cor do Badge</label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            type="color"
                                                            value={formData.metadata?.badgeColor || '#00D4FF'}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                metadata: { ...formData.metadata, badgeColor: e.target.value }
                                                            })}
                                                            className="w-12 h-9 p-1 bg-neutral-900 border-neutral-800 rounded cursor-pointer"
                                                        />
                                                        <Input
                                                            placeholder="#00D4FF"
                                                            value={formData.metadata?.badgeColor || ''}
                                                            onChange={(e) => setFormData({
                                                                ...formData,
                                                                metadata: { ...formData.metadata, badgeColor: e.target.value }
                                                            })}
                                                            className="flex-1 bg-neutral-900 border-neutral-800 font-mono text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="h-px bg-neutral-800 w-full" />

                            {/* Values & Limits */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">Créditos</label>
                                    <Input
                                        type="number"
                                        value={formData.credits}
                                        onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                                        className="bg-neutral-900 border-neutral-800 text-brand-cyan font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">Preço R$ (BRL)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">R$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.priceBRL}
                                            onChange={(e) => setFormData({ ...formData, priceBRL: parseFloat(e.target.value) || 0 })}
                                            className="bg-neutral-900 border-neutral-800 pl-9 font-bold text-green-500"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase ">Preço $ (USD) - Opcional</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.priceUSD}
                                            onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                                            className="bg-neutral-900 border-neutral-800 pl-7 text-neutral-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-neutral-800 w-full" />

                            {/* Payment Settings */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-neutral-400 flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-brand-cyan" />
                                        Plataformas & IDs
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <MicroTitle as="label" className="pl-1 font-bold">Stripe Product ID</MicroTitle>
                                            <Input
                                                placeholder="prod_..."
                                                value={formData.stripeProductId}
                                                onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                                                className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <MicroTitle as="label" className="pl-1 font-bold">Abacate Product ID</MicroTitle>
                                            <Input
                                                placeholder="prod_..."
                                                value={formData.abacateProductId}
                                                onChange={(e) => setFormData({ ...formData, abacateProductId: e.target.value })}
                                                className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <MicroTitle as="label" className="pl-1 font-bold">Abacate Bill ID (PIX)</MicroTitle>
                                            <Input
                                                placeholder="bill_..."
                                                value={formData.abacateBillId}
                                                onChange={(e) => setFormData({ ...formData, abacateBillId: e.target.value })}
                                                className="bg-neutral-900 border-neutral-800 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-neutral-400 flex items-center gap-2">
                                        <Link2 className="h-4 w-4 text-brand-cyan" />
                                        Checkout Links
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <MicroTitle as="label" className="pl-1 font-bold">Link de Pagamento BRL (Stripe)</MicroTitle>
                                            <Input
                                                placeholder="https://buy.stripe.com/..."
                                                value={formData.paymentLinkBRL}
                                                onChange={(e) => setFormData({ ...formData, paymentLinkBRL: e.target.value })}
                                                className="bg-neutral-900 border-neutral-800 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <MicroTitle as="label" className="pl-1 font-bold">Link de Pagamento USD (Stripe)</MicroTitle>
                                            <Input
                                                placeholder="https://buy.stripe.com/..."
                                                value={formData.paymentLinkUSD}
                                                onChange={(e) => setFormData({ ...formData, paymentLinkUSD: e.target.value })}
                                                className="bg-neutral-900 border-neutral-800 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-neutral-800">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-4 h-4 accent-brand-cyan"
                                        />
                                        <label htmlFor="isActive" className="text-sm text-neutral-400">Produto Ativo</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm text-neutral-400">Ordem:</label>
                                        <Input
                                            type="number"
                                            value={formData.displayOrder}
                                            onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                                            className="w-20 bg-neutral-900 border-neutral-800 h-8 text-center"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                                    <Button variant="brand" className="bg-brand-cyan hover:bg-brand-cyan/90 text-neutral-950 font-bold px-8"
                                        onClick={handleSave}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Salvar Produto
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
