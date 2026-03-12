import React, { useState, useMemo } from 'react';
import { Search, TrendingUp, AlertCircle } from 'lucide-react';
import { useComponentMetrics, getUsageLevelInfo } from '@/hooks/useComponentMetrics';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { SkeletonLoader } from './ui/SkeletonLoader';
import { cn } from '@/lib/utils';

/**
 * ComponentLibrary
 * Displays all available components with real-time usage metrics
 * Useful for both users and agents to understand component usage patterns
 */
export const ComponentLibrary: React.FC<{
  compact?: boolean;
  showTopOnly?: boolean;
}> = ({ compact = false, showTopOnly = false }) => {
  const { metrics, loading, error } = useComponentMetrics();
  const [search, setSearch] = useState('');

  const filteredComponents = useMemo(() => {
    if (!metrics?.components) return [];

    let items = showTopOnly ? metrics.topComponents : metrics.components;

    if (search) {
      const query = search.toLowerCase();
      items = items.filter(
        c => c.name.toLowerCase().includes(query) || c.path.toLowerCase().includes(query)
      );
    }

    return items;
  }, [metrics, search, showTopOnly]);

  if (error && !compact) {
    return (
      <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-400">Component metrics unavailable</p>
            <p className="text-xs text-orange-400/70 mt-1">{error}</p>
            <p className="text-xs text-orange-400/60 mt-2">
              Run: <code className="bg-black/50 px-2 py-1 rounded">node scripts/analyze-components.js --json</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <SkeletonLoader />;
  }

  if (!metrics?.components || metrics.components.length === 0) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <p>No component metrics available</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-2')}>
      {/* Summary Stats */}
      {!compact && metrics && (
        <div className="grid grid-cols-5 gap-2 mb-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded p-3">
            <p className="text-xs text-neutral-500">Total</p>
            <p className="text-lg font-bold text-neutral-200">{metrics.components.length}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
            <p className="text-xs text-red-400">🔥 Critical</p>
            <p className="text-lg font-bold text-red-300">{metrics.distribution.veryFrequent}</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
            <p className="text-xs text-orange-400">✨ Frequent</p>
            <p className="text-lg font-bold text-orange-300">{metrics.distribution.frequent}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
            <p className="text-xs text-blue-400">🟡 Moderate</p>
            <p className="text-lg font-bold text-blue-300">{metrics.distribution.moderate}</p>
          </div>
          <div className="bg-gray-500/10 border border-gray-500/30 rounded p-3">
            <p className="text-xs text-gray-400">❌ Unused</p>
            <p className="text-lg font-bold text-gray-300">{metrics.distribution.orphaned}</p>
          </div>
        </div>
      )}

      {/* Search */}
      {!compact && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <Input
            placeholder="Search components..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-neutral-900/50 border-neutral-800"
          />
        </div>
      )}

      {/* Component Grid */}
      <div className={cn(
        'grid gap-3',
        compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      )}>
        {filteredComponents.map(component => {
          const info = getUsageLevelInfo(component.usage.level);

          return (
            <div
              key={`${component.name}-${component.path}`}
              className="group bg-neutral-900/30 border border-neutral-800 hover:border-neutral-700 rounded p-3 transition-all hover:bg-neutral-900/50"
            >
              {/* Component Name & Level */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-200 truncate font-mono">
                    {component.name}
                  </p>
                  <p className="text-xs text-neutral-500 truncate font-mono">
                    {component.path}
                  </p>
                </div>
              </div>

              {/* Usage Badge & Count */}
              <div className="flex items-center justify-between gap-2">
                <Badge className={cn('text-xs', info.color)}>
                  {info.label}
                </Badge>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-neutral-500" />
                  <span className="text-sm font-bold text-neutral-300 min-w-[2rem] text-right">
                    {component.imports}
                  </span>
                </div>
              </div>

              {/* Usage Bar */}
              {!compact && (
                <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      component.usage.level === 'critical'
                        ? 'bg-red-500'
                        : component.usage.level === 'frequent'
                        ? 'bg-orange-500'
                        : component.usage.level === 'moderate'
                        ? 'bg-blue-500'
                        : component.usage.level === 'rare'
                        ? 'bg-yellow-500'
                        : 'bg-gray-500'
                    )}
                    style={{ width: `${component.usage.percentage}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* No Results */}
      {filteredComponents.length === 0 && search && (
        <div className="p-6 text-center text-neutral-400">
          <p>No components match "{search}"</p>
        </div>
      )}

      {/* Meta Info */}
      {!compact && metrics && (
        <div className="text-xs text-neutral-500 text-center pt-4">
          Generated: {new Date(metrics.generatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default ComponentLibrary;
