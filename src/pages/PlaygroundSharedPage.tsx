import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Renderer, StateProvider, ActionProvider, VisibilityProvider, useStateStore } from '@json-render/react';
import type { Spec } from '@json-render/react';
import { registry, handlers as createHandlers } from '@/lib/playground/registry';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GitFork, ArrowLeft, Heart, Eye } from 'lucide-react';
import { forkMiniApp, likeMiniApp } from '@/services/playgroundApi';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SharedRenderer: React.FC<{ spec: Spec }> = ({ spec }) => {
  const navigate = useNavigate();
  const stateCtx = useStateStore();

  const setStateAdapter = React.useCallback(
    (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      const next = updater(stateCtx.getSnapshot() as Record<string, unknown>);
      Object.entries(next).forEach(([k, v]) => stateCtx.set(k, v));
    },
    [stateCtx]
  );

  const actionHandlers = React.useMemo(
    () =>
      createHandlers(
        () => setStateAdapter,
        () => stateCtx.state
      ),
    [setStateAdapter, stateCtx.state]
  );

  return (
    <ActionProvider handlers={actionHandlers} navigate={(path) => navigate(path)}>
      <VisibilityProvider>
        <Renderer spec={spec} registry={registry} />
      </VisibilityProvider>
    </ActionProvider>
  );
};

export const PlaygroundSharedPage: React.FC = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [miniApp, setMiniApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!shareId) return;
    fetch(`/api/playground/shared/${shareId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(({ miniApp: app }) => {
        setMiniApp(app);
        setLikeCount(app.likesCount || 0);
      })
      .catch(() => setError('This shared link is invalid or expired.'))
      .finally(() => setLoading(false));
  }, [shareId]);

  const handleFork = async () => {
    if (!miniApp?.id) return;
    if (!authService.getToken()) {
      toast.error('Sign in to fork');
      return;
    }
    try {
      const result = await forkMiniApp(miniApp.id);
      toast.success('Forked to your playground!');
      navigate(`/playground/${result.miniApp?.slug}`);
    } catch {
      toast.error('Failed to fork');
    }
  };

  const handleLike = async () => {
    if (!miniApp?.id || !authService.getToken()) return;
    try {
      const result = await likeMiniApp(miniApp.id);
      setLiked(result.liked);
      setLikeCount((c) => (result.liked ? c + 1 : Math.max(0, c - 1)));
    } catch {
      /* silent */
    }
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-neutral-950 pt-14">
        <GlitchLoader size="md" />
      </div>
    );
  }

  if (error || !miniApp) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-neutral-950 pt-14 gap-4">
        <p className="text-sm text-neutral-500">{error || 'Not found'}</p>
        <Button variant="surface" size="sm" onClick={() => navigate('/playground/explore')}>
          Explore MiniApps
        </Button>
      </div>
    );
  }

  const spec = miniApp.spec as Spec;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-neutral-950 pt-10 md:pt-14">
      {/* Top bar */}
      <div className="shrink-0 flex items-center h-12 px-4 border-b border-neutral-800/30 gap-3">
        <button
          onClick={() => navigate('/playground/explore')}
          className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[13px] font-semibold text-neutral-200 truncate">{miniApp.title}</h1>
          {miniApp.author?.name && (
            <span className="text-[10px] text-neutral-600">by {miniApp.author.name}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> {miniApp.viewsCount}
          </span>
        </div>
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
            liked
              ? 'text-red-400 bg-red-400/10'
              : 'text-neutral-400 hover:text-red-400 hover:bg-white/5'
          )}
        >
          <Heart className="w-3.5 h-3.5" fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
        <Button variant="brand" size="xs" onClick={handleFork} className="gap-1.5">
          <GitFork className="w-3 h-3" />
          Fork
        </Button>
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 overflow-auto">
        <StateProvider initialState={(spec as any)?.stateDefaults ?? undefined}>
          <SharedRenderer spec={spec} />
        </StateProvider>
      </div>
    </div>
  );
};
