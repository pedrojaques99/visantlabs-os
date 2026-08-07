import React, { useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useDesignSystem } from '../../hooks/useDesignSystem';
import { Button } from '@/components/ui/button';
import { Upload, Download, Trash2 } from 'lucide-react';

export function DesignSystemSection() {
  const { t } = useTranslation();
  const { importFromJson, clearDesignSystem, designSystem } = useDesignSystem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        importFromJson(content);
      };
      reader.readAsText(file);
    }
  };

  const handleExport = () => {
    if (designSystem) {
      const json = JSON.stringify(designSystem, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `design-system-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t('plugin.brand.designSystem.title')}</h3>

      <div className="space-y-2">
        {designSystem ? (
          <div className="space-y-2">
            <div className="bg-muted/50 border border-border rounded px-3 py-2">
              <p className="text-xs font-mono font-semibold">
                {designSystem.name || t('plugin.brand.designSystem.importedFallback')}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('plugin.brand.designSystem.format', {
                  format: designSystem.format || 'unknown',
                })}
              </p>
              {designSystem.tokens && (
                <p className="text-[10px] text-muted-foreground">
                  {t('plugin.brand.designSystem.tokens', {
                    count: Object.keys(designSystem.tokens).length,
                  })}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
              >
                <Download size={12} className="mr-1" />
                {t('plugin.brand.designSystem.export')}
              </Button>
              <Button
                onClick={clearDesignSystem}
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={12} className="mr-1" />
                {t('plugin.common.clear')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="ds-file-input" className="cursor-pointer">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8"
                asChild
                onClick={() => fileInputRef.current?.click()}
              >
                <span>
                  <Upload size={12} className="mr-1" />
                  {t('plugin.brand.designSystem.import')}
                </span>
              </Button>
            </label>
            <input
              ref={fileInputRef}
              id="ds-file-input"
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              {t('plugin.brand.designSystem.supports')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
