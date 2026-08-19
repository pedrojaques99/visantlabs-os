import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Wand2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
} from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { DemoBrandBanner } from '@/components/onboarding/DemoBrandBanner';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { extractBrandTheme } from '@/components/brand/BrandReadOnlyView';
import { useTheme } from '@/hooks/useTheme';
import { useBrandGuideline } from '@/hooks/queries/useBrandGuidelines';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useBrandMockups } from '@/hooks/queries/useBrandMockups';
import { useConnectBrandToAI } from '@/hooks/useConnectBrandToAI';
import { readCachedSeasonal } from '@/hooks/useBrandSuggestions';
import { useTranslation } from '@/hooks/useTranslation';
import { computeBrandCompleteness, completenessLevel } from '@/lib/brandCompleteness';
import { brandGapHint } from '@/lib/brandGapHints';
import { selectBrandVoice } from '@/lib/brandVoice';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';

// Mockup generator dialog — owner-only, loaded on demand (same as brand view).
const BrandMockupDialog = lazyWithRetry(() =>
  import('@/components/brand/guidelines/BrandMockupDialog').then((m) => ({
    default: m.BrandMockupDialog,
  }))
);

// Interactive band (ideias sazonais + connect-to-AI) — reusado da view pública
// (SSoT). Substitui o painel de "Sugestões" próprio do cockpit (era duplicação).
const BrandInteractivePanel = lazyWithRetry(() =>
  import('@/components/brand/BrandInteractivePanel').then((m) => ({
    default: m.BrandInteractivePanel,
  }))
);

// Feed de mockups on-brand grátis (render no browser via Scene Packages) — on demand
// pra manter o engine PSD fora do bundle inicial do cockpit.
const SurpriseMockupHero = lazyWithRetry(() =>
  import('@/components/cockpit/SurpriseMockupHero').then((m) => ({
    default: m.SurpriseMockupHero,
  }))
);

// Trocar logo principal (upload / da media / promover existente) — on demand.
const ChangeLogoDialog = lazyWithRetry(() =>
  import('@/components/brand/ChangeLogoDialog').then((m) => ({
    default: m.ChangeLogoDialog,
  }))
);

/**
 * Home cockpit (plano Revenue-Centric §4, FEATURE_COCKPIT): the logged-in home
 * becomes "your brand and its work in progress" instead of an app launcher.
 * Composes EXISTING data only — brand list, campaigns, creative projects and
 * the shared seasonal-suggestions hook. Zero new endpoints.
 *
 * Layout: brand hero header (avatar + name + palette strip) over a dense
 * bento grid — work-in-progress (2 cols, rich empty state with concrete CTAs),
 * connect-your-AI bento (visual sibling of BrandInteractivePanel §B), and a
 * suggestions card whose loading/error states stay inside the card frame.
 * Shortcuts collapse into a compact footer row.
 */

const cardCls = cn('rounded-2xl', glassSurface.panel);

/** Inner tile inside a bento card (one radius step down from the card). */
const tileCls = cn('rounded-xl', glassSurface.tile);

export const BrandCockpit: React.FC = () => {
  const { t, tOr } = useTranslation();
  const navigate = useNavigate();

  // Marca ativa vem do SSoT global (ActiveBrandContext) — o cockpit não gere
  // mais o estado/localStorage localmente. O rail e o hero ficam em sincronia.
  const {
    brands: activeBrands,
    activeBrand,
    setActiveBrand,
    isLoading: brandsLoading,
  } = useActiveBrand();
  // Id em variável própria: os callbacks abaixo dependem só DELE. Lendo
  // `activeBrand?.id` lá dentro, o React Compiler infere o objeto inteiro como
  // dependência, não bate com a lista manual e desiste de otimizar o componente.
  const activeBrandId = activeBrand?.id;
  const hasBrand = !!activeBrandId;

  // ── A marca do cockpit vive na URL (`/cockpit/:brandId`) ───────────────────
  // Quem manda muda conforme a origem, e é isso que evita o pinga-pong:
  //  · rota nova (link colado, voltar do histórico) → a URL manda, e ela
  //    empurra a marca ativa;
  //  · rota já sincronizada e a ativa mudou (switcher do topo) → o contexto
  //    manda, e a URL segue.
  // `lastRoute` é o que diferencia os dois casos.
  const { brandId: routeBrandId } = useParams<{ brandId: string }>();
  const lastRoute = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!routeBrandId) return;
    if (routeBrandId !== lastRoute.current) {
      lastRoute.current = routeBrandId;
      if (routeBrandId !== activeBrandId) setActiveBrand(routeBrandId);
      return;
    }
    if (activeBrandId && activeBrandId !== routeBrandId) {
      navigate(`/cockpit/${activeBrandId}`, { replace: true });
    }
  }, [routeBrandId, activeBrandId, setActiveBrand, navigate]);

  // Full guideline detail (colors, logos) for the hero — list rows are the
  // placeholder, so the header renders instantly and enriches when it lands.
  const { data: brandDetail } = useBrandGuideline(activeBrand?.id);
  const heroBrand = brandDetail ?? activeBrand;
  const brandName = heroBrand?.identity?.name || heroBrand?.name || '';

  // Tema da marca (accent contrast-safe) — MESMO cálculo da view pública. Sem
  // isso o BrandInteractivePanel usa o `--accent` default e os botões saem cinza
  // ("Connect to your AI" morto) em vez da cor da marca.
  const { theme } = useTheme();
  const brandVars = useMemo(() => {
    const bt = extractBrandTheme(heroBrand, theme);
    return {
      '--accent': bt.accent,
      '--accent-rgb': bt.accentRgb,
      '--accent-text': bt.accentText,
      '--brand-bg': bt.bg,
      '--brand-surface': bt.surface,
      '--brand-text': bt.text,
    } as React.CSSProperties;
  }, [heroBrand, theme]);

  // ── Capa da marca (estilo página de perfil) ───────────────────────────────
  // Sai do acervo da PRÓPRIA marca, então duas marcas nunca abrem igual. A
  // ordem de preferência não é estética, é de enquadramento: `background` e
  // `texture` foram feitos pra serem fundo; `product` e `stock` são fotos com
  // assunto no meio, que uma faixa de 180px corta na cabeça.
  //
  // Sem imagem, o degradê vem das cores reais da marca. Nunca cai num cinza
  // padrão: capa igual pra todo mundo é o oposto do que ela existe pra fazer.
  const cover = useMemo(() => {
    const media = heroBrand?.media ?? [];
    const rank: Record<string, number> = { background: 0, texture: 1, graphic: 2, other: 3 };
    const img = [...media]
      .filter((m) => m.type === 'image' && !!m.url)
      .sort((a, b) => (rank[a.category ?? 'other'] ?? 9) - (rank[b.category ?? 'other'] ?? 9))[0];
    if (img) return { kind: 'image' as const, url: img.url };
    const hex = (heroBrand?.colors ?? [])
      .slice()
      .sort((a, b) => (a.usageRank ?? 99) - (b.usageRank ?? 99))
      .map((c) => c.hex)
      .filter(Boolean)
      .slice(0, 3);
    if (hex.length === 0) return { kind: 'none' as const };
    const stops = hex.length === 1 ? [hex[0], hex[0]] : hex;
    return { kind: 'gradient' as const, css: `linear-gradient(115deg, ${stops.join(', ')})` };
  }, [heroBrand]);

  // Palette strip — the brand's real colors, most-used first (guideline data).
  const paletteColors = useMemo(() => {
    const colors = heroBrand?.colors ?? [];
    const seen = new Set<string>();
    return [...colors]
      .sort((a, b) => (a.usageRank ?? 99) - (b.usageRank ?? 99))
      .filter((c) => {
        const hex = c.hex?.toLowerCase();
        if (!hex || seen.has(hex)) return false;
        seen.add(hex);
        return true;
      })
      .slice(0, 6);
  }, [heroBrand]);

  // "Em andamento" saiu daqui. Ele era montado de `/campaigns` + `/create`, as
  // duas superfícies em alphatest — o cockpit era a vitrine principal delas.
  // O lugar dele na grade agora é a coluna de estado do portfólio, que é o que
  // "portfólio visível" pedia (plano COCKPIT-BRAND-PANEL §1).

  // Per-brand output gallery — every generated mockup persists against the brand.
  // `isError` agora é ALCANÇÁVEL (o mockupApi parou de engolir erro HTTP em []).
  // Sem consumir aqui, uma falha some com a seção inteira em silêncio — que é
  // exatamente o silent-empty que acabamos de matar na camada de serviço.
  const {
    data: brandMockups = [],
    isError: mockupsError,
    refetch: refetchMockups,
  } = useBrandMockups(activeBrandId, hasBrand);
  const [mockupPrompt, setMockupPrompt] = useState<string | undefined>(undefined);
  const [isMockupOpen, setIsMockupOpen] = useState(false);
  const [changeLogoOpen, setChangeLogoOpen] = useState(false);
  // Mockups grátis nasce FECHADO: ele renderiza cena PSD no browser e busca
  // imagem de fora. Ninguém abriu o cockpit pra isso, então trabalhar antes de
  // alguém pedir é gastar rede e meia dobra. Vira convite de uma linha.
  const [freeMockupsOpen, setFreeMockupsOpen] = useState(false);

  // "Próximo passo" é colapsável e PERSISTE fechado (o card SISTEMA % já mostra o
  // progresso; quem fechou não quer ser incomodado de novo). Global por usuário.
  const [nbaCollapsed, setNbaCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('vsn_cockpit_nba_collapsed') === '1'
  );
  const toggleNba = useCallback(() => {
    setNbaCollapsed((prev) => {
      const v = !prev;
      if (typeof window !== 'undefined')
        localStorage.setItem('vsn_cockpit_nba_collapsed', v ? '1' : '0');
      return v;
    });
  }, []);

  // Connect-to-AI — mesmo hook da view pública (SSoT). O BrandInteractivePanel
  // (que substituiu o painel de sugestões) consome isto; se a marca não é
  // compartilhável, o fallback abre a marca pra compartilhar antes de mintar o link.
  const { connecting, connect } = useConnectBrandToAI();
  const handleConnect = useCallback(async () => {
    await connect(heroBrand?.publicSlug, () =>
      navigate(activeBrandId ? `/brand-guidelines?id=${activeBrandId}` : '/brand-guidelines')
    );
  }, [connect, heroBrand?.publicSlug, activeBrandId, navigate]);

  // ── Brand Depth — the "save file" of the brand: how deep the guideline is,
  // from the same completeness scorer the grid uses. Deterministic, zero backend.
  // A deeper brand = better MCP ammunition for every generation surface.
  const depthReport = useMemo(() => computeBrandCompleteness(brandDetail ?? null), [brandDetail]);
  const depthLevel = useMemo(() => completenessLevel(depthReport.score), [depthReport.score]);
  const nextActions = useMemo(
    () => [...depthReport.missing].sort((a, b) => b.weight - a.weight).slice(0, 3),
    [depthReport.missing]
  );
  const openGuideline = useCallback(
    () => navigate(activeBrandId ? `/brand-guidelines?id=${activeBrandId}` : '/brand-guidelines'),
    [navigate, activeBrandId]
  );

  // ── A voz: a linha que só vale pra ESTA marca, hoje ────────────────────────
  // Determinística (plano §2.1): zero LLM, zero `usage_record`, zero request
  // novo. Tudo vem de dado que o cockpit já carregou.
  //
  // `now` congelado na montagem. Solto no corpo do memo, `Date.now()` faria a
  // frase recalcular a cada render (e o lint de pureza reprova, com razão).
  // Inicializador preguiçoso de `useState` roda uma vez e nunca mais.
  const [now] = useState(() => Date.now());
  const voice = useMemo(() => {
    // Falha de carga dos mockups não pode virar "nunca produziu nada" — é a
    // mentira clássica de silent-empty, agora na frase mais visível da tela.
    if (!brandDetail || mockupsError) return null;
    const topGap = nextActions[0];
    return selectBrandVoice({
      brandName,
      hasLogo: (heroBrand?.logos?.length ?? 0) > 0,
      isConnected: !!(heroBrand?.isPublic || heroBrand?.publicSlug),
      completeness: depthReport.score,
      topGapLabel: topGap ? tOr(`brandCompleteness.${topGap.id}`, topGap.label) : null,
      pieceCount: brandMockups.length,
      lastPieceAt: brandMockups[0]?.createdAt ?? null,
      seasonal: readCachedSeasonal(activeBrandId),
      now,
    });
  }, [
    brandDetail,
    mockupsError,
    nextActions,
    brandName,
    heroBrand,
    depthReport.score,
    brandMockups,
    activeBrandId,
    now,
    tOr,
  ]);

  // ── Portfólio: as OUTRAS marcas, com estado próprio ────────────────────────
  // Só o que a LISTAGEM já traz (zero request extra, zero N+1). Sem porcentagem
  // de propósito: a listagem não traz strategy/tokens/guidelines, então o score
  // calculado dela sairia MENOR que o do hero pra mesma marca, e dois números
  // diferentes pro mesmo objeto na mesma tela é bug, não resumo.
  // O portfólio saiu daqui: o grid de marcas virou a home (`/`), e o cockpit
  // é de UMA marca. Trocar de marca é trabalho do switcher no topo.

  // O que o agente enxerga da marca hoje. Alimenta o card de contexto, que antes
  // tinha um vão vertical morto onde devia estar exatamente esta informação.
  const contextStats = useMemo(() => {
    if (!brandDetail) return undefined;
    // Zero não renderiza (espinha 5 do visant-frontend). Um tile "0 ASSETS"
    // ocupa a mesma área de um dado e não informa nada; o que ele diria de útil
    // já é trabalho do bloco PRÓXIMO PASSO.
    return [
      { labelKey: 'brandPanel.stats.colors', value: brandDetail.colors?.length ?? 0 },
      { labelKey: 'brandPanel.stats.fonts', value: brandDetail.typography?.length ?? 0 },
      { labelKey: 'brandPanel.stats.logos', value: brandDetail.logos?.length ?? 0 },
      { labelKey: 'brandPanel.stats.assets', value: brandDetail.media?.length ?? 0 },
    ].filter((s) => s.value > 0);
  }, [brandDetail]);

  // "Ver guidelines" — abre a rota pública numa nova aba (o que o cliente/mundo vê).
  // Fallback pro editor do dono quando a marca ainda não foi publicada (sem slug).
  const viewPublicGuidelines = useCallback(() => {
    const slug = heroBrand?.publicSlug;
    const url = slug
      ? `/brand/${slug}`
      : activeBrandId
        ? `/brand-guidelines?id=${activeBrandId}`
        : '/brand-guidelines';
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [heroBrand?.publicSlug, activeBrandId]);

  // ── Render ──
  // Guard defensivo FORA do AnimatePresence: o HomeRoute já garante marca ativa,
  // mas se cair aqui sem marca, redireciona ANTES de montar o AnimatePresence.
  // Um <Navigate> como filho do AnimatePresence dispara "removeChild" (o Navigate
  // desmonta a rota enquanto o AnimatePresence ainda segura o nó de saída).
  if (!brandsLoading && activeBrands.length === 0) {
    return <Navigate to="/brand-guidelines" replace />;
  }

  return (
    <div
      className="absolute inset-0 z-0 bg-background overflow-y-auto"
      data-vsn-page="home"
      data-vsn-component="BrandCockpit"
    >
      <GridDotsBackground opacity={0.05} spacing={30} />
      <DemoBrandBanner brandId={activeBrand?.id} />

      <main
        className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-8 pb-12 min-h-full flex flex-col"
        data-vsn-region="content"
      >
        <h1 className="sr-only">{t('cockpit.title')}</h1>

        <AnimatePresence mode="wait">
          {brandsLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 gap-6"
            >
              <GlitchLoader size={40} />
            </motion.div>
          ) : (
            <motion.div
              key="cockpit"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-5 flex-1"
            >
              {/* ── Capa + identidade, no padrão de página de perfil ──
                  A marca deixa de ser um cabeçalho de texto e vira o assunto da
                  tela. O avatar cavalga a borda da capa (o `-mt-*`), que é o que
                  faz ler como perfil e não como banner com título embaixo. ── */}
              <div data-vsn-region="brand-cover" className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
                <div
                  className="relative h-32 sm:h-40 w-full overflow-hidden bg-muted"
                  style={cover.kind === 'gradient' ? { backgroundImage: cover.css } : undefined}
                >
                  {cover.kind === 'image' && (
                    <img
                      src={cover.url}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover"
                    />
                  )}
                  {/* Véu: a capa é fundo, não conteúdo. Sem ele o nome disputa
                      legibilidade com a foto e perde em metade das marcas. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
                </div>
              </div>

              {/* `relative z-10`: o miolo da capa é `relative`, e elemento posicionado
                  pinta ACIMA de estático mesmo vindo antes no DOM. Sem isto a capa
                  cobria a metade de cima do nome da marca. */}
              <header
                className="relative z-10 flex items-end justify-between gap-4 flex-wrap"
                data-vsn-region="brand-hero"
              >
                {/* Só o AVATAR cavalga a capa (é ele que faz ler como perfil). O
                    nome e a voz ficam abaixo da linha, onde nada os corta. */}
                <div className="flex items-start gap-4 min-w-0">
                  {/* Logo clicável → editor da marca (upload / selecionar da media /
                      set-primary já existem no LogosSection). Dialog inline = follow-up. */}
                  <button
                    onClick={() => setChangeLogoOpen(true)}
                    aria-label={t('cockpit.changeLogo')}
                    title={t('cockpit.changeLogo')}
                    className="relative group/logo shrink-0 -mt-12 sm:-mt-14 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40"
                  >
                    <BrandAvatar
                      brand={heroBrand}
                      size={80}
                      rounded="md"
                      className="bg-muted ring-4 ring-background"
                    />
                    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/55 opacity-0 group-hover/logo:opacity-100 transition-opacity">
                      <ImageIcon size={16} className="text-white/90" />
                    </span>
                  </button>
                  <div className="min-w-0">
                    {/* "Cockpit da marca" era ruído visual — vira só a11y (leitor
                        de tela). O contexto já é óbvio pela marca + rail. */}
                    <MicroTitle className="sr-only">{t('cockpit.title')}</MicroTitle>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate mt-0.5">
                      {brandName}
                    </h2>
                    {/* A voz — a única linha da tela que não serve pra outra
                        marca nem pra outro dia. Determinística, sem IA. */}
                    {voice && (
                      <p
                        role="status"
                        data-vsn-region="brand-voice"
                        className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        {t(`cockpit.voice.${voice.key}`, voice.params)}
                      </p>
                    )}
                  </div>
                </div>
                {/* Troca de marca vive no rail (SSoT). Aqui: Brand Depth — nível
                    nomeado + barra + distância pro próximo (goal-gradient do RCD). */}
                <div className="flex items-center gap-2">
                  {/* SISTEMA % — sinal DISCRETO inline (barra fina + %), não um card
                      competindo com o nome. Detalhe (nível + próximo) vai no hover. */}
                  {brandDetail && (
                    <button
                      onClick={openGuideline}
                      aria-label={t('cockpit.depth.title')}
                      title={`${t(`cockpit.depth.level.${depthLevel.key}`)} · ${
                        depthLevel.nextAt !== null
                          ? t('cockpit.depth.toNext', { n: depthLevel.toNext })
                          : t('cockpit.depth.complete')
                      }`}
                      className="group flex items-center gap-2.5 px-1"
                    >
                      <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-cyan/70 transition-colors"
                          style={{ width: `${depthReport.score}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
                        {depthReport.score}%
                      </span>
                    </button>
                  )}
                  <Button
                    variant="surface"
                    size="sm"
                    onClick={viewPublicGuidelines}
                    className="gap-2 font-sans"
                  >
                    <ExternalLink size={14} />
                    {t('cockpit.viewGuidelines')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-md"
                    aria-label={t('cockpit.settings')}
                    onClick={() => navigate('/profile')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings size={15} />
                  </Button>
                </div>
              </header>

              {/* ── Next Best Action — the gaps that deepen the brand, by weight.
                  Deterministic from the completeness scorer; each opens the guideline. ── */}
              {nextActions.length > 0 ? (
                <section
                  aria-label={t('cockpit.nba.title')}
                  data-vsn-region="next-best-action"
                  className={cn('px-1', !nbaCollapsed && 'pb-1')}
                >
                  <button
                    onClick={toggleNba}
                    aria-expanded={!nbaCollapsed}
                    className="flex items-center justify-between gap-2 w-full text-left group/nba"
                  >
                    <span className="text-sm font-medium tracking-tight text-foreground">
                      {t('cockpit.nba.title')}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground group-hover/nba:text-foreground transition-colors">
                      {nbaCollapsed && <span className="tabular-nums">{nextActions.length}</span>}
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', nbaCollapsed && '-rotate-90')}
                      />
                    </span>
                  </button>
                  {/* Lista compacta, monocromática, 1 linha por gap — a dica vai no
                      hover (title), não ocupa altura. Sem tile/accent (era slop). */}
                  {!nbaCollapsed && (
                    <ul className="mt-1.5 flex flex-col">
                      {nextActions.map((rule) => (
                        <li key={rule.id}>
                          <button
                            onClick={openGuideline}
                            title={brandGapHint(rule.id)}
                            className="group flex items-center justify-between gap-3 w-full py-1.5 text-left border-b border-border last:border-0"
                          >
                            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                              {tOr(`brandCompleteness.${rule.id}`, rule.label)}
                            </span>
                            <ChevronRight
                              size={12}
                              className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : brandDetail ? (
                <section
                  data-vsn-region="next-best-action"
                  className={cn(cardCls, 'flex items-center gap-2.5 px-4 py-3')}
                >
                  <CheckCircle2 size={14} className="text-success shrink-0" />
                  <span className="text-xs text-muted-foreground">{t('cockpit.nba.complete')}</span>
                </section>
              ) : null}

              {/* PRODUZIR removido — dedupe: as MAKE SOMETHING cards do
                  BrandInteractivePanel (com o card Mockup) são a ÚNICA superfície
                  de produção agora (outcome-first). Fim da briga de hierarquia. */}

              {/* ── Bandas empilhadas full-width (igual à view pública): work em
                     andamento em cima, BrandInteractivePanel (MAKE SOMETHING +
                     LIVE AI CONTEXT) como faixa larga — ele precisa da largura
                     cheia pras suas 2 colunas internas não espremerem. ── */}
              <div className="flex flex-col gap-4 flex-1">
                {/* ── Produção PRIMEIRO (RCD: o principal aparece atraente antes do
                    resto): MAKE SOMETHING + Mockup + LIVE AI CONTEXT no topo. ── */}
                {activeBrand?.id && (
                  <div style={brandVars}>
                    <React.Suspense fallback={null}>
                      <BrandInteractivePanel
                        guidelineId={activeBrand.id}
                        fullWidth
                        isShared={!!(heroBrand?.isPublic || heroBrand?.publicSlug)}
                        connecting={connecting}
                        onConnect={handleConnect}
                        contextStats={contextStats}
                        paletteColors={paletteColors}
                        onMockup={() => setIsMockupOpen(true)}
                        onGenerate={(p) => {
                          setMockupPrompt(p);
                          setIsMockupOpen(true);
                        }}
                      />
                    </React.Suspense>
                  </div>
                )}

                {/* ── Mockups grátis: colapsado por padrão ──
                    Ele renderiza cena PSD no browser e puxa imagem de fora.
                    Aberto sempre, ocupa meia dobra e trabalha antes de
                    alguém pedir. Vira convite de uma linha; quem quer, abre. ── */}
                {activeBrand?.id && (
                  <section data-vsn-region="free-mockups" className={cn(cardCls, 'p-2')}>
                    <button
                      onClick={() => setFreeMockupsOpen((v) => !v)}
                      aria-expanded={freeMockupsOpen}
                      className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles size={14} className="text-muted-foreground" />
                        <span className="text-sm font-medium tracking-tight text-foreground">
                          {t('cockpit.surprise.title')}
                        </span>
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn(
                          'text-muted-foreground transition-transform',
                          !freeMockupsOpen && '-rotate-90'
                        )}
                      />
                    </button>
                    {freeMockupsOpen && (
                      <div className="mt-2">
                        <React.Suspense fallback={null}>
                          {/* `key` obrigatória: o hero guarda em ref um Set de pares já
                              vistos. Sem remontar por marca, os pares da marca A seguem
                              filtrando a paginação da marca B. */}
                          <SurpriseMockupHero
                            key={activeBrand.id}
                            brandId={activeBrand.id}
                            onAddAsset={() => setChangeLogoOpen(true)}
                          />
                        </React.Suspense>
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* Falha de carga ≠ "nenhum output ainda": estado próprio + retry. */}
              {mockupsError && brandMockups.length === 0 && (
                <section
                  aria-label={t('cockpit.gallery.title')}
                  data-vsn-region="output-gallery"
                  className={cn(cardCls, 'p-5 flex items-center justify-between gap-3')}
                >
                  <p className="text-xs text-muted-foreground">{t('cockpit.gallery.loadError')}</p>
                  <Button variant="surface" size="xs" onClick={() => void refetchMockups()}>
                    {t('common.retry')}
                  </Button>
                </section>
              )}

              {/* ── Output gallery — every generated asset, persisted per brand ── */}
              {brandMockups.length > 0 && (
                <section
                  aria-label={t('cockpit.gallery.title')}
                  data-vsn-region="output-gallery"
                  className={cn(cardCls, 'p-5')}
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-sm font-medium tracking-tight text-foreground">
                      {t('cockpit.gallery.title')}
                    </span>
                    <Button
                      variant="surface"
                      size="xs"
                      onClick={() => navigate('/my-outputs')}
                      className="gap-1.5"
                    >
                      {t('cockpit.gallery.viewAll')}
                      <ChevronRight size={12} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {brandMockups.slice(0, 12).map((m) => (
                      <button
                        key={m._id}
                        onClick={() => navigate('/my-outputs')}
                        title={m.prompt}
                        className={cn(tileCls, 'group aspect-square overflow-hidden')}
                      >
                        {m.imageUrl ? (
                          <img
                            src={m.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Wand2 size={18} className="text-muted-foreground" strokeWidth={1.2} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mockup generator seeded by an inline suggestion (same as brand view). */}
      {isMockupOpen && activeBrand && (
        <React.Suspense fallback={null}>
          <BrandMockupDialog
            open={isMockupOpen}
            onOpenChange={(o: boolean) => {
              setIsMockupOpen(o);
              if (!o) setMockupPrompt(undefined);
            }}
            guideline={activeBrand}
            initialPrompt={mockupPrompt}
          />
        </React.Suspense>
      )}

      {/* Trocar logo principal — upload / da media / promover existente. */}
      {changeLogoOpen && heroBrand && (
        <React.Suspense fallback={null}>
          <ChangeLogoDialog
            guideline={heroBrand}
            open={changeLogoOpen}
            onOpenChange={setChangeLogoOpen}
          />
        </React.Suspense>
      )}
    </div>
  );
};
