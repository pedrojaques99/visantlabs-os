import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Trophy,
  Play,
  Clock,
  Eye,
  Check,
  Loader2,
  Crown,
  Zap,
  AlertCircle,
  CreditCard,
  Timer,
  Sparkles,
} from 'lucide-react';
import { PageShell } from '../components/ui/PageShell';
import { GlassPanel } from '../components/ui/GlassPanel';
import { MicroTitle } from '../components/ui/MicroTitle';
import { PremiumButton } from '../components/ui/PremiumButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { authService } from '../services/authService';
import {
  benchmarkApi,
  type BenchmarkModel,
  type BenchmarkItem,
  type BenchmarkTier,
  type GalleryItem,
  type SSEResultEvent,
} from '../services/benchmarkApi';
import { motion, AnimatePresence } from 'framer-motion';

const TIER_CONFIG: Record<BenchmarkTier, { label: string; color: string; description: string }> = {
  flagship: {
    label: 'Flagship',
    color: 'text-yellow-400 border-yellow-400/20',
    description: 'Best quality per provider',
  },
  balanced: {
    label: 'Balanced',
    color: 'text-blue-400 border-blue-400/20',
    description: 'Quality/cost sweet spot',
  },
  fast: {
    label: 'Fast',
    color: 'text-emerald-400 border-emerald-400/20',
    description: 'Speed optimized',
  },
  legacy: {
    label: 'Legacy',
    color: 'text-white/30 border-white/10',
    description: 'Previous generation',
  },
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-500/10 text-green-400',
  gemini: 'bg-blue-500/10 text-blue-400',
  imagen: 'bg-purple-500/10 text-purple-400',
  seedream: 'bg-orange-500/10 text-orange-400',
  ideogram: 'bg-pink-500/10 text-pink-400',
  reve: 'bg-cyan-500/10 text-cyan-400',
};

// ─── Run Tab ─────────────────────────────────────────────────────────────────

interface StreamingResult extends SSEResultEvent {
  isNew?: boolean;
  votes?: number;
}

const RunBenchmark: React.FC = () => {
  const [models, setModels] = useState<BenchmarkModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [maxModels, setMaxModels] = useState(6);
  const [loading, setLoading] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingResults, setStreamingResults] = useState<StreamingResult[]>([]);
  const [generatingModels, setGeneratingModels] = useState<Set<string>>(new Set());
  const [benchmarkId, setBenchmarkId] = useState<string | null>(null);
  const [streamComplete, setStreamComplete] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [totalCharged, setTotalCharged] = useState(0);
  const [creditsRefunded, setCreditsRefunded] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    benchmarkApi
      .getAvailableModels()
      .then(({ models: m, maxPerBenchmark }) => {
        setModels(m);
        setMaxModels(maxPerBenchmark);
      })
      .catch(() => toast.error('Failed to load models'));
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const toggleModel = useCallback(
    (modelId: string) => {
      const model = models.find((m) => m.id === modelId);
      if (model && !model.available) {
        toast.error(`${model.label} — API key not configured`);
        return;
      }
      setSelectedModels((prev) => {
        const next = new Set(prev);
        if (next.has(modelId)) {
          next.delete(modelId);
        } else if (next.size < maxModels) {
          next.add(modelId);
        } else {
          toast.error(`Maximum ${maxModels} models per benchmark`);
        }
        return next;
      });
    },
    [maxModels, models]
  );

  const totalCredits = Array.from(selectedModels).reduce((sum, modelId) => {
    const model = models.find((m) => m.id === modelId);
    return sum + (model?.creditsCost1K || 2);
  }, 0);

  const selectTier = useCallback(
    (tier: BenchmarkTier) => {
      const tierModels = models.filter((m) => m.tier === tier && m.available);
      if (tierModels.length < 2) {
        toast.error(`Not enough available models in ${TIER_CONFIG[tier].label} tier`);
        return;
      }
      setSelectedModels(new Set(tierModels.slice(0, maxModels).map((m) => m.id)));
    },
    [models, maxModels]
  );

  const startBenchmark = async () => {
    if (!authService.getToken()) {
      toast.error('Login required');
      return;
    }
    if (selectedModels.size < 2) {
      toast.error('Select at least 2 models');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Enter a prompt');
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamingResults([]);
    setGeneratingModels(new Set());
    setStreamComplete(false);
    setHasVoted(false);
    setCreditsRefunded(0);

    abortRef.current = benchmarkApi.runStream(
      {
        prompt: prompt.trim(),
        models: Array.from(selectedModels),
        resolution,
        aspectRatio,
      },
      {
        onStart: (data) => {
          setBenchmarkId(data.benchmarkId);
          setTotalCharged(data.totalCreditsCharged);
          setLoading(false);
        },
        onGenerating: (data) => {
          setGeneratingModels((prev) => new Set([...prev, data.model]));
        },
        onResult: (data) => {
          setGeneratingModels((prev) => {
            const n = new Set(prev);
            n.delete(data.model);
            return n;
          });
          setStreamingResults((prev) => [...prev, { ...data, isNew: true }]);
          setTimeout(() => {
            setStreamingResults((prev) =>
              prev.map((r) => (r.model === data.model ? { ...r, isNew: false } : r))
            );
          }, 600);
        },
        onError: (data) => {
          setGeneratingModels((prev) => {
            const n = new Set(prev);
            n.delete(data.model);
            return n;
          });
          setStreamingResults((prev) => [
            ...prev,
            {
              ...data,
              provider: data.provider || 'unknown',
              imageUrl: undefined,
              durationMs: data.durationMs || 0,
              creditsCost: data.creditsCost || 0,
              votes: 0,
            } as StreamingResult,
          ]);
        },
        onComplete: (data) => {
          setStreamComplete(true);
          setIsStreaming(false);
          setCreditsRefunded(data.creditsRefunded);
          if (data.creditsRefunded > 0) {
            toast.info(`${data.creditsRefunded} credits refunded for failed models`);
          }
        },
        onFail: (error) => {
          toast.error(error);
          setLoading(false);
          setIsStreaming(false);
        },
      }
    );
  };

  const handleVote = async (winnerModel: string) => {
    if (!benchmarkId) return;
    try {
      const result = await benchmarkApi.vote(benchmarkId, winnerModel);
      toast.success(result.message);
      setStreamingResults((prev) =>
        prev.map((r) => ({
          ...r,
          votes: r.model === winnerModel ? 1 : 0,
        }))
      );
      setHasVoted(true);
      setCreditsRefunded((prev) => prev + result.creditsRefunded);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const modelsByTier = models.reduce<Record<BenchmarkTier, BenchmarkModel[]>>((acc, m) => {
    (acc[m.tier] = acc[m.tier] || []).push(m);
    return acc;
  }, {} as Record<BenchmarkTier, BenchmarkModel[]>);

  const tierOrder: BenchmarkTier[] = ['flagship', 'balanced', 'fast', 'legacy'];

  return (
    <div className="space-y-6">
      {/* Prompt */}
      <GlassPanel className="p-5">
        <MicroTitle className="mb-3">Prompt</MicroTitle>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to compare across models..."
          className="w-full bg-transparent border border-white/10 rounded-lg p-3 text-sm text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20 min-h-[80px]"
          rows={3}
          disabled={isStreaming}
        />
      </GlassPanel>

      {/* Tier Quick Select */}
      <div className="flex gap-2 flex-wrap">
        {tierOrder.map((tier) => {
          const cfg = TIER_CONFIG[tier];
          const count = modelsByTier[tier]?.filter((m) => m.available).length || 0;
          if (count < 2) return null;
          return (
            <button
              key={tier}
              onClick={() => selectTier(tier)}
              disabled={isStreaming}
              className={cn(
                'px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-wider transition-all',
                cfg.color,
                'hover:bg-white/[0.04] disabled:opacity-40'
              )}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Model Selection by Tier */}
      <GlassPanel className="p-5">
        <div className="flex items-center justify-between mb-4">
          <MicroTitle>
            Models ({selectedModels.size}/{maxModels})
          </MicroTitle>
          <Badge variant="outline" className="text-[10px]">
            {totalCredits} credits total
          </Badge>
        </div>

        <div className="space-y-5">
          {tierOrder.map((tier) => {
            const tierModels = modelsByTier[tier];
            if (!tierModels?.length) return null;
            const cfg = TIER_CONFIG[tier];
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'text-[10px] font-mono uppercase tracking-wider',
                      cfg.color.split(' ')[0]
                    )}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-[9px] text-white/20">{cfg.description}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {tierModels.map((model) => {
                    const isSelected = selectedModels.has(model.id);
                    return (
                      <button
                        key={model.id}
                        onClick={() => toggleModel(model.id)}
                        disabled={isStreaming || (!model.available && !isSelected)}
                        className={cn(
                          'relative flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                          !model.available && 'opacity-30 cursor-not-allowed',
                          isSelected
                            ? 'border-white/30 bg-white/[0.06]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15',
                          isStreaming && 'pointer-events-none'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-white/80 leading-tight">
                            {model.label}
                          </span>
                          <span
                            className={cn(
                              'text-[8px] px-1.5 py-0.5 rounded-full',
                              PROVIDER_COLORS[model.provider] || 'bg-white/5 text-white/40'
                            )}
                          >
                            {model.provider}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/30 line-clamp-1">
                          {model.description}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-white/20">{model.creditsCost1K} cr</span>
                          {!model.available && (
                            <span className="text-[9px] text-red-400/50">no key</span>
                          )}
                          <span className="text-[9px] text-white/15">{model.released}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* Settings Row */}
      {!isStreaming && !streamingResults.length && (
        <div className="flex gap-3">
          <GlassPanel className="flex-1 p-4">
            <MicroTitle className="mb-2">Resolution</MicroTitle>
            <div className="flex gap-2">
              {['1K', '2K'].map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={cn(
                    'px-3 py-1.5 rounded text-xs font-mono transition-all',
                    resolution === r
                      ? 'bg-white/10 text-white'
                      : 'bg-white/[0.03] text-white/40 hover:text-white/60'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </GlassPanel>
          <GlassPanel className="flex-1 p-4">
            <MicroTitle className="mb-2">Aspect Ratio</MicroTitle>
            <div className="flex gap-2">
              {['1:1', '16:9', '9:16', '4:5'].map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  className={cn(
                    'px-3 py-1.5 rounded text-xs font-mono transition-all',
                    aspectRatio === ar
                      ? 'bg-white/10 text-white'
                      : 'bg-white/[0.03] text-white/40 hover:text-white/60'
                  )}
                >
                  {ar}
                </button>
              ))}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Run Button */}
      {!isStreaming && !streamingResults.length && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Vote after to get 50% credits back</span>
          </div>
          <PremiumButton
            onClick={startBenchmark}
            disabled={loading || selectedModels.size < 2 || !prompt.trim()}
            className="min-w-[180px]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Benchmark ({totalCredits} cr)
          </PremiumButton>
        </div>
      )}

      {/* ── Streaming Results Grid ─────────────────────────────────── */}
      {(isStreaming || streamingResults.length > 0) && (
        <div className="space-y-4">
          {/* Progress bar */}
          {isStreaming && (
            <GlassPanel className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs text-white/60">
                    Generating {streamingResults.length}/{selectedModels.size}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/30">
                  <Timer className="w-3 h-3" />
                  {Array.from(generatingModels).map((m) => {
                    const meta = models.find((mm) => mm.id === m);
                    return (
                      <span key={m} className="flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        {meta?.label || m}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="w-full bg-white/[0.05] rounded-full h-1">
                <motion.div
                  className="bg-cyan-400 h-1 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(streamingResults.length / selectedModels.size) * 100}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </GlassPanel>
          )}

          {/* Results grid */}
          <div
            className={cn(
              'grid gap-4',
              streamingResults.length <= 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : streamingResults.length <= 4
                ? 'grid-cols-2'
                : 'grid-cols-2 lg:grid-cols-3'
            )}
          >
            <AnimatePresence mode="popLayout">
              {streamingResults.map((result) => {
                const isWinner = result.votes > 0;
                const hasImage = result.imageUrl && !result.error;
                return (
                  <motion.div
                    key={result.model}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <GlassPanel
                      className={cn(
                        'overflow-hidden transition-all',
                        isWinner && 'ring-1 ring-yellow-400/30',
                        result.isNew && 'ring-1 ring-cyan-400/40'
                      )}
                    >
                      {hasImage ? (
                        <motion.div
                          className="relative aspect-square bg-black/20"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                        >
                          <img
                            src={result.imageUrl}
                            alt={`${result.label} result`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isWinner && (
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-yellow-400/90 text-black text-[10px] gap-1">
                                <Crown className="w-3 h-3" /> Winner
                              </Badge>
                            </div>
                          )}
                        </motion.div>
                      ) : result.error ? (
                        <div
                          className={cn(
                            'aspect-square flex items-center justify-center',
                            result.generationSucceeded
                              ? 'bg-yellow-500/[0.03]'
                              : 'bg-red-500/[0.03]'
                          )}
                        >
                          <div className="text-center px-4">
                            <AlertCircle
                              className={cn(
                                'w-6 h-6 mx-auto mb-2',
                                result.generationSucceeded
                                  ? 'text-yellow-400/40'
                                  : 'text-red-400/40'
                              )}
                            />
                            <p
                              className={cn(
                                'text-[10px] line-clamp-3',
                                result.generationSucceeded
                                  ? 'text-yellow-400/60'
                                  : 'text-red-400/60'
                              )}
                            >
                              {result.error}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white/80">{result.label}</span>
                          <span
                            className={cn(
                              'text-[8px] px-1.5 py-0.5 rounded-full',
                              PROVIDER_COLORS[result.provider] || 'bg-white/5 text-white/40'
                            )}
                          >
                            {result.provider}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : '—'}
                          </span>
                          <span className="text-[10px] text-white/30">{result.creditsCost} cr</span>
                        </div>

                        {streamComplete && !hasVoted && hasImage && !isWinner && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVote(result.model)}
                            className="w-full mt-3 text-xs h-8"
                          >
                            <Trophy className="w-3.5 h-3.5 mr-1.5" /> Vote Winner
                          </Button>
                        )}
                      </div>
                    </GlassPanel>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Vote CTA */}
          {streamComplete && !hasVoted && (
            <div className="text-center text-[10px] text-white/30">
              <Zap className="w-3.5 h-3.5 inline mr-1" />
              Vote for the best result to get 50% of your credits back (
              {Math.floor(totalCharged / 2)} cr)
            </div>
          )}

          {/* Credits summary */}
          {creditsRefunded > 0 && (
            <div className="text-center">
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-400/20 text-[10px]"
              >
                {creditsRefunded} credits refunded
              </Badge>
            </div>
          )}

          {/* New benchmark button */}
          {streamComplete && (
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStreamingResults([]);
                  setStreamComplete(false);
                  setHasVoted(false);
                  setBenchmarkId(null);
                  setIsStreaming(false);
                }}
                className="text-xs"
              >
                New Benchmark
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Gallery Tab ─────────────────────────────────────────────────────────────

const BenchmarkGallery: React.FC = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkItem | null>(null);
  const [modelLabels, setModelLabels] = useState<Map<string, string>>(new Map());

  const loadGallery = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await benchmarkApi.gallery(p);
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch {
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGallery(page);
  }, [page, loadGallery]);

  useEffect(() => {
    benchmarkApi
      .getAvailableModels()
      .then(({ models }) => {
        setModelLabels(new Map(models.map((m) => [m.id, m.label])));
      })
      .catch(() => {});
  }, []);

  const openBenchmark = async (id: string) => {
    setLoadingBenchmark(true);
    try {
      const full = await benchmarkApi.get(id);
      setSelectedBenchmark(full);
    } catch {
      toast.error('Failed to load benchmark');
    } finally {
      setLoadingBenchmark(false);
    }
  };

  if (selectedBenchmark) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedBenchmark(null)}
          className="text-xs text-white/40"
        >
          &larr; Back to Gallery
        </Button>
        <ViewBenchmark benchmark={selectedBenchmark} modelLabels={modelLabels} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <GlassPanel className="p-10 text-center">
        <Trophy className="w-8 h-8 mx-auto mb-3 text-white/20" />
        <p className="text-sm text-white/40">No benchmarks yet. Run the first one!</p>
      </GlassPanel>
    );
  }

  if (loadingBenchmark) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
          >
            <GlassPanel
              className="overflow-hidden cursor-pointer hover:border-white/15 transition-all"
              onClick={() => openBenchmark(item.id)}
            >
              <div className="grid grid-cols-2 gap-0.5 aspect-square bg-black/20">
                {item.thumbnails.slice(0, 4).map((t, i) => (
                  <div key={i} className="relative overflow-hidden">
                    <img
                      src={t.imageUrl}
                      alt={t.model}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {item.winnerModel === t.model && (
                      <div className="absolute top-1 left-1">
                        <Crown className="w-3 h-3 text-yellow-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-3">
                <p className="text-xs text-white/70 line-clamp-1 mb-1">{item.prompt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/30">{item.models.length} models</span>
                    {item.voted && (
                      <Badge
                        variant="outline"
                        className="text-[9px] text-emerald-400/60 border-emerald-400/20"
                      >
                        voted
                      </Badge>
                    )}
                  </div>
                  <span className="flex items-center gap-0.5 text-[10px] text-white/20">
                    <Eye className="w-3 h-3" /> {item.viewCount}
                  </span>
                </div>
                {item.user && (
                  <p className="text-[10px] text-white/20 mt-1">
                    by {item.user.name || 'anonymous'}
                  </p>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs"
          >
            Previous
          </Button>
          <span className="text-xs text-white/40">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── View Benchmark (read-only, from gallery) ────────────────────────────────

const ViewBenchmark: React.FC<{ benchmark: BenchmarkItem; modelLabels?: Map<string, string> }> = ({
  benchmark,
  modelLabels,
}) => {
  const successResults = benchmark.results.filter((r) => r.imageUrl && !r.error);
  const getLabel = (modelId: string) => modelLabels?.get(modelId) || modelId;

  return (
    <div className="space-y-6">
      <GlassPanel className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <MicroTitle className="mb-1">Benchmark Results</MicroTitle>
            <p className="text-sm text-white/60 max-w-lg line-clamp-2">{benchmark.prompt}</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/40">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" /> {benchmark.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> {benchmark.totalCreditsCharged} cr
            </span>
            {benchmark.creditsRefunded > 0 && (
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-400/20 text-[10px]"
              >
                -{benchmark.creditsRefunded} refunded
              </Badge>
            )}
          </div>
        </div>
      </GlassPanel>

      <div
        className={cn(
          'grid gap-4',
          successResults.length <= 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : successResults.length <= 4
            ? 'grid-cols-2'
            : 'grid-cols-2 lg:grid-cols-3'
        )}
      >
        {successResults.map((result) => {
          const isWinner = benchmark.winnerModel === result.model;
          return (
            <GlassPanel
              key={result.model}
              className={cn('overflow-hidden', isWinner && 'ring-1 ring-yellow-400/30')}
            >
              <div className="relative aspect-square bg-black/20">
                <img
                  src={result.imageUrl}
                  alt={result.model}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isWinner && (
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-yellow-400/90 text-black text-[10px] gap-1">
                      <Crown className="w-3 h-3" /> Winner
                    </Badge>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white/80">
                    {getLabel(result.model)}
                  </span>
                  <span
                    className={cn(
                      'text-[8px] px-1.5 py-0.5 rounded-full',
                      PROVIDER_COLORS[result.provider] || 'bg-white/5 text-white/40'
                    )}
                  >
                    {result.provider}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{' '}
                    {result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : '—'}
                  </span>
                  <span className="text-[10px] text-white/30">{result.creditsCost} cr</span>
                </div>
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const BenchmarkArenaPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'run';

  return (
    <PageShell
      pageId="benchmark-arena"
      seoTitle="Benchmark Arena — Visant Labs"
      seoDescription="Compare AI image models side-by-side. Test prompts across Gemini, OpenAI, Seedream, Imagen, Ideogram, and REVE."
      title="Benchmark Arena"
      microTitle="Labs // Arena"
      description="Compare AI image models side-by-side. Vote for the best and get 50% credits back."
      breadcrumb={[{ label: 'Labs', to: '/labs' }, { label: 'Benchmark Arena' }]}
    >
      <div className="max-w-4xl mx-auto pb-20">
        <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="run" className="gap-1.5">
              <Play className="w-3.5 h-3.5" /> Run
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Gallery
            </TabsTrigger>
          </TabsList>
          <TabsContent value="run">
            <RunBenchmark />
          </TabsContent>
          <TabsContent value="gallery">
            <BenchmarkGallery />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
};

export default BenchmarkArenaPage;
