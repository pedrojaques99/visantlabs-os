import React from 'react';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Type } from 'lucide-react';

export function BrandTypographySection() {
  const { typography, updateTypography } = usePluginStore();

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Brand Typography</h3>
      <div className="space-y-3">
        {typography.map((typo) => (
          <div key={typo.name} className="border border-border rounded p-3 space-y-2">
            <label className="text-xs font-mono uppercase text-muted-foreground">{typo.name}</label>
            <Input
              placeholder="Font family (e.g., Inter, Roboto)"
              value={typo.fontFamily || ''}
              onChange={(e) => updateTypography(typo.name, { fontFamily: e.target.value })}
              className="text-xs h-8"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Size"
                value={typo.fontSize || ''}
                onChange={(e) => updateTypography(typo.name, { fontSize: parseInt(e.target.value) || undefined })}
                className="text-xs h-8 flex-1"
              />
              <Input
                type="number"
                placeholder="Weight"
                value={typo.fontWeight || ''}
                onChange={(e) => updateTypography(typo.name, { fontWeight: parseInt(e.target.value) || undefined })}
                className="text-xs h-8 flex-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
