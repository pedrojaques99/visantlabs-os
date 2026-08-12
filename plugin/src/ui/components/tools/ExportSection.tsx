import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { useClient } from '../../lib/ClientProvider';
import { downloadFile } from '../../lib/download';
import { OpButton } from '../common/OpButton';
import { Download, Copy, LayoutGrid, Smartphone, FileText, Braces, Table } from 'lucide-react';

export function ExportSection() {
  const { t } = useTranslation();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });
  const client = useClient();

  const scanPage = usePluginStore((s) => s.scanPage);

  async function handleExportTexts() {
    const result = await client.request('export.textToMarkdown', { includeHidden: false });
    downloadFile(result.markdown, result.filename);
  }

  async function handleExportData(format: 'json' | 'csv') {
    // scope follows the Page-scan toggle: ON = whole page, OFF = current selection
    const result = await client.request('export.framesData', {
      format,
      scope: scanPage ? 'page' : 'selection',
    });
    downloadFile(result.content, result.filename, result.mimeType);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="exportAI"
          runner={runner}
          message={{ type: 'ILLUSTRATOR_EXPORT' }}
          responseTypes={['ILLUSTRATOR_CODE_READY', 'OPERATIONS_DONE']}
          busyLabel={t('plugin.tools.export.exporting')}
          variant="brand"
          size="sm"
          title={t('plugin.tools.export.assetsTitle')}
          className="h-8 text-[10px]"
        >
          <Download size={12} className="mr-1.5" />
          {t('plugin.tools.export.assets')}
        </OpButton>
        <OpButton
          opId="copyJSX"
          runner={runner}
          message={{ type: 'COPY_ILLUSTRATOR_CODE' }}
          responseTypes={['ILLUSTRATOR_CODE_READY']}
          busyLabel={t('plugin.tools.export.copying')}
          variant="outline"
          size="sm"
          title={t('plugin.tools.export.copyJsxTitle')}
          className="h-8 text-[10px]"
        >
          <Copy size={12} className="mr-1.5" />
          {t('plugin.tools.export.copyJsx')}
        </OpButton>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <OpButton
          opId="slices"
          runner={runner}
          message={{ type: 'SELECTION_TO_SLICES' }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.export.slicesTitle')}
          className="h-8 text-[10px]"
        >
          <LayoutGrid size={11} className="mr-1.5 text-muted-foreground" />
          {t('plugin.tools.export.slices')}
        </OpButton>
        <OpButton
          opId="responsive"
          runner={runner}
          message={{ type: 'RESPONSIVE_MULTIPLY' }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.export.responsiveTitle')}
          className="h-8 text-[10px]"
        >
          <Smartphone size={11} className="mr-1.5 text-muted-foreground" />
          {t('plugin.tools.export.responsive')}
        </OpButton>
        <OpButton
          opId="exportTexts"
          runner={runner}
          task={handleExportTexts}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.export.textsTitle')}
          className="h-8 text-[10px]"
        >
          <FileText size={11} className="mr-1.5 text-muted-foreground" />
          {t('plugin.tools.export.texts')}
        </OpButton>
      </div>

      {/* Structured data export — deterministic, no AI. Scope follows Page-scan toggle. */}
      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="exportJson"
          runner={runner}
          task={() => handleExportData('json')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.export.dataJsonTitle', {
            scope: scanPage
              ? t('plugin.tools.export.scopeWholePage')
              : t('plugin.tools.export.scopeSelection'),
          })}
          className="h-8 text-[10px]"
        >
          <Braces size={11} className="mr-1.5 text-muted-foreground" />
          {t('plugin.tools.export.dataJson')}
        </OpButton>
        <OpButton
          opId="exportCsv"
          runner={runner}
          task={() => handleExportData('csv')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.export.dataCsvTitle', {
            scope: scanPage
              ? t('plugin.tools.export.scopeWholePage')
              : t('plugin.tools.export.scopeSelection'),
          })}
          className="h-8 text-[10px]"
        >
          <Table size={11} className="mr-1.5 text-muted-foreground" />
          {t('plugin.tools.export.dataCsv')}
        </OpButton>
      </div>
    </div>
  );
}
