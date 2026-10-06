import React from 'react';
import { Loader2, Trash2 } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Thumb } from '@/components/ui/Thumb';
import { type DuplicateReport, type LowResReport } from '@/services/referencesApi';

// ─── Admin-only duplicate calibration bar ────────────────────────────────────
export const DuplicateAdminBar: React.FC<{
  report: DuplicateReport;
  onDedupe: () => void;
  deduping: boolean;
}> = ({ report, onDedupe, deduping }) => (
  <Button
    size="sm"
    variant="ghost"
    className="h-7 text-xs text-muted-foreground hover:text-destructive"
    title={`${report.groups.length} grupo(s) de cópias idênticas. No grid, ×N marca a que fica e "dup" a que sai.${
      report.unhashed > 0 ? ` ${report.unhashed} sem hash, não comparáveis.` : ''
    }`}
    disabled={deduping}
    onClick={onDedupe}
  >
    {deduping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
    {report.redundant} duplicada(s)
  </Button>
);

/**
 * Barra de limpeza de baixa resolução — irmã da DuplicateAdminBar.
 *
 * Duas barras de propósito: a de APAGAR (300px) é mais dura que a de AVISAR no
 * lightbox (400px). Apagar exige mais certeza que alertar.
 *
 * Nunca oferece apagar o que está em coleção — se houver protegidas, a contagem
 * diz quantas ficam de fora, porque um número que some sem explicação parece bug.
 */
export const LowResAdminBar: React.FC<{
  report: LowResReport;
  onPurge: () => void;
  purging: boolean;
}> = ({ report, onPurge, purging }) => {
  const deletable = report.total - report.protected;
  return (
    <span className="inline-flex items-center gap-1">
      {report.samples.slice(0, 6).map((sample) => (
        <Thumb
          key={sample.id}
          src={sample.thumbnailUrl}
          alt=""
          title={`${sample.name || 'sem nome'} (${sample.width}×${sample.height})`}
          className="h-6 w-6 rounded border border-border object-cover"
          fallbackClassName="[&_svg]:h-3 [&_svg]:w-3"
        />
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-muted-foreground hover:text-destructive"
        title={`Menor lado abaixo de ${report.maxShortSide}px.${
          report.protected > 0 ? ` ${report.protected} em coleção ficam.` : ''
        }`}
        disabled={purging || deletable === 0}
        onClick={onPurge}
      >
        {purging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        {deletable} abaixo de {report.maxShortSide}px
      </Button>
    </span>
  );
};
