import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, NavigateFunction } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { VisantLogo3D, PRESETS } from '../components/3d/VisantLogo3D';
import { Lock, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { appsService, AppConfig } from '@/services/appsService';
import { AuthModal } from '@/components/AuthModal';
import { LandingHome } from '@/components/landing/LandingHome';
import { GettingStartedChecklist } from '@/components/onboarding/GettingStartedChecklist';

const playTick = () => {
  const a = new Audio('/sounds/hihat.wav');
  a.volume = 0.12;
  a.play().catch(() => {
    /* autoplay blocked — silent */
  });
};

// ─── Real mobile detection ────────────────────────────────────────────────────
const detectRealMobile = (): boolean => {
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return isMobileUA || (isCoarsePointer && navigator.maxTouchPoints > 1);
};

const MOBILE_BLOCKED = new Set(['mockup-machine', 'canvas', 'moodboard-studio']);

// Apps visible to all authenticated users (not just admin/tester)
const PUBLIC_APP_IDS = new Set([
  'mockup-machine',
  'brand-guidelines',
  'canvas',
  'community',
  'labs',
  'image-lab',
  '3d-studio',
  'playground',
]);

// Fixed preset per appId — index into PRESETS (0=neutral 1=cyan 2=violet 3=amber 4=rose 5=green 6=blue 7=warm)
const APP_PRESET: Record<string, number> = {
  canvas: 1,
  'mockup-machine': 2,
  'brand-guidelines': 3,
  community: 5,
  labs: 4,
  'vsn-exporter': 0,
};
const LS_KEY = 'vsn_app_last_used';

// Fixed app roster — order here is the fallback; smart sort re-orders by last-used
const PINNED_APP_IDS = [
  'canvas',
  'mockup-machine',
  'brand-guidelines',
  'image-lab',
  '3d-studio',
  'playground',
] as const;

// Synthetic entry for Visant Exporter (not a backend app — download action)
const EXPORTER_ENTRY: AppConfig = {
  id: 'vsn-exporter',
  appId: 'vsn-exporter',
  name: 'Visant Exporter',
  description: 'Export workspace assets as a structured zip',
  link: '/vsn-exporter.ps1',
  badge: 'DOWNLOAD',
  badgeVariant: 'free',
  category: 'tools',
  isExternal: false,
  free: true,
  displayOrder: 99,
  isHidden: false,
};

const COMMUNITY_ENTRY: AppConfig = {
  id: 'community',
  appId: 'community',
  name: 'Community',
  description: 'Explore presets and profiles shared by the community',
  link: '/community',
  badge: 'FREE',
  badgeVariant: 'free',
  category: 'community',
  isExternal: false,
  free: true,
  displayOrder: 4,
  isHidden: false,
};

const LABS_ENTRY: AppConfig = {
  id: 'labs',
  appId: 'labs',
  name: 'Labs',
  description: 'Experimental tools and prototypes',
  link: '/labs',
  badge: 'NEW',
  badgeVariant: 'free',
  category: 'experimental',
  isExternal: false,
  free: true,
  displayOrder: 5,
  isHidden: false,
};

// ─── Last-used tracking ───────────────────────────────────────────────────────
const getLastUsed = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
};
const recordLastUsed = (appId: string) => {
  const map = getLastUsed();
  map[appId] = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(map));
};

// Smart sort: last-used first, then by backend displayOrder (popularity proxy)
const smartSort = (apps: AppConfig[]): AppConfig[] => {
  const lu = getLastUsed();
  return [...apps].sort((a, b) => {
    // featured always first
    if (a.badgeVariant === 'featured' && b.badgeVariant !== 'featured') return -1;
    if (b.badgeVariant === 'featured' && a.badgeVariant !== 'featured') return 1;
    const luDiff = (lu[b.appId] ?? 0) - (lu[a.appId] ?? 0);
    if (luDiff !== 0) return luDiff;
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });
};

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeColor = (variant: AppConfig['badgeVariant']): string => {
  switch (variant) {
    case 'featured':
      return 'text-neutral-500';
    case 'premium':
      return 'text-neutral-700';
    case 'free':
      return 'text-neutral-700';
    case 'comingSoon':
      return 'text-neutral-800';
    default:
      return 'text-neutral-800';
  }
};

const DOT_COLS = 34;
const fillDots = (label: string, badge: string) =>
  '·'.repeat(Math.max(3, DOT_COLS - label.length - badge.length));

// ─── AppRow ───────────────────────────────────────────────────────────────────
interface AppRowProps {
  app: AppConfig;
  num: number; // display number (1-based, stays stable after sort)
  focused: boolean;
  onSelect: () => void;
  onFocus: (appId: string) => void;
}

const AppRow: React.FC<AppRowProps> = ({ app, num, focused, onSelect, onFocus }) => {
  const locked = app.badgeVariant === 'comingSoon';
  const badge = (app.badge ?? app.badgeVariant).toUpperCase();

  return (
    <button
      role="option"
      aria-selected={focused}
      aria-label={`${String(num).padStart(2, '0')} ${app.name}${locked ? ', indisponível' : ''}`}
      onClick={() => !locked && onSelect()}
      onMouseEnter={() => {
        playTick();
        onFocus(app.appId);
      }}
      disabled={locked}
      className="w-full text-left flex flex-col gap-[2px] py-[3px] transition-all duration-100 disabled:cursor-not-allowed focus:outline-none"
    >
      {/* Main row */}
      <div className="flex items-center font-mono text-[11px] tracking-wider">
        {/* Number */}
        <span
          className={`w-6 shrink-0 text-[10px] transition-colors duration-100 ${
            focused && !locked ? 'text-brand-cyan' : 'text-neutral-800'
          }`}
        >
          {String(num).padStart(2, '0')}
        </span>

        {/* Prompt */}
        <span
          className={`w-3 shrink-0 transition-colors duration-100 ${
            focused && !locked ? 'text-brand-cyan' : 'text-neutral-800'
          }`}
          aria-hidden
        >
          {locked ? ' ' : '>'}
        </span>

        {/* Name */}
        <span
          className={`transition-colors duration-100 ${
            locked ? 'text-neutral-700' : focused ? 'text-white' : 'text-neutral-400'
          }`}
        >
          {app.name.toUpperCase()}
        </span>

        {/* Dots */}
        <span
          className="mx-1 select-none"
          aria-hidden
          style={{ color: locked ? '#0d0d0d' : focused ? '#3a3a3a' : '#1a1a1a' }}
        >
          {fillDots(app.name, badge)}
        </span>

        {/* Badge */}
        <span
          className={`shrink-0 transition-colors duration-100 ${
            locked ? 'text-neutral-700' : focused ? 'text-white' : badgeColor(app.badgeVariant)
          }`}
        >
          {badge}
        </span>

        {locked && <Lock size={9} className="ml-2 text-neutral-800 shrink-0" aria-hidden />}
      </div>

      {/* Description — single line, never wraps (keeps rows compact) */}
      <div
        className={`pl-9 pr-2 font-mono text-[10px] tracking-wide truncate max-w-[340px] transition-colors duration-100 ${
          locked ? 'text-neutral-800' : focused ? 'text-neutral-500' : 'text-neutral-700'
        }`}
        aria-hidden
      >
        {app.description}
      </div>
    </button>
  );
};

// ─── AppList ──────────────────────────────────────────────────────────────────
interface AppListProps {
  apps: AppConfig[];
  listRef: React.RefObject<HTMLDivElement>;
  focusedIndex: number;
  onSelect: (app: AppConfig) => void;
  onFocus: (i: number, appId: string) => void;
  navigate: NavigateFunction;
  isMobile: boolean;
}

const AppList: React.FC<AppListProps> = ({
  apps,
  listRef,
  focusedIndex,
  onSelect,
  onFocus,
  navigate,
  isMobile,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-max">
      <p className="font-redhatmono text-[10px] uppercase tracking-widest text-neutral-700 mb-3 select-none">
        VISANT LABS®
      </p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={t('home.selecione_um_app')}
        className="flex flex-col gap-[2px] max-h-[55vh] overflow-y-auto scrollbar-none"
      >
        {apps.map((app, i) => (
          <motion.div
            key={app.appId}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.045, duration: 0.16 }}
          >
            <AppRow
              app={app}
              num={i + 1}
              focused={focusedIndex === i}
              onSelect={() => onSelect(app)}
              onFocus={() => onFocus(i, app.appId)}
            />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: apps.length * 0.045 + 0.1 }}
        className="border-t border-neutral-900 pt-3 mt-3 flex items-center gap-8 w-max"
      >
        <button
          onClick={() => navigate('/apps')}
          className="px-4 py-1.5 rounded-lg bg-white/5 border border-neutral-800 font-mono text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all"
          aria-label={t('home.ver_todos_os_apps')}
        >
          More Apps
        </button>

        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/about')}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
          >
            info
          </button>
          {!isMobile ? (
            <button
              onClick={() => navigate('/community')}
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
            >
              community
            </button>
          ) : (
            <a
              href="mailto:contato@visant.co"
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
            >
              contact
            </a>
          )}
          <button
            onClick={() => navigate('/docs')}
            className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
          >
            docs
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── HomePage ─────────────────────────────────────────────────────────────────
export const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useLayout();

  const isAdmin = user?.isAdmin === true;
  const isTester = user?.userCategory === 'tester' || user?.username === 'tester';
  const isElevated = isAdmin || isTester;
  const isLoggedIn = isAuthenticated === true;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authIsSignUp, setAuthIsSignUp] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [presetIndex, setPresetIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const xOffsetPx = 0;

  useEffect(() => {
    setIsMobile(detectRealMobile());
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setApps([]);
      return;
    }
    appsService
      .getAll()
      .then((data) => {
        const byId = Object.fromEntries(data.map((a) => [a.appId, a]));
        const pinned = PINNED_APP_IDS.map((id) => byId[id])
          .filter(Boolean)
          .filter((a) => !isMobile || !MOBILE_BLOCKED.has(a.appId))
          .filter((a) => isElevated || PUBLIC_APP_IDS.has(a.appId));
        const withExtras = [...pinned, COMMUNITY_ENTRY, LABS_ENTRY];
        if (!isMobile && isElevated) withExtras.push(EXPORTER_ENTRY);
        setApps(smartSort(withExtras));
      })
      .catch(() => {
        /* silent fail */
      });
  }, [isMobile, isLoggedIn, isElevated]);

  const handleSelect = useCallback(
    (app: AppConfig) => {
      recordLastUsed(app.appId);
      if (app.appId === 'vsn-exporter') {
        const a = document.createElement('a');
        a.href = '/vsn-exporter.ps1';
        a.download = 'vsn-exporter.ps1';
        a.click();
        return;
      }
      if (app.isExternal) {
        window.open(app.link, '_blank', 'noopener noreferrer');
      } else {
        navigate(app.link);
      }
    },
    [navigate]
  );

  const moveFocus = useCallback((next: number, appId?: string) => {
    setFocusedIndex(next);
    if (appId) setPresetIndex(APP_PRESET[appId] ?? 0);
    playTick();
  }, []);

  // TUI keyboard navigation
  useEffect(() => {
    if (!isLoggedIn || apps.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const n = Math.min(focusedIndex + 1, apps.length - 1);
        moveFocus(n, apps[n]?.appId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const n = Math.max(focusedIndex - 1, 0);
        moveFocus(n, apps[n]?.appId);
      } else if (e.key === 'Enter') {
        const app = apps[focusedIndex];
        if (app && app.badgeVariant !== 'comingSoon') handleSelect(app);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apps, focusedIndex, isLoggedIn, handleSelect, moveFocus]);

  // Scroll focused item into view
  useEffect(() => {
    const row = listRef.current?.children[focusedIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  const listProps: AppListProps = {
    apps,
    listRef,
    focusedIndex,
    onSelect: handleSelect,
    onFocus: (i, appId) => {
      setFocusedIndex(i);
      setPresetIndex(APP_PRESET[appId ?? ''] ?? 0);
    },
    navigate,
    isMobile,
  };

  const openAuth = (signUp: boolean) => {
    setAuthIsSignUp(signUp);
    setShowAuthModal(true);
  };

  // Guest (confirmed not authenticated): scroll landing. While auth is still
  // resolving (undefined) or logged in, fall through to the TUI hero below.
  if (isAuthenticated === false) {
    return (
      <>
        <SEO
          title={t('homepage.seoTitle') || 'VISANT LABS'}
          description={t('homepage.seoDescription') || 'Experimental Design Laboratory'}
        />
        <LandingHome onGetStarted={() => openAuth(true)} isMobile={isMobile} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          isSignUp={authIsSignUp}
          setIsSignUp={setAuthIsSignUp}
          onSuccess={() => {
            setShowAuthModal(false);
            // On sign-up the modal routes to the /welcome wizard itself — don't
            // reload (it would cancel that). On sign-in, reload into the app hero.
            if (!authIsSignUp) window.location.reload();
          }}
        />
      </>
    );
  }

  return (
    <>
      <SEO
        title={t('homepage.seoTitle') || 'VISANT LABS'}
        description={t('homepage.seoDescription') || 'Experimental Design Laboratory'}
      />

      <div
        className="fixed inset-0 bg-black flex items-center justify-center z-10 overflow-hidden"
        data-vsn-page="home"
        data-vsn-component="HomePage"
      >
        <GridDotsBackground opacity={0.05} spacing={30} color="#ffffff" />

        {/* 3D — full-screen background, centered on right column */}
        <VisantLogo3D fullScreen presetIndex={presetIndex} xOffsetPx={isMobile ? 0 : xOffsetPx} />

        <div className="relative z-20 w-full">
          {isMobile ? (
            /* ── Mobile: stacked ─────────────────────────────────────────── */
            <div className="flex flex-col items-center px-6 max-w-xs mx-auto">
              <div className="h-[38vw] max-h-[200px]" aria-hidden />

              <AnimatePresence mode="wait">
                {isLoggedIn ? (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full mt-3"
                  >
                    <AppList {...listProps} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="guest"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-5 mt-4"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 select-none text-center">
                      experimental design laboratory
                    </p>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 border border-neutral-800 hover:border-neutral-600 rounded-sm font-mono text-[11px] uppercase tracking-widest text-neutral-400 hover:text-white transition-all duration-200"
                    >
                      <LogIn size={12} />
                      <span>{t('home.sign_in')}</span>
                    </button>
                    <div className="flex items-center gap-6 mt-2">
                      <button
                        onClick={() => navigate('/about')}
                        className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
                      >
                        {t('home.info')}
                      </button>
                      <a
                        href="mailto:contato@visant.co"
                        className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
                      >
                        {t('home.contact')}
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* ── Desktop: TUI floats over 3D background, intrinsic width ── */
            <div className="absolute inset-0 flex items-center pointer-events-none">
              <div className="ml-16 pointer-events-auto inline-flex flex-col">
                <AnimatePresence mode="wait">
                  {isLoggedIn ? (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <AppList {...listProps} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="guest"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col gap-5"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 select-none">
                        experimental design laboratory
                      </p>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 border border-neutral-800 hover:border-neutral-600 rounded-sm font-mono text-[11px] uppercase tracking-widest text-neutral-400 hover:text-white transition-all duration-200 w-fit"
                      >
                        <LogIn size={12} />
                        <span>{t('home.sign_in_2')}</span>
                      </button>
                      <div className="flex items-center gap-6">
                        <button
                          onClick={() => navigate('/about')}
                          className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
                        >
                          {t('home.info_2')}
                        </button>
                        <button
                          onClick={() => navigate('/community')}
                          className="font-mono text-[10px] uppercase tracking-widest text-neutral-700 hover:text-neutral-400 transition-colors"
                        >
                          {t('home.community')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {isLoggedIn && !isMobile && apps.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-6 font-mono text-[10px] text-neutral-800 tracking-widest uppercase select-none"
            aria-hidden
          >
            ↑ ↓ navigate · enter select
          </motion.p>
        )}

        {isLoggedIn && <GettingStartedChecklist />}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          window.location.reload();
        }}
      />
    </>
  );
};
