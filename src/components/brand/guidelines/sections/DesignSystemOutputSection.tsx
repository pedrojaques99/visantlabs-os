import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Code2, Copy, Download, Check, FileCode, Braces, Palette, Hash } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { copyToClipboard, downloadBlob } from '@/utils/clipboard';

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

export const DesignSystemOutputSection: React.FC<DesignSystemOutputSectionProps> = ({
  guideline,
  span,
}) => {
  const { t } = useTranslation();
  const [activeFormat, setActiveFormat] = useState<OutputFormat>('css');
  const [outputs, setOutputs] = useState<Record<string, { content: string; filename: string }>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchOutput = useCallback(
    async (format: OutputFormat) => {
      if (outputs[format]) {
        setActiveFormat(format);
        return;
      }
      if (!guideline.id) return;

      setLoading(true);
      try {
        const result = await brandGuidelineApi.compile(guideline.id, format);
        const output = result.outputs[0];
        setOutputs((prev) => ({
          ...prev,
          [format]: { content: output.content, filename: output.filename },
        }));
        setActiveFormat(format);
      } catch {
        toast.error(t('brandEditor.compileFailed'));
      } finally {
        setLoading(false);
      }
    },
    [guideline.id, outputs]
  );

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
      toast.error(t('brandEditor.compileFailed'));
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
    copyToClipboard(currentOutput.content);
    setCopied(true);
    toast.success(t('brandEditor.copiedClipboard'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentOutput) return;
    const blob = new Blob([currentOutput.content], { type: 'text/plain' });
    downloadBlob(blob, currentOutput.filename);
    toast.success(t('brandEditor.downloadedFile', { filename: currentOutput.filename }));
  };

  const handleDownloadAll = async () => {
    if (!guideline.id) return;
    try {
      const result = await brandGuidelineApi.compile(guideline.id, 'all');
      for (const o of result.outputs) {
        const blob = new Blob([o.content], { type: 'text/plain' });
        downloadBlob(blob, o.filename);
      }
      toast.success(t('brandEditor.allFormatsDownloaded'));
    } catch {
      toast.error(t('brandEditor.downloadFailed'));
    }
  };

  const hasTokens =
    (guideline.colors?.length || 0) +
      (guideline.typography?.length || 0) +
      (guideline.shadows?.length || 0) +
      (guideline.gradients?.length || 0) >
    0;

  return (
    <SectionBlock
      id="design-system-output"
      icon={<Code2 size={14} />}
      title={t('brandEditor.dsOutput')}
      span={span as any}
    >
      <div className="space-y-4">
        {/* Visual Token Preview */}
        {hasTokens && (
          <div className="space-y-3 pb-4 border-b border-border">
            {/* Color Palette Strip */}
            {guideline.colors && guideline.colors.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {guideline.colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className="w-8 h-8 rounded-md border border-border shadow-sm"
                      style={{ backgroundColor: c.hex }}
                      title={`${c.name}: ${c.hex}`}
                    />
                    <span className="text-2xs font-mono text-muted-foreground/70 max-w-[40px] truncate">
                      {c.role || c.name}
                    </span>
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
                      className="text-foreground leading-tight"
                      style={{
                        fontFamily: `'${t.family}', sans-serif`,
                        fontSize: Math.min(t.size || 16, 24),
                      }}
                    >
                      {t.family}
                    </span>
                    <span className="text-2xs font-mono text-muted-foreground/70">
                      {t.role}, {t.style || 'Regular'}
                    </span>
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
                    className="w-16 h-6 rounded-md border border-border"
                    style={{
                      background:
                        g.css ||
                        `linear-gradient(${g.angle}deg, ${g.stops
                          .map((s) => `${s.color} ${s.position}%`)
                          .join(', ')})`,
                    }}
                    title={g.name}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Format Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted border border-border">
          {(Object.keys(FORMAT_META) as OutputFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => fetchOutput(fmt)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-2xs font-mono transition-[color,background-color,border-color,box-shadow]',
                activeFormat === fmt
                  ? 'bg-accent text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {FORMAT_META[fmt].icon}
              {FORMAT_META[fmt].label}
            </button>
          ))}
        </div>

        {/* Code Preview */}
        <div className="relative group">
          <div className={cn('absolute top-2 right-2 z-10 flex items-center gap-1', hoverReveal)}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground bg-background/90"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              {copied ? t('brandEditor.copiedShort') : t('common.copy')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-7 px-2 text-2xs font-mono text-muted-foreground hover:text-foreground bg-background/90"
            >
              <Download size={12} />
              {currentOutput?.filename || t('common.download')}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-background overflow-hidden">
            {/* Filename bar */}
            {currentOutput && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted">
                <FileCode size={11} className="text-muted-foreground/70" />
                <span className="text-2xs font-mono text-muted-foreground">
                  {currentOutput.filename}
                </span>
              </div>
            )}

            {/* Code block */}
            <pre className="p-4 overflow-x-auto max-h-[400px] overflow-y-auto text-2xs leading-relaxed font-mono text-muted-foreground">
              {loading ? (
                <span className="text-muted-foreground/70 animate-pulse">{t('brandEditor.compiling')}</span>
              ) : currentOutput ? (
                <code>{currentOutput.content}</code>
              ) : (
                <span className="text-muted-foreground/70">
                  {t('brandEditor.noOutput')}
                </span>
              )}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-2xs font-mono text-muted-foreground/70">
            {currentOutput
              ? t('brandEditor.linesCount', { count: currentOutput.content.split('\n').length })
              : null}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadAll}
            className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-ring"
          >
            <Download size={11} />
            {t('brandEditor.downloadAll')}
          </Button>
        </div>

        {/* Token Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TokenStat label={t('brandView.colors')} count={guideline.colors?.length || 0} />
          <TokenStat label={t('brandEditor.fonts')} count={guideline.typography?.length || 0} />
          <TokenStat label={t('brandEditor.shadows')} count={guideline.shadows?.length || 0} />
          <TokenStat label={t('brandEditor.gradients')} count={guideline.gradients?.length || 0} />
        </div>
      </div>
    </SectionBlock>
  );
};

function TokenStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border">
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          count > 0 ? 'text-foreground' : 'text-muted-foreground/50'
        )}
      >
        {count}
      </span>
      <span className="text-2xs font-mono text-muted-foreground/70">{label}</span>
    </div>
  );
}
