import React, { useRef, useCallback } from 'react';
import { usePluginStore } from '../../store';
import { useServerStatus } from '../../hooks/useServerStatus';
import { Button } from '@/components/ui/button';
import { Settings, Pickaxe, User as UserIcon } from 'lucide-react';

export function Header() {
  const { setActiveView, credits, activeView, userInfo, toggleDevMode, devMode } = usePluginStore();
  const { isConnected } = useServerStatus();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleClick = useCallback(() => {
    clickCount.current++;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 5) {
      clickCount.current = 0;
      toggleDevMode();
    } else {
      clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 800);
    }
  }, [toggleDevMode]);

  return (
    <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
      <span
        className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground select-none cursor-default"
        onClick={handleTitleClick}
      >
        Visant Copilot{devMode ? ' ⚡' : ''}
      </span>

      <div className="flex items-center gap-3">
        {/* Server Status Indicator */}
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: isConnected === true ? '#00ff00' : isConnected === false ? '#ff4444' : '#888888',
            transition: 'background-color 0.3s'
          }}
          title={isConnected === true ? 'Server connected' : isConnected === false ? 'Server disconnected' : 'Checking...'}
        />

        {credits && (
          <Button variant="ghost" className="flex items-center gap-1.5 h-7 px-2 rounded-[6px] text-[10px] text-brand-cyan font-mono bg-neutral-900/50 border border-brand-cyan/20 hover:bg-neutral-800 hover:border-brand-cyan/40 transition-all cursor-default shadow-sm">
            <Pickaxe size={12} className="text-brand-cyan" />
            <span>{Math.max(0, credits.limit - credits.used)}</span>
          </Button>
        )}

        {userInfo?.photoUrl ? (
          <img src={userInfo.photoUrl} alt={userInfo.name} className="w-7 h-7 rounded-md object-cover" />
        ) : userInfo ? (
          <div className="w-7 h-7 rounded-md bg-neutral-800 flex items-center justify-center border border-border">
            <UserIcon size={14} className="text-neutral-400" />
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveView(activeView === 'main' ? 'settings' : 'main')}
          className="h-7 w-7 bg-neutral-900/50 hover:bg-neutral-800"
          title="Settings"
        >
          <Settings size={14} className="text-neutral-400" />
        </Button>
      </div>
    </header>
  );
}
