import React, { useState } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { Button } from '@/components/ui/button';
import { Download, Copy } from 'lucide-react';

export function IllustratorExportSection() {
  const { send } = useFigmaMessages();
  const [copying, setCopying] = useState(false);

  const handleCopyCode = () => {
    send({ type: 'REQUEST_ILLUSTRATOR_CODE' } as any);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleExport = () => {
    send({ type: 'ILLUSTRATOR_EXPORT' } as any);
  };

  return (
    <div className="space-y-2 border border-border rounded p-3">
      <h3 className="text-sm font-semibold">Export to Adobe Illustrator</h3>

      <div className="space-y-2">
        <Button onClick={handleCopyCode} variant="outline" size="sm" className="w-full text-xs h-8">
          <Copy size={12} className="mr-1" />
          {copying ? 'Copied!' : 'Copy JSX Code'}
        </Button>

        <Button onClick={handleExport} className="w-full bg-brand-cyan text-black hover:bg-brand-cyan/90 text-xs h-8">
          <Download size={12} className="mr-1" />
          Export Assets
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Export your designs as SVG, PNG, and JSX for use in Adobe Illustrator or other tools.
      </p>
    </div>
  );
}
