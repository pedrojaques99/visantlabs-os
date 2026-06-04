import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Loader2,
  ImageIcon,
  Type,
  Hash,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayout } from '@/hooks/useLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import {
  SOCIAL_FORMATS,
  DEFAULT_CONTENT_FORMATS,
  type SocialFormat,
} from '@/constants/socialFormats';
import {
  startContentGeneration,
  pollContentJob,
  type ContentJob,
  type ContentAsset,
} from '@/services/contentStudioApi';
import type { ImageProvider } from '@/types/types';

export const ContentStudioPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const { requireAuth } = useAuthGuard();

  const [brief, setBrief] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>(DEFAULT_CONTENT_FORMATS);
  const [brandGuidelineId, setBrandGuidelineId] = useState<string | null>(null);
  const [model, setModel] = useState<string>(GEMINI_MODELS.IMAGE_NB2);
  const [imageProvider, setImageProvider] = useState<ImageProvider>('gemini');
  const [tone, setTone] = useState<string>('');
  const [job, setJob] = useState<ContentJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const toneOptions = [
    { value: '', label: 'Auto' },
    { value: 'professional', label: 'Professional' },
    { value: 'casual', label: 'Casual' },
    { value: 'playful', label: 'Playful' },
    { value: 'bold', label: 'Bold' },
    { value: 'minimal', label: 'Minimal' },
  ];

  const toggleFormat = useCallback((id: string) => {
    setSelectedFormats((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!requireAuth()) return;
    if (!brief.trim()) {
      toast.error('Write a campaign brief first');
      return;
    }
    if (selectedFormats.length === 0) {
      toast.error('Select at least one format');
      return;
    }

    const formats = selectedFormats
      .map((id) => SOCIAL_FORMATS.find((f) => f.id === id))
      .filter(Boolean) as SocialFormat[];

    setIsGenerating(true);
    try {
      const result = await startContentGeneration({
        brief,
        formats,
        brandGuidelineId: brandGuidelineId || undefined,
        model,
        tone: tone || undefined,
      });

      toast.success(`Generating ${result.totalCount} assets (${result.creditsCharged} credits)`);

      const initialJob = await pollContentJob(result.jobId);
      setJob(initialJob);

      pollRef.current = setInterval(async () => {
        try {
          const updated = await pollContentJob(result.jobId);
          setJob(updated);
          if (updated.status === 'done' || updated.status === 'error') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setIsGenerating(false);
            if (updated.status === 'done') {
              toast.success('All assets generated!');
            } else {
              toast.error(`Generation failed: ${updated.error}`);
            }
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsGenerating(false);
        }
      }, 3000);
    } catch (err: any) {
      toast.error(err.message);
      setIsGenerating(false);
    }
  }, [brief, selectedFormats, brandGuidelineId, model, tone, requireAuth]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCopyCaption = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleModelChange = useCallback((m: string, provider?: ImageProvider) => {
    setModel(m);
    if (provider) setImageProvider(provider);
  }, []);

  const hasResults = job && job.assets.length > 0;
  const progress = job ? Math.round((job.completedCount / job.totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-neutral-800/50">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-md hover:bg-neutral-800/50 transition-colors"
        >
          <ArrowLeft size={16} className="text-neutral-400" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand-cyan" />
          <MicroTitle as="h1" className="text-base">
            Content Studio
          </MicroTitle>
        </div>
        <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded">
          BETA
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Brief + Config */}
        <aside className="w-[380px] flex-shrink-0 border-r border-neutral-800/50 overflow-y-auto custom-scrollbar p-5 space-y-5">
          {/* Brief */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Campaign Brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe your campaign... e.g. 'Summer collection launch, vibrant colors, beach lifestyle, targeting millennials'"
              className="w-full h-28 px-3 py-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800/50 text-sm text-neutral-200 placeholder:text-neutral-600 resize-none focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Brand */}
          <BrandSelect value={brandGuidelineId} onChange={setBrandGuidelineId} />

          {/* Tone */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Tone
            </label>
            <div className="flex flex-wrap gap-1.5">
              {toneOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-[11px] font-mono border transition-all',
                    tone === opt.value
                      ? 'border-white/20 bg-white/10 text-neutral-200'
                      : 'border-neutral-800/50 bg-neutral-900/50 text-neutral-500 hover:border-neutral-700'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Image Model
            </label>
            <ModelSelector
              type="image"
              selectedModel={model}
              onModelChange={handleModelChange}
              className="w-full"
            />
          </div>

          {/* Formats */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Platforms ({selectedFormats.length}/{SOCIAL_FORMATS.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SOCIAL_FORMATS.map((fmt) => {
                const isSelected = selectedFormats.includes(fmt.id);
                return (
                  <button
                    key={fmt.id}
                    onClick={() => toggleFormat(fmt.id)}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-[11px] font-mono border transition-all',
                      isSelected
                        ? 'border-white/20 bg-white/10 text-neutral-200'
                        : 'border-neutral-800/50 bg-neutral-900/50 text-neutral-500 hover:border-neutral-700'
                    )}
                  >
                    {fmt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !brief.trim() || selectedFormats.length === 0}
            className={cn(
              'w-full py-3 rounded-lg font-mono text-sm font-bold tracking-wide transition-all',
              'flex items-center justify-center gap-2',
              isGenerating
                ? 'bg-neutral-800 text-neutral-400 cursor-wait'
                : 'bg-brand-cyan text-black hover:bg-brand-cyan/90'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating... {progress}%
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate {selectedFormats.length} Assets
              </>
            )}
          </button>
        </aside>

        {/* Main — Results Grid */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {!hasResults && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <GlassPanel padding="lg" className="max-w-md">
                <Sparkles size={32} className="text-neutral-600 mx-auto mb-4" />
                <MicroTitle as="h3" className="text-lg text-neutral-300 mb-2">
                  Content Studio
                </MicroTitle>
                <p className="text-sm text-neutral-500">
                  Write a campaign brief, select your platforms, and generate brand-consistent
                  content for all channels at once.
                </p>
              </GlassPanel>
            </div>
          )}

          {hasResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {job.assets.map((asset, index) => (
                <ContentAssetCard
                  key={asset.formatId}
                  asset={asset}
                  index={index}
                  copiedIndex={copiedIndex}
                  onCopyCaption={handleCopyCaption}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

function BrandSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { data: guidelines = [] } = useBrandGuidelines(true);

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
        Brand Guideline
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 rounded-lg bg-neutral-900/80 border border-neutral-800/50 text-sm text-neutral-300 focus:outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer"
      >
        <option value="">No brand (generic)</option>
        {guidelines.map((g: any) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ContentAssetCard({
  asset,
  index,
  copiedIndex,
  onCopyCaption,
}: {
  asset: ContentAsset;
  index: number;
  copiedIndex: number | null;
  onCopyCaption: (text: string, index: number) => void;
}) {
  const isLoading = asset.status === 'pending' || asset.status === 'generating';
  const hasError = asset.status === 'error';
  const isDone = asset.status === 'done';

  return (
    <div className="rounded-xl border border-neutral-800/50 bg-neutral-900/30 overflow-hidden">
      {/* Image area */}
      <div
        className="relative bg-neutral-900 flex items-center justify-center"
        style={{ aspectRatio: `${asset.width}/${asset.height}`, maxHeight: 360 }}
      >
        {/* Platform badge */}
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10">
          <span className="text-[10px] font-mono text-neutral-300 tracking-wide">
            {asset.label}
          </span>
        </div>

        {/* Ratio badge */}
        <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded bg-black/50 border border-white/5">
          <span className="text-[9px] font-mono text-neutral-500">{asset.ratio}</span>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-neutral-600" />
            <span className="text-[10px] font-mono text-neutral-600">
              {asset.status === 'generating' ? 'Generating...' : 'Queued'}
            </span>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <AlertCircle size={20} className="text-red-500/60" />
            <span className="text-[10px] font-mono text-red-400">{asset.error}</span>
          </div>
        )}

        {isDone && asset.imageUrl && (
          <img
            src={asset.imageUrl}
            alt={asset.label}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Copy area */}
      <div className="p-3 space-y-2 border-t border-neutral-800/30">
        {asset.caption ? (
          <>
            <div className="flex items-start gap-2">
              <Type size={10} className="text-neutral-600 mt-1 flex-shrink-0" />
              <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-4">
                {asset.caption}
              </p>
            </div>
            {asset.hashtags && asset.hashtags.length > 0 && (
              <div className="flex items-start gap-2">
                <Hash size={10} className="text-neutral-600 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  {asset.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                </p>
              </div>
            )}
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={() =>
                  onCopyCaption(
                    `${asset.caption}${asset.hashtags?.length ? '\n\n' + asset.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : ''}`,
                    index
                  )
                }
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-neutral-500 hover:text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 transition-all"
              >
                {copiedIndex === index ? <Check size={10} /> : <Copy size={10} />}
                {copiedIndex === index ? 'Copied' : 'Copy'}
              </button>
              {isDone && asset.imageUrl && (
                <a
                  href={asset.imageUrl}
                  download={`${asset.formatId}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-neutral-500 hover:text-neutral-300 border border-neutral-800/50 hover:border-neutral-700 transition-all"
                >
                  <Download size={10} />
                  Image
                </a>
              )}
            </div>
          </>
        ) : isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-32 bg-neutral-800 rounded animate-pulse" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
