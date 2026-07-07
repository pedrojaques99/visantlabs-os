import React, { useRef, useCallback } from 'react';
import { usePluginStore } from '../../store';
import { useServerStatus } from '../../hooks/useServerStatus';
import { Button } from '@/components/ui/button';
import { Settings, Pickaxe, User as UserIcon, History, Minimize2 } from 'lucide-react';

export function Header() {
  const {
    setActiveView,
    credits,
    activeView,
    userInfo,
    authEmail,
    toggleDevMode,
    devMode,
    setCollapsed,
  } = usePluginStore();
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
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 800);
    }
  }, [toggleDevMode]);

  const collapse = useCallback(() => {
    setCollapsed(true);
    parent.postMessage({ pluginMessage: { type: 'COLLAPSE_WINDOW' } }, '*');
  }, [setCollapsed]);

  return (
    <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
      {/* Left: status/info. Title is dropped (Figma's window title bar already shows it). */}
      <div className="flex items-center gap-2 min-h-[28px]">
        {/* Only surface the status dot when the server is DOWN — silent when healthy. */}
        {isConnected === false && (
          <div
            className="w-2 h-2 rounded-full shrink-0"
            role="status"
            aria-label="Servidor desconectado"
            style={{ backgroundColor: '#ff4444' }}
            title="Servidor desconectado"
          />
        )}

        {credits && (
          <Button
            variant="ghost"
            onClick={handleTitleClick}
            className="flex items-center gap-1.5 h-7 px-2 rounded-[6px] text-[10px] text-brand-cyan font-mono bg-neutral-900/50 border border-brand-cyan/20 hover:bg-neutral-800 hover:border-brand-cyan/40 transition-all cursor-default shadow-sm"
            title="Créditos disponíveis"
          >
            <Pickaxe size={12} className="text-brand-cyan" />
            <span>{Math.max(0, credits.limit - credits.used)}</span>
            {devMode && <span className="ml-0.5">⚡</span>}
          </Button>
        )}
      </div>

      {/* Right: actions — views grouped, window control (collapse) last. */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveView(activeView === 'sessions' ? 'main' : 'sessions')}
          className="h-7 w-7 bg-neutral-900/50 hover:bg-neutral-800"
          title="Sessões"
          aria-label={activeView === 'sessions' ? 'Fechar sessões' : 'Ver sessões'}
        >
          <History size={14} className="text-neutral-400" />
        </Button>

        <button
          onClick={() => setActiveView(activeView === 'profile' ? 'main' : 'profile')}
          className="w-7 h-7 rounded-md overflow-hidden border border-border hover:border-brand-cyan/40 transition-colors focus:outline-none flex-shrink-0"
          title={userInfo?.name ?? authEmail ?? 'Profile'}
          aria-label="Open profile"
        >
          {userInfo?.photoUrl ? (
            <img
              src={userInfo.photoUrl}
              alt={userInfo.name}
              className="w-full h-full object-cover"
            />
          ) : authEmail || userInfo?.name ? (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
              <span className="text-[10px] font-bold text-neutral-300 uppercase">
                {(userInfo?.name ?? authEmail ?? '?').charAt(0)}
              </span>
            </div>
          ) : (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
              <UserIcon size={14} className="text-neutral-400" />
            </div>
          )}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveView(activeView === 'settings' ? 'main' : 'settings')}
          className="h-7 w-7 bg-neutral-900/50 hover:bg-neutral-800"
          title="Settings"
          aria-label={activeView === 'settings' ? 'Close settings' : 'Open settings'}
        >
          <Settings size={14} className="text-neutral-400" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={collapse}
          className="h-7 w-7 bg-neutral-900/50 hover:bg-neutral-800"
          title="Colapsar"
          aria-label="Colapsar painel"
        >
          <Minimize2 size={14} className="text-neutral-400" />
        </Button>
      </div>
    </header>
  );
}
