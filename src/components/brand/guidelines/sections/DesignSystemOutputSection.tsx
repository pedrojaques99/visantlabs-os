import React, { useState, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Code2, Copy, Download, Check, FileCode, Braces, Palette, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

type OutputFormat = 'css' | 'tailwind' | 'react' | 'scss';

interface DesignSystemOutputSectionProps {
  guideline: BrandGuideline;
  span?: string;
}

const FORMAT_META: Record<OutputFormat, { label: string; icon: React.ReactNode; ext: string }> = {
  css: { label: 'CSS Variables', icon: <Palette size={12} />, ext: '.css' },
  tailwind: { label: 'Tailwind', icon: <Braces size={12} />, ext: '.ts' },
  react: { label: 'React Tokens', icon: <FileCode size={12} />, ext: '.ts' },
  scss: { label: 'SCSS', icon: <Hash size={12} />, ext: '.scss' },
};

export const DesignSystemOutputSection: React.FC<DesignSystemOutputSectionProps> = ({ guideline, span }) => {
  const [activeFormat, setActiveFormat] = useState<OutputFormat>('css');
  const [outputs, setOutputs] = useState<Record<string, { content: string; filename: string }>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchOutput = useCallback(async (format: OutputFormat) => {
    if (outputs[format]) {
      setActiveFormat(format);
      return;
    }
    if (!guideline.id) return;

    setLoading(true);
    try {
      const result = await brandGuidelineApi.compile(guideline.id, format);
      const output = result.outputs[0];
      setOutputs(prev => ({ ...prev, [format]: { content: output.content, filename: output.filename } }));
      setActiveFormat(format);
    } catch {
      toast.error('Failed to compile tokens');
    } finally {
      setLoading(false);
    }
  }, [guideline.id, outputs]);

  const fetchAll = useCallback(async () => {
    if (!guideline.id) return;
    setLoading(true);
    try {
      const result = await brandGuidelineApi.compile(guideline.id, 'all');
      const mapped: Record<string, { content: string; filename: string }> = {};
      for (const o of result.outputs) {
        mapped[o.format] = { content: o.content, filename: o.filename };
      }
      setOutputs(mapped);
      setActiveFormat('css');
    } catch {
      toast.error('Failed to compile tokens');
    } finally {
      setLoading(false);
    }
  }, [guideline.id]);

  React.useEffect(() => {
    if (guideline.id) fetchAll();
  }, [guideline.id]);

  const currentOutput = outputs[activeFormat];

  const handleCopy = () => {
    if (!currentOutput) return;
    navigator.clipboard.writeText(currentOutput.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentOutput) return;
    const blob = new Blob([currentOutput.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentOutput.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${currentOutput.filename}`);
  };

  const handleDownloadAll = async () => {
    if (!guideline.id) return;
    try {
      const result = await brandGuidelineApi.compile(guideline.id, 'all');
      for (const o of result.outputs) {
        const blob = new Blob([o.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = o.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('All formats downloaded');
    } catch {
      toast.error('Failed to download');
    }
  };

  const hasTokens = (guideline.colors?.length || 0) + (guideline.typography?.length || 0) + (guideline.shadows?.length || 0) + (guideline.gradients?.length || 0) > 0;

  return (
    <SectionBlock id="design-system-output" icon={<Code2 size={14} />} title="Design System Output" span={span as any}>
      <div className="space-y-4">
        {/* Visual Token Preview */}
        {hasTokens && (
          <div className="space-y-3 pb-4 border-b border-white/[0.04]">
            {/* Color Palette Strip */}
            {guideline.colors && guideline.colors.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {guideline.colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className="w-8 h-8 rounded-md border border-white/[0.08] shadow-sm"
                      style={{ backgroundColor: c.hex }}
                      title={`${c.name} — ${c.hex}`}
                    />
                    <span className="text-[8px] font-mono text-neutral-600 max-w-[40px] truncate">{c.role || c.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Typography Preview */}
            {guideline.typography && guideline.typography.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-4">
                {guideline.typography.slice(0, 4).map((t, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span
                      className="text-neutral-300 leading-tight"
                      style={{ fontFamily: `'${t.family}', sans-serif`, fontSize: Math.min(t.size || 16, 24) }}
                    >
                      {t.family}
                    </span>
                    <span className="text-[8px] font-mono text-neutral-600">{t.role} · {t.style || 'Regular'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gradient Preview */}
            {guideline.gradients && guideline.gradients.length > 0 && (
              <div className="flex items-center gap-1.5">
                {guideline.gradients.slice(0, 6).map((g, i) => (
                  <div
                    key={i}
                    className="w-16 h-6 rounded-md border border-white/[0.08]"
                    style={{ background: g.css || `linear-gradient(${g.angle}deg, ${g.stops.map(s => `${s.color} ${s.position}%`).join(', ')})` }}
                    title={g.name}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Format Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          {(Object.keys(FORMAT_META) as OutputFormat[]).map(fmt => (
            <button
              key={fmt}
              onClick={() => fetchOutput(fmt)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all',
                activeFormat === fmt
                  ? 'bg-white/[0.08] text-neutral-200 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              )}
            >
              {FORMAT_META[fmt].icon}
              {FORMAT_META[fmt].label}
            </button>
          ))}
        </div>

        {/* Code Preview */}
        <div className="relative group">
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-[10px] font-mono text-neutral-500 hover:text-neutral-200 bg-neutral-900/80 backdrop-blur-sm"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-7 px-2 text-[10px] font-mono text-neutral-500 hover:text-neutral-200 bg-neutral-900/80 backdrop-blur-sm"
            >
              <Download size={12} />
              {currentOutput?.filename || 'Download'}
            </Button>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-[#0d0d0f] overflow-hidden">
            {/* Filename bar */}
            {currentOutput && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-white/[0.02]">
                <FileCode size={11} className="text-neutral-600" />
                <span className="text-[10px] font-mono text-neutral-500">{currentOutput.filename}</span>
              </div>
            )}

            {/* Code block */}
            <pre className="p-4 overflow-x-auto max-h-[400px] overflow-y-auto text-[11px] leading-relaxed font-mono text-neutral-400 selection:bg-brand-cyan/20">
              {loading ? (
                <span className="text-neutral-600 animate-pulse">Compiling tokens...</span>
              ) : currentOutput ? (
                <code>{currentOutput.content}</code>
              ) : (
                <span className="text-neutral-600">No output available. Add colors, typography, or tokens to your brand.</span>
              )}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono text-neutral-600">
            {currentOutput ? `${currentOutput.content.split('\n').length} lines` : '—'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadAll}
            className="h-7 px-3 text-[10px] font-mono text-neutral-500 hover:text-brand-cyan border border-white/[0.06] hover:border-brand-cyan/30"
          >
            <Download size={11} />
            Download All Formats
          </Button>
        </div>

        {/* Token Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TokenStat label="Colors" count={guideline.colors?.length || 0} />
          <TokenStat label="Fonts" count={guideline.typography?.length || 0} />
          <TokenStat label="Shadows" count={guideline.shadows?.length || 0} />
          <TokenStat label="Gradients" count={guideline.gradients?.length || 0} />
        </div>
      </div>
    </SectionBlock>
  );
};

function TokenStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/[0.02] border border-white/[0.04]">
      <span className={cn(
        'text-sm font-medium tabular-nums',
        count > 0 ? 'text-neutral-300' : 'text-neutral-700'
      )}>
        {count}
      </span>
      <span className="text-[10px] font-mono text-neutral-600">{label}</span>
    </div>
  );
}
