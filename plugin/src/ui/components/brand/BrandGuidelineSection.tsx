import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../store';
import { useBrandSync } from '../../hooks/useBrandSync';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Link2, Plus, Trash2, RefreshCw } from 'lucide-react';

export function BrandGuidelineSection() {
  const { linkedGuideline, savedGuidelineIds, setBrandGuideline, showToast } = usePluginStore();
  const { loadBrandGuidelines, saveBrandGuideline } = useBrandSync();
  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBrandGuidelines().then((data) => {
      if (data) setGuidelines(data);
    });
  }, [loadBrandGuidelines]);

  const handleSelectGuideline = (id: string) => {
    // Load selected guideline
    const guideline = guidelines.find((g) => g.id === id);
    if (guideline) {
      setBrandGuideline(guideline);
      showToast('Brand guideline loaded', 'success');
    }
  };

  const handleCreateNew = async () => {
    const name = prompt('New guideline name:');
    if (name) {
      setLoading(true);
      await saveBrandGuideline({ name } as any);
      setLoading(false);
      await loadBrandGuidelines().then((data) => {
        if (data) setGuidelines(data);
      });
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Brand Guidelines</h3>

      <div className="space-y-2">
        <div className="flex gap-2">
          {guidelines.length > 0 && (
            <Select
              options={guidelines.map((g) => ({ value: g.id, label: g.name }))}
              value={linkedGuideline || ''}
              onChange={(value) => handleSelectGuideline(value as string)}
              variant="node"
              placeholder="Select a guideline..."
            />
          )}
          <Button onClick={handleCreateNew} variant="outline" size="sm" className="text-xs h-8" disabled={loading}>
            <Plus size={12} className="mr-1" />
            New
          </Button>
          <Button onClick={() => loadBrandGuidelines()} variant="ghost" size="sm" className="text-xs h-8">
            <RefreshCw size={12} />
          </Button>
        </div>

        {guidelines.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No guidelines yet. Create one to get started.</p>
        )}

        {linkedGuideline && (
          <div className="flex items-center justify-between bg-muted/50 border border-border rounded px-3 py-2 text-xs">
            <span className="text-muted-foreground">Linked to guideline</span>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Link2 size={12} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
