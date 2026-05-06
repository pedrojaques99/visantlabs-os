import React from 'react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <GlitchLoader size={12} color="var(--brand-cyan)" />
    </div>
  );
}
