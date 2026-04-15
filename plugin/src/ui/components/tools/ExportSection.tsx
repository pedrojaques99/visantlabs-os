import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Download, Copy, LayoutGrid, Smartphone, FileJson } from 'lucide-react';

export function ExportSection() {
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

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

      <p className="text-[9px] text-neutral-500 italic px-1">
        * Export assets for Illustrator, generate responsive variations, or slice selection for carousels.
      </p>
    </div>
  );
}
