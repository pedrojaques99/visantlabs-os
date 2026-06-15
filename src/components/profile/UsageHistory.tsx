import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Image, Palette, ImageIcon, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  usageHistoryService,
  type UsageHistoryRecord,
  type FeatureType,
} from '@/services/usageHistoryService';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/utils/localeUtils';
import { cn } from '@/lib/utils';

interface UsageHistoryProps {
  isAuthenticated: boolean;
}

export const UsageHistory: React.FC<UsageHistoryProps> = ({ isAuthenticated }) => {
  const { t } = useTranslation();
  const [usageHistory, setUsageHistory] = useState<UsageHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<FeatureType | 'all'>('all');
  const [historyPagination, setHistoryPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  });
  const [serverStats, setServerStats] = useState<any>(null);

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
        setHistoryPagination((prev) => ({
          ...prev,
          total: response.pagination.total,
          hasMore: response.pagination.hasMore,
        }));
        if (response.stats) {
          setServerStats(response.stats);
        }
      } catch (err: any) {
        console.error('Failed to load usage history:', err);
        setHistoryError(err.message || t('usageHistory.loadError'));
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadUsageHistory();
  }, [isAuthenticated, historyFilter, historyPagination.offset, historyPagination.limit, t]);

  useEffect(() => {
    setHistoryPagination((prev) => {
      if (prev.offset !== 0) {
        return { ...prev, offset: 0 };
      }
      return prev;
    });
  }, [historyFilter]);

  const formatFriendlyDateTime = (dateString: string | Date): string => {
    return formatDateTime(dateString);
  };

  const usageStats = useMemo(() => {
    if (serverStats) {
      return serverStats;
    }

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

      if (record.feature && record.feature in stats.byFeature) {
        const feature = record.feature as keyof typeof stats.byFeature;
        stats.byFeature[feature].count++;
        stats.byFeature[feature].credits += credits;
      }

      if (record.model) {
        stats.byModel[record.model] = (stats.byModel[record.model] || 0) + 1;
      }

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
  }, [usageHistory, serverStats]);

  const FILTER_OPTIONS: { value: FeatureType | 'all'; label: string }[] = [
    { value: 'all', label: t('usageHistory.all') || 'Todos' },
    { value: 'mockupmachine', label: t('usageHistory.mockupMachine') || 'Mockup Machine' },
    { value: 'brandingmachine', label: t('usageHistory.brandingMachine') || 'Branding Machine' },
    { value: 'canvas', label: t('usageHistory.canvas') || 'Canvas' },
  ];

  if (isLoadingHistory && usageHistory.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <GlitchLoader size={24} />
      </div>
    );
  }

  if (usageHistory.length === 0 && !isLoadingHistory) {
    return (
      <div className="border border-white/10 rounded-2xl bg-neutral-900/20 p-12 flex flex-col items-center gap-4">
        <p className="text-sm text-neutral-500 font-mono">
          {t('usageHistory.noRecords') || 'Nenhum registro encontrado'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Section header */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-neutral-200">
          {t('usageHistory.title') || 'Histórico de Uso'}
        </h2>
        <p className="text-xs text-neutral-500 font-mono mt-0.5">
          {t('usageHistory.subtitle') || 'Consumo de créditos por ferramenta'}
        </p>
      </div>

      {/* Error */}
      {historyError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive font-mono flex items-center gap-2">
          <X size={14} className="shrink-0" />
          <span className="flex-1">{historyError}</span>
        </div>
      )}

      {/* Compact stats strip */}
      <div className="flex divide-x divide-white/5 border border-white/5 rounded-xl overflow-hidden bg-white/[0.03]">
        {[
          { value: usageStats.totalRecords, label: 'Total de Usos' },
          { value: usageStats.totalCredits, label: 'Créditos Gastos' },
          { value: usageStats.byFeature.mockupmachine.count, label: 'Mockup Machine' },
          { value: usageStats.byFeature.brandingmachine.count, label: 'Branding Machine' },
          { value: usageStats.byFeature.canvas.count, label: 'Canvas' },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 px-4 py-4 min-w-0">
            <p className="text-xl font-bold text-neutral-100 font-mono tabular-nums leading-none">
              {stat.value}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mt-1.5 truncate">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filter strip + table — unified container */}
      <div className="border border-white/10 rounded-2xl overflow-hidden">
        {/* Filter strip */}
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-white/5 bg-white/[0.03]">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHistoryFilter(opt.value)}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-mono transition-colors',
                historyFilter === opt.value
                  ? 'bg-white/10 text-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
              )}
            >
              {opt.label}
            </button>
          ))}
          {isLoadingHistory && (
            <span className="ml-auto flex items-center">
              <GlitchLoader size={12} />
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest">
                  {t('usageHistory.date') || 'Data'}
                </TableHead>
                <TableHead className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest">
                  {t('usageHistory.feature') || 'Recurso'}
                </TableHead>
                <TableHead className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest">
                  {t('usageHistory.credits') || 'Créditos'}
                </TableHead>
                <TableHead className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest">
                  {t('usageHistory.model') || 'Modelo'}
                </TableHead>
                <TableHead className="text-neutral-600 font-mono text-[10px] uppercase tracking-widest">
                  {t('usageHistory.details') || 'Detalhes'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageHistory.map((record) => (
                <TableRow
                  key={record.id}
                  className="border-white/[0.03] text-neutral-400 hover:bg-white/[0.03] transition-colors"
                >
                  <TableCell className="px-4 py-3 text-xs font-mono whitespace-nowrap text-neutral-400">
                    {formatFriendlyDateTime(record.timestamp)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      {record.feature === 'brandingmachine' && (
                        <Palette className="w-3 h-3 text-neutral-500" />
                      )}
                      {record.feature === 'mockupmachine' && (
                        <Image className="w-3 h-3 text-neutral-500" />
                      )}
                      {record.feature === 'canvas' && (
                        <ImageIcon className="w-3 h-3 text-neutral-500" />
                      )}
                      <span className="text-neutral-300">
                        {record.feature === 'brandingmachine' &&
                          (t('usageHistory.brandingMachine') || 'Branding Machine')}
                        {record.feature === 'mockupmachine' &&
                          (t('usageHistory.mockupMachine') || 'Mockup Machine')}
                        {record.feature === 'canvas' && (t('usageHistory.canvas') || 'Canvas')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono text-neutral-200 tabular-nums">
                    {record.creditsDeducted}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-neutral-500 font-mono">
                    {record.model ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-white/[0.03] border-white/10 text-neutral-500"
                      >
                        {record.model}
                      </Badge>
                    ) : (
                      <span className="text-neutral-700">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-neutral-500 font-mono">
                    <div className="flex flex-wrap gap-1">
                      {record.stepNumber && (
                        <span className="text-[10px] bg-white/[0.03] px-1.5 py-0.5 rounded text-neutral-600">
                          Step {record.stepNumber}
                        </span>
                      )}
                      {record.resolution && (
                        <span className="text-[10px] bg-white/[0.03] px-1.5 py-0.5 rounded text-neutral-600">
                          {record.resolution}
                        </span>
                      )}
                      {!record.stepNumber && !record.resolution && (
                        <span className="text-neutral-700">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {historyPagination.total > historyPagination.limit && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-white/5">
            <p className="text-[10px] text-neutral-600 font-mono">
              {historyPagination.offset + 1}–
              {Math.min(
                historyPagination.offset + historyPagination.limit,
                historyPagination.total
              )}{' '}
              / {historyPagination.total}
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setHistoryPagination((prev) => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - prev.limit),
                  }))
                }
                disabled={historyPagination.offset === 0}
                className="h-7 px-3 text-[11px] font-mono text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
              >
                {t('usageHistory.previous') || 'Anterior'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setHistoryPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
                disabled={!historyPagination.hasMore}
                className="h-7 px-3 text-[11px] font-mono text-neutral-400 hover:text-neutral-200 disabled:opacity-30"
              >
                {t('usageHistory.next') || 'Próximo'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
