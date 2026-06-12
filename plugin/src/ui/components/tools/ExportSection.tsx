import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { useClient } from '../../lib/ClientProvider';
import { OpButton } from '../common/OpButton';
import { Download, Copy, LayoutGrid, Smartphone, FileText, Braces, Table } from 'lucide-react';

function downloadFile(content: string, filename: string, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportSection() {
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
          busyLabel="Exporting…"
          variant="brand"
          size="sm"
          title="Export selected layers as production-ready assets"
          className="h-8 text-[10px]"
        >
          <Download size={12} className="mr-1.5" />
          Assets
        </OpButton>
        <OpButton
          opId="copyJSX"
          runner={runner}
          message={{ type: 'COPY_ILLUSTRATOR_CODE' }}
          responseTypes={['ILLUSTRATOR_CODE_READY']}
          busyLabel="Copying…"
          variant="outline"
          size="sm"
          title="Copy selection as JSX code to clipboard"
          className="h-8 text-[10px]"
        >
          <Copy size={12} className="mr-1.5" />
          Copy JSX
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
          title="Split selection into numbered slices for carousel posts"
          className="h-8 text-[10px]"
        >
          <LayoutGrid size={11} className="mr-1.5 text-neutral-500" />
          Slices
        </OpButton>
        <OpButton
          opId="responsive"
          runner={runner}
          message={{ type: 'RESPONSIVE_MULTIPLY' }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="…"
          variant="outline"
          size="sm"
          title="Duplicate selection into multiple screen sizes"
          className="h-8 text-[10px]"
        >
          <Smartphone size={11} className="mr-1.5 text-neutral-500" />
          Responsive
        </OpButton>
        <OpButton
          opId="exportTexts"
          runner={runner}
          task={handleExportTexts}
          busyLabel="…"
          variant="outline"
          size="sm"
          title="Extract all text layers from the page as Markdown"
          className="h-8 text-[10px]"
        >
          <FileText size={11} className="mr-1.5 text-neutral-500" />
          Texts
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
          title={`Export frame data as JSON (${scanPage ? 'whole page' : 'selection'})`}
          className="h-8 text-[10px]"
        >
          <Braces size={11} className="mr-1.5 text-neutral-500" />
          Data JSON
        </OpButton>
        <OpButton
          opId="exportCsv"
          runner={runner}
          task={() => handleExportData('csv')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={`Export frame data as CSV (${scanPage ? 'whole page' : 'selection'})`}
          className="h-8 text-[10px]"
        >
          <Table size={11} className="mr-1.5 text-neutral-500" />
          Data CSV
        </OpButton>
      </div>
    </div>
  );
}
