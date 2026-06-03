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
    </div>
  );
}
