import React from 'react';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { usePluginStore } from '../../store';

export function TypingIndicator() {
  const status = usePluginStore(s => s.generatingStatus);

  return (
    <div className="px-3 py-2 space-y-1">
      <PremiumGlitchLoader color="var(--brand-cyan)" />
      {status && (
        <span className="text-[10px] font-mono text-muted-foreground/60 block truncate max-w-[200px]">
          {status}
        </span>
      )}
    </div>
  );
}
