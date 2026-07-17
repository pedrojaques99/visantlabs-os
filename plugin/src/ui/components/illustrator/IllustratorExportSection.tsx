import React, { useState } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Download, Copy } from 'lucide-react';

export function IllustratorExportSection() {
  const { t } = useTranslation();
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
      <h3 className="text-sm font-semibold">{t('plugin.illustrator.title')}</h3>

      <div className="space-y-2">
        <Button onClick={handleCopyCode} variant="outline" size="sm" className="w-full text-xs h-8">
          <Copy size={12} className="mr-1" />
          {copying ? t('plugin.common.copied') : t('plugin.illustrator.copyCode')}
        </Button>

        <Button
          onClick={handleExport}
          className="w-full bg-brand-cyan text-black hover:bg-brand-cyan/90 text-xs h-8"
        >
          <Download size={12} className="mr-1" />
          {t('plugin.illustrator.exportAssets')}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {t('plugin.illustrator.description')}
      </p>
    </div>
  );
}
