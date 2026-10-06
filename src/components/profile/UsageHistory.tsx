import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Image, Palette, ImageIcon, X } from '@/lib/ui/icons';
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
import { ErrorState } from '@/components/ui/ErrorState';
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
  const [reloadNonce, setReloadNonce] = useState(0);

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
  }, [
    isAuthenticated,
    historyFilter,
    historyPagination.offset,
    historyPagination.limit,
    reloadNonce,
    t,
  ]);

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
    { value: 'all', label: t('usageHistory.all') },
    { value: 'mockupmachine', label: t('usageHistory.mockupMachine') },
    { value: 'brandingmachine', label: t('usageHistory.brandingMachine') },
    { value: 'canvas', label: t('usageHistory.canvas') },
  ];

  if (isLoadingHistory && usageHistory.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <GlitchLoader size={24} />
      </div>
    );
  }

  if (historyError && usageHistory.length === 0 && !isLoadingHistory) {
    return (
      <div className="border border-border rounded-xl bg-card">
        <ErrorState
          title={t('usageHistory.loadErrorTitle')}
          description={historyError}
          onRetry={() => setReloadNonce((n) => n + 1)}
          retryLabel={t('usageHistory.retry')}
        />
      </div>
    );
  }

  if (usageHistory.length === 0 && !isLoadingHistory) {
    return (
      <div className="border border-border rounded-xl bg-card p-12 flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">{t('usageHistory.noRecords')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Section header */}
      <div className="mb-2">
        <h2 className="text-sm font-medium text-foreground">{t('usageHistory.title')}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t('usageHistory.subtitle')}</p>
      </div>

      {/* Error over stale data: the rows/stats below are from the PREVIOUS
          successful load, so label them as such and offer a retry. An error
          banner with no recourse leaves the user staring at money data that
          may silently be out of date. */}
      {historyError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive flex items-center gap-3">
          <X size={14} className="shrink-0" />
          <span className="flex-1">
            {historyError}. {t('usageHistory.showingStale')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={isLoadingHistory}
            className="h-7 px-3 text-2xs shrink-0"
          >
            {t('usageHistory.retry')}
          </Button>
        </div>
      )}

      {/* Compact stats strip */}
      <div className="flex divide-x divide-border border border-border rounded-xl overflow-hidden bg-muted/40">
        {[
          // "Total de Usos" reflects the full result set, not just this page.
          { value: historyPagination.total, label: t('usageHistory.totalUses') },
          // Credits: real total when the server sends stats; otherwise only this page is known.
          {
            value: usageStats.totalCredits,
            label: serverStats ? t('usageHistory.creditsSpent') : t('usageHistory.creditsThisPage'),
          },
          // Per-tool activity counts — labelled as uses, and only shown when non-zero.
          {
            value: usageStats.byFeature.mockupmachine.count,
            label: t('usageHistory.toolUses', { tool: t('usageHistory.mockupMachine') }),
          },
          {
            value: usageStats.byFeature.brandingmachine.count,
            label: t('usageHistory.toolUses', { tool: t('usageHistory.brandingMachine') }),
          },
          {
            value: usageStats.byFeature.canvas.count,
            label: t('usageHistory.toolUses', { tool: t('usageHistory.canvas') }),
          },
        ]
          // Keep the Total + Credits tiles always; drop zero-value per-tool tiles.
          .filter((stat, index) => index < 2 || stat.value > 0)
          .map((stat) => (
            <div key={stat.label} className="flex-1 px-4 py-4 min-w-0">
              <p className="text-xl font-semibold text-foreground font-mono tabular-nums leading-none">
                {stat.value}
              </p>
              <p className="text-2xs text-muted-foreground mt-1.5 truncate">{stat.label}</p>
            </div>
          ))}
      </div>

      {/* Filter strip + table — unified container */}
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Filter strip */}
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-border bg-muted/40">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={historyFilter === opt.value}
              onClick={() => setHistoryFilter(opt.value)}
              className={cn(
                'px-3 py-1 rounded-md text-2xs transition-colors',
                historyFilter === opt.value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs">
                  {t('usageHistory.date')}
                </TableHead>
                <TableHead className="text-muted-foreground text-xs">
                  {t('usageHistory.feature')}
                </TableHead>
                <TableHead className="text-muted-foreground text-xs">
                  {t('usageHistory.credits')}
                </TableHead>
                <TableHead className="text-muted-foreground text-xs">
                  {t('usageHistory.model')}
                </TableHead>
                <TableHead className="text-muted-foreground text-xs">
                  {t('usageHistory.details')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageHistory.map((record) => (
                <TableRow
                  key={record.id}
                  className="border-border text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <TableCell className="px-4 py-3 text-xs font-mono whitespace-nowrap text-muted-foreground">
                    {formatFriendlyDateTime(record.timestamp)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      {record.feature === 'brandingmachine' && (
                        <Palette className="w-3 h-3 text-muted-foreground" />
                      )}
                      {record.feature === 'mockupmachine' && (
                        <Image className="w-3 h-3 text-muted-foreground" />
                      )}
                      {record.feature === 'canvas' && (
                        <ImageIcon className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className="text-foreground">
                        {record.feature === 'brandingmachine' && t('usageHistory.brandingMachine')}
                        {record.feature === 'mockupmachine' && t('usageHistory.mockupMachine')}
                        {record.feature === 'canvas' && t('usageHistory.canvas')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono text-foreground tabular-nums">
                    {record.creditsDeducted}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {record.model ? <Badge variant="neutral">{record.model}</Badge> : null}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-1">
                      {record.stepNumber && (
                        <span className="text-2xs bg-muted px-1.5 py-0.5 rounded">
                          {t('usageHistory.step')} {record.stepNumber}
                        </span>
                      )}
                      {record.resolution && (
                        <span className="text-2xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {record.resolution}
                        </span>
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
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border">
            <p className="text-2xs text-muted-foreground font-mono">
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
                className="h-7 px-3 text-2xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                {t('usageHistory.previous')}
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
                className="h-7 px-3 text-2xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                {t('usageHistory.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
