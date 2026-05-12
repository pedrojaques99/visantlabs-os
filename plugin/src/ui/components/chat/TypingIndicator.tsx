import React, { useState, useEffect } from 'react';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { usePluginStore } from '../../store';

export function TypingIndicator() {
  const status = usePluginStore(s => s.generatingStatus);
  const chatHistory = usePluginStore(s => s.chatHistory);
  const [elapsed, setElapsed] = useState(0);

  const lastMsg = chatHistory[chatHistory.length - 1];
  const isMockupRunning = lastMsg?.toolCalls?.some(
    tc => tc.name === 'generate_mockup' && tc.status === 'running'
  ) ?? false;

  useEffect(() => {
    if (!isMockupRunning) { setElapsed(0); return; }
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [isMockupRunning]);

  return (
    <div className="px-3 py-2 space-y-2">
      <PremiumGlitchLoader color="var(--brand-cyan)" />
      {status && (
        <span className="text-[10px] font-mono text-muted-foreground/60 block truncate max-w-[200px]">
          {status}
        </span>
      )}
      {isMockupRunning && (
        <div className="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.03] to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <PremiumGlitchLoader color="var(--brand-cyan)" className="!text-sm" />
          </div>
          {elapsed > 0 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
              <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
