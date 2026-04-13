import React from 'react';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export function Header() {
  const { setActiveView, credits, activeView } = usePluginStore();

  return (
    <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-brand-cyan flex items-center justify-center text-black font-bold text-xs">
          V
        </div>
        <span className="font-semibold text-sm">Visant</span>
      </div>

      <div className="flex items-center gap-3">
        {credits && (
          <div className="text-xs text-muted-foreground">
            {credits.used}/{credits.limit} credits
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveView(activeView === 'main' ? 'settings' : 'main')}
          className="h-8 w-8"
          title="Settings"
        >
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
}
