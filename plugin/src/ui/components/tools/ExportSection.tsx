import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { useClient } from '../../lib/ClientProvider';
import { OpButton } from '../common/OpButton';
import { Download, Copy, LayoutGrid, Smartphone, FileText } from 'lucide-react';

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
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

  async function handleExportTexts() {
    const result = await client.request('export.textToMarkdown', { includeHidden: false });
    downloadFile(result.markdown, result.filename);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="copyJSX"
          runner={runner}
          message={{ type: 'COPY_ILLUSTRATOR_CODE' }}
          responseTypes={['ILLUSTRATOR_CODE_READY']}
          busyLabel="Copiando…"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
        >
          <Copy size={12} className="mr-2" />
          Copy AI JSX
        </OpButton>
        <OpButton
          opId="exportAI"
          runner={runner}
          message={{ type: 'ILLUSTRATOR_EXPORT' }}
          responseTypes={['ILLUSTRATOR_CODE_READY', 'OPERATIONS_DONE']}
          busyLabel="Exportando…"
          variant="brand"
          size="sm"
          className="h-8 text-[10px]"
        >
          <Download size={12} className="mr-2" />
          Export Assets
        </OpButton>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="slices"
          runner={runner}
          message={{ type: 'SELECTION_TO_SLICES' }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="Fatiando…"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
        >
          <LayoutGrid size={12} className="mr-2 text-neutral-500" />
          Slices
        </OpButton>
        <OpButton
          opId="responsive"
          runner={runner}
          message={{ type: 'RESPONSIVE_MULTIPLY' }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="Gerando…"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
        >
          <Smartphone size={12} className="mr-2 text-neutral-500" />
          Responsive
        </OpButton>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="exportTexts"
          runner={runner}
          task={handleExportTexts}
          busyLabel="Extraindo…"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
        >
          <FileText size={12} className="mr-2 text-neutral-500" />
          Export Texts .md
        </OpButton>
      </div>

      <p className="text-[9px] text-neutral-500 italic px-1">
        * Export assets, generate responsive variations, slice for carousels, or extract all page texts as Markdown.
      </p>
    </div>
  );
}
