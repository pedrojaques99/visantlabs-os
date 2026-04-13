import React, { useState } from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Zap, Wand2, Grid3X3, Smartphone } from 'lucide-react';

/**
 * Brand Operations - All the brand intelligence and design operations
 * Sends messages to sandbox which triggers vanilla logic
 */
export function BrandOperationsSection() {
  const { send } = useFigmaMessages();
  const store = usePluginStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleSmartScan = () => {
    setIsLoading(true);
    send({ type: 'SMART_SCAN_SELECTION' } as any);
    // Handler will update state when SMART_SCAN_RESULT comes back
  };

  const handleVaryColors = () => {
    send({
      type: 'VARY_SELECTION_COLORS',
      brandColors: store.selectedColors ? Array.from(store.selectedColors.values()).map(c => c.hex) : undefined
    } as any);
  };

  const handleBrandLint = () => {
    send({
      type: 'BRAND_LINT',
      brand: store.brandGuideline
    } as any);
  };

  const handleFixBrandIssues = () => {
    send({
      type: 'BRAND_LINT_FIX',
      brand: store.brandGuideline
    } as any);
  };

  const handleSelectionToSlices = () => {
    send({ type: 'SELECTION_TO_SLICES' } as any);
  };

  const handleResponsiveMultiply = () => {
    send({
      type: 'RESPONSIVE_MULTIPLY',
      formats: [
        { id: 'mobile', label: 'Mobile', width: 375, height: 667 },
        { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { id: 'desktop', label: 'Desktop', width: 1920, height: 1080 }
      ]
    } as any);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wand2 size={14} />
          Smart Operations
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleSmartScan}
            disabled={isLoading}
            className="text-xs h-8 bg-brand-cyan text-black hover:bg-brand-cyan/90"
          >
            <Zap size={12} className="mr-1" />
            Smart Scan
          </Button>

          <Button
            onClick={handleVaryColors}
            variant="outline"
            className="text-xs h-8"
          >
            <Wand2 size={12} className="mr-1" />
            Vary Colors
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap size={14} />
          Brand Linting
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleBrandLint}
            variant="outline"
            size="sm"
            className="text-xs h-8"
          >
            Lint
          </Button>

          <Button
            onClick={handleFixBrandIssues}
            variant="outline"
            size="sm"
            className="text-xs h-8"
          >
            Fix Issues
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Grid3X3 size={14} />
          Layout Tools
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleSelectionToSlices}
            variant="outline"
            className="text-xs h-8"
          >
            → Slices
          </Button>

          <Button
            onClick={handleResponsiveMultiply}
            variant="outline"
            className="text-xs h-8 flex items-center gap-1"
          >
            <Smartphone size={12} />
            Responsive
          </Button>
        </div>
      </div>
    </div>
  );
}
