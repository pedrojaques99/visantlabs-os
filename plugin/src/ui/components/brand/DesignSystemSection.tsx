import React, { useRef } from 'react';
import { useDesignSystem } from '../../hooks/useDesignSystem';
import { Button } from '@/components/ui/button';
import { Upload, Download, Trash2 } from 'lucide-react';

export function DesignSystemSection() {
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
      <h3 className="text-sm font-semibold">Design System</h3>

      <div className="space-y-2">
        {designSystem ? (
          <div className="space-y-2">
            <div className="bg-muted/50 border border-border rounded px-3 py-2">
              <p className="text-xs font-mono font-semibold">{designSystem.name || 'Imported Design System'}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Format: {designSystem.format || 'unknown'}</p>
              {designSystem.tokens && (
                <p className="text-[10px] text-muted-foreground">
                  Tokens: {Object.keys(designSystem.tokens).length}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExport} variant="outline" size="sm" className="flex-1 text-xs h-8">
                <Download size={12} className="mr-1" />
                Export
              </Button>
              <Button
                onClick={clearDesignSystem}
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8 text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={12} className="mr-1" />
                Clear
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
                  Import Design System JSON
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
              Supports W3C Design Tokens, Figma Tokens, and Visant formats.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
