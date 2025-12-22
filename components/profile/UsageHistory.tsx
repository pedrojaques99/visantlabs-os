import React, { useState, useEffect, useMemo } from 'react';
import { FileText, CreditCard, TrendingUp, Image, Palette, ImageIcon, X, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { usageHistoryService, type UsageHistoryRecord, type FeatureType } from '../../services/usageHistoryService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { GlitchLoader } from '../ui/GlitchLoader';
import { Badge } from '../ui/badge';

interface UsageHistoryProps {
    isAuthenticated: boolean;
}

export const UsageHistory: React.FC<UsageHistoryProps> = ({ isAuthenticated }) => {
    const { t } = useTranslation();
    const [usageHistory, setUsageHistory] = useState<UsageHistoryRecord[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [historyFilter, setHistoryFilter] = useState<FeatureType | 'all'>('all');
    const [historyPagination, setHistoryPagination] = useState({ limit: 50, offset: 0, total: 0, hasMore: false });

    // Load usage history
    useEffect(() => {
        const loadUsageHistory = async () => {
            if (!isAuthenticated) return;

            setIsLoadingHistory(true);
            setHistoryError(null);

            try {
                const filters = historyFilter !== 'all' ? { feature: historyFilter } : undefined;
                const response = await usageHistoryService.getUsageHistory(filters, {
                    limit: historyPagination.limit,
                    offset: historyPagination.offset,
                });

                setUsageHistory(response.records);
                setHistoryPagination(prev => ({
                    ...prev,
                    total: response.pagination.total,
                    hasMore: response.pagination.hasMore,
                }));
            } catch (err: any) {
                console.error('Failed to load usage history:', err);
                setHistoryError(err.message || t('usageHistory.loadError'));
            } finally {
                setIsLoadingHistory(false);
            }
        };

        loadUsageHistory();
    }, [isAuthenticated, historyFilter, historyPagination.offset, historyPagination.limit, t]);

    // Reset pagination when filter changes
    useEffect(() => {
        setHistoryPagination(prev => {
            if (prev.offset !== 0) {
                return { ...prev, offset: 0 };
            }
            return prev;
        });
    }, [historyFilter]);

    // Helper to format dates
    const formatFriendlyDateTime = (dateString: string | Date): string => {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate statistics from usage history
    const usageStats = useMemo(() => {
        if (!usageHistory || usageHistory.length === 0) {
            return {
                totalRecords: 0,
                totalCredits: 0,
                byFeature: {
                    mockupmachine: { count: 0, credits: 0 },
                    brandingmachine: { count: 0, credits: 0 },
                    canvas: { count: 0, credits: 0 },
                },
                byModel: {} as Record<string, number>,
                last7Days: { count: 0, credits: 0 },
                last30Days: { count: 0, credits: 0 },
            };
        }

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const stats = {
            totalRecords: usageHistory.length,
            totalCredits: usageHistory.reduce((sum, record) => sum + (record.creditsDeducted || 0), 0),
            byFeature: {
                mockupmachine: { count: 0, credits: 0 },
                brandingmachine: { count: 0, credits: 0 },
                canvas: { count: 0, credits: 0 },
            },
            byModel: {} as Record<string, number>,
            last7Days: { count: 0, credits: 0 },
            last30Days: { count: 0, credits: 0 },
        };

        usageHistory.forEach((record) => {
            const recordDate = new Date(record.timestamp);
            const credits = record.creditsDeducted || 0;

            // By feature
            if (record.feature && record.feature in stats.byFeature) {
                const feature = record.feature as keyof typeof stats.byFeature;
                stats.byFeature[feature].count++;
                stats.byFeature[feature].credits += credits;
            }

            // By model
            if (record.model) {
                stats.byModel[record.model] = (stats.byModel[record.model] || 0) + 1;
            }

            // By period
            if (recordDate >= sevenDaysAgo) {
                stats.last7Days.count++;
                stats.last7Days.credits += credits;
            }
            if (recordDate >= thirtyDaysAgo) {
                stats.last30Days.count++;
                stats.last30Days.credits += credits;
            }
        });

        return stats;
    }, [usageHistory]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <FileText size={24} className="text-brand-cyan" />
                <div>
                    <h2 className="text-xl font-semibold text-zinc-100 font-manrope">
                        {t('usageHistory.title') || 'Histórico de Uso'}
                    </h2>
                    <p className="text-sm text-zinc-500 font-mono">
                        Visualize seu histórico de uso e consumo de créditos
                    </p>
                </div>
            </div>

            {/* Error Display */}
            {historyError && (
                <Card className="bg-[#1A1A1A] border border-red-500/30 rounded-xl">
                    <CardContent className="p-4">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-mono flex items-center gap-2">
                            <X size={16} />
                            {historyError}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Loading State */}
            {isLoadingHistory && usageHistory.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="bg-[#1A1A1A] border border-zinc-800/50 h-32 flex items-center justify-center">
                            <GlitchLoader size={20} />
                        </Card>
                    ))}
                </div>
            ) : usageHistory.length === 0 ? (
                <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                    <CardContent className="p-6 md:p-8">
                        <div className="flex flex-col items-center justify-center gap-3 py-8">
                            <p className="text-sm text-zinc-500 font-mono text-center">
                                {t('usageHistory.noRecords') || 'Nenhum registro encontrado'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Statistics Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {/* Total Records */}
                        <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-brand-cyan/10 rounded-lg">
                                        <FileText className="h-6 w-6 text-brand-cyan" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-zinc-300 mb-2 font-mono">
                                        {usageStats.totalRecords}
                                    </p>
                                    <p className="text-sm text-zinc-500 font-mono">Total de Usos</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Total Credits */}
                        <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-brand-cyan/10 rounded-lg">
                                        <CreditCard className="h-6 w-6 text-brand-cyan" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                                        {usageStats.totalCredits}
                                    </p>
                                    <p className="text-sm text-zinc-500 font-mono">Créditos Gastos</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Mockup Machine Stats */}
                        <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-brand-cyan/10 rounded-lg">
                                        <Image className="h-6 w-6 text-brand-cyan" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                                        {usageStats.byFeature.mockupmachine.count}
                                    </p>
                                    <p className="text-sm text-zinc-500 font-mono">Mockup Machine</p>
                                    <p className="text-xs text-zinc-400 font-mono mt-1">{usageStats.byFeature.mockupmachine.credits} créditos</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Canvas Stats */}
                        <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-brand-cyan/30 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-brand-cyan/10 rounded-lg">
                                        <ImageIcon className="h-6 w-6 text-brand-cyan" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-brand-cyan mb-2 font-mono">
                                        {usageStats.byFeature.canvas.count}
                                    </p>
                                    <p className="text-sm text-zinc-500 font-mono">Canvas</p>
                                    <p className="text-xs text-zinc-400 font-mono mt-1">{usageStats.byFeature.canvas.credits} créditos</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filter buttons */}
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl">
                        <CardContent className="p-4 md:p-6">
                            <div className="flex flex-wrap gap-2">
                                {(['all', 'brandingmachine', 'mockupmachine', 'canvas'] as const).map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setHistoryFilter(filter)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-mono transition ${historyFilter === filter
                                            ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan'
                                            : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:bg-black/60'
                                            }`}
                                    >
                                        {filter === 'all' ? (t('usageHistory.all') || 'Todos') :
                                            filter === 'brandingmachine' ? (t('usageHistory.brandingMachine') || 'Branding Machine') :
                                                filter === 'mockupmachine' ? (t('usageHistory.mockupMachine') || 'Mockup Machine') :
                                                    (t('usageHistory.canvas') || 'Canvas')}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* History Table */}
                    <Card className="bg-[#1A1A1A] border border-zinc-800/50 rounded-xl hover:border-brand-cyan/30 transition-all duration-300 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-zinc-300 font-mono text-base">
                                <FileText className="h-5 w-5 text-brand-cyan" />
                                {t('usageHistory.details') || 'Detalhes do Histórico'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border border-zinc-800/50 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-zinc-900/50">
                                        <TableRow className="border-zinc-800/50 hover:bg-transparent">
                                            <TableHead className="text-zinc-500 font-mono">
                                                {t('usageHistory.date') || 'Data'}
                                            </TableHead>
                                            <TableHead className="text-zinc-500 font-mono">
                                                {t('usageHistory.feature') || 'Recurso'}
                                            </TableHead>
                                            <TableHead className="text-zinc-500 font-mono">
                                                {t('usageHistory.credits') || 'Créditos'}
                                            </TableHead>
                                            <TableHead className="text-zinc-500 font-mono">
                                                {t('usageHistory.model') || 'Modelo'}
                                            </TableHead>
                                            <TableHead className="text-zinc-500 font-mono">
                                                {t('usageHistory.details') || 'Detalhes'}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {usageHistory.map((record) => (
                                            <TableRow key={record.id} className="border-zinc-800/30 text-zinc-300 hover:bg-black/20 transition-colors">
                                                <TableCell className="px-4 py-4 text-sm font-mono whitespace-nowrap">
                                                    {formatFriendlyDateTime(record.timestamp)}
                                                </TableCell>
                                                <TableCell className="px-4 py-4 text-sm font-mono">
                                                    <div className="flex items-center gap-2">
                                                        {record.feature === 'brandingmachine' && <Palette className="w-3 h-3 text-purple-400" />}
                                                        {record.feature === 'mockupmachine' && <Image className="w-3 h-3 text-blue-400" />}
                                                        {record.feature === 'canvas' && <ImageIcon className="w-3 h-3 text-brand-cyan" />}
                                                        <span>
                                                            {record.feature === 'brandingmachine' && (t('usageHistory.brandingMachine') || 'Branding Machine')}
                                                            {record.feature === 'mockupmachine' && (t('usageHistory.mockupMachine') || 'Mockup Machine')}
                                                            {record.feature === 'canvas' && (t('usageHistory.canvas') || 'Canvas')}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-4 text-sm text-brand-cyan font-mono font-semibold">
                                                    {record.creditsDeducted}
                                                </TableCell>
                                                <TableCell className="px-4 py-4 text-sm text-zinc-400 font-mono">
                                                    {record.model ? <Badge variant="outline" className="text-[10px] bg-black/40 border-zinc-700/50">{record.model}</Badge> : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-4 text-sm text-zinc-400 font-mono">
                                                    <div className="flex flex-wrap gap-1">
                                                        {record.stepNumber && (
                                                            <span className="text-xs bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-500">
                                                                Step {record.stepNumber}
                                                            </span>
                                                        )}
                                                        {record.resolution && (
                                                            <span className="text-xs bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-500">
                                                                {record.resolution}
                                                            </span>
                                                        )}
                                                        {!record.stepNumber && !record.resolution && <span className="text-zinc-600">-</span>}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {historyPagination.total > historyPagination.limit && (
                                <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-zinc-800">
                                    <p className="text-xs text-zinc-500 font-mono">
                                        {t('usageHistory.showing') || 'Exibindo'} {historyPagination.offset + 1} - {Math.min(historyPagination.offset + historyPagination.limit, historyPagination.total)} {t('usageHistory.of') || 'de'} {historyPagination.total}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setHistoryPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                                            disabled={historyPagination.offset === 0}
                                            className="px-3 py-1.5 bg-black/40 border border-zinc-800 text-zinc-300 rounded-md text-xs font-mono hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            {t('usageHistory.previous') || 'Anterior'}
                                        </button>
                                        <button
                                            onClick={() => setHistoryPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                                            disabled={!historyPagination.hasMore}
                                            className="px-3 py-1.5 bg-black/40 border border-zinc-800 text-zinc-300 rounded-md text-xs font-mono hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            {t('usageHistory.next') || 'Próximo'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};
