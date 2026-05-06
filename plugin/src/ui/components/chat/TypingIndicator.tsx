import React from 'react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { usePluginStore } from '../../store';

export function TypingIndicator() {
  const status = usePluginStore(s => s.generatingStatus);

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <GlitchLoader size={12} color="var(--brand-cyan)" />
      {status && (
        <span className="text-[11px] font-mono text-muted-foreground animate-pulse truncate max-w-[200px]">
          {status}
        </span>
      )}
    </div>
  );
}
