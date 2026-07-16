import { describe, it, expect } from 'vitest';
import {
  classifyRoute,
  resolveShell,
  routeMode,
  isBrandContext,
  isBrandScopedEditor,
  editorHasOwnChrome,
  visibleSections,
  contextNavFor,
  NAV_SECTIONS,
  type NavCtx,
} from '@/config/navConfig';

const baseCtx: NavCtx = {
  isAuthenticated: true,
  isElevated: false,
  flags: { cockpit: true, copilot: true },
  activeBrandId: null,
};

describe('classifyRoute', () => {
  it('classifica website público como marketing/full', () => {
    for (const p of ['/', '/pricing', '/about', '/docs', '/docs/getting-started']) {
      expect(classifyRoute(p)).toMatchObject({ shell: 'marketing', mode: 'full' });
    }
  });

  // /community é item da BIBLIOTECA (LIBRARY_ITEMS), não website: logado ganha o
  // AppShell (rail + drill-in COMMUNITY_NAV); deslogado cai no MarketingShell via
  // resolveShell (auth gating), não via classifyRoute.
  it('community é app/full (biblioteca) e só cai em marketing deslogado', () => {
    for (const p of ['/community', '/community/presets']) {
      expect(classifyRoute(p)).toMatchObject({ shell: 'app', mode: 'full', section: 'community' });
      expect(resolveShell(p, true)).toBe('app');
      expect(resolveShell(p, false)).toBe('marketing');
    }
  });

  it('trata guideline público e perfil público como marketing', () => {
    expect(classifyRoute('/brand/aurora-coffee').shell).toBe('marketing');
    expect(classifyRoute('/brand/aurora-coffee/colors').shell).toBe('marketing');
    expect(classifyRoute('/profile/someuser').shell).toBe('marketing');
  });

  it('trata /profile (exato) como app/dashboard na seção profile', () => {
    expect(classifyRoute('/profile')).toEqual({ shell: 'app', mode: 'full', section: 'profile' });
  });

  it('rotas de auth e retorno de checkout são marketing', () => {
    for (const p of [
      '/login',
      '/auth',
      '/welcome',
      '/onboard',
      '/thank-you',
      '/thank-you-pro',
      '/connect/abc123',
    ]) {
      expect(classifyRoute(p).shell).toBe('marketing');
    }
  });

  it('páginas shared públicas são marketing', () => {
    expect(classifyRoute('/canvas/shared/xyz').shell).toBe('marketing');
    expect(classifyRoute('/budget/shared/xyz').shell).toBe('marketing');
    expect(classifyRoute('/playground/shared/xyz').shell).toBe('marketing');
  });

  it('editores são app/focus', () => {
    for (const p of [
      '/mockupmachine',
      '/3d-studio',
      '/image-lab',
      '/create',
      '/canvas/abc',
      '/qrcode',
      '/compress',
      '/labs/wind-tunnel',
    ]) {
      expect(classifyRoute(p)).toMatchObject({ shell: 'app', mode: 'focus' });
    }
  });

  it('chats (/copilot, /admin/chat) e /admin são dashboard full (rail + ChatShell como pane)', () => {
    expect(classifyRoute('/copilot').mode).toBe('full');
    expect(classifyRoute('/copilot').section).toBe('copilot');
    expect(classifyRoute('/admin/chat').mode).toBe('full');
    expect(classifyRoute('/admin').mode).toBe('full');
  });

  it('distingue /canvas (dashboard) de /canvas/:id (editor)', () => {
    // Ambos destacam a seção 'canvas' no rail (há item L1 em NAV_SECTIONS); o que
    // difere é o modo: lista = full, editor = focus.
    expect(classifyRoute('/canvas')).toMatchObject({
      shell: 'app',
      mode: 'full',
      section: 'canvas',
    });
    expect(classifyRoute('/canvas/abc')).toMatchObject({
      shell: 'app',
      mode: 'focus',
      section: 'canvas',
    });
  });

  it('distingue /create (editor) de /create/projects (dashboard)', () => {
    expect(classifyRoute('/create').mode).toBe('focus');
    expect(classifyRoute('/create/projects').mode).toBe('full');
  });

  it('mapeia seções de nível 1', () => {
    expect(classifyRoute('/cockpit').section).toBe('cockpit');
    expect(classifyRoute('/apps').section).toBe('apps');
    expect(classifyRoute('/copilot').section).toBe('copilot');
    // Início adaptativo: o grid de marcas destaca o MESMO item (cockpit=Início).
    expect(classifyRoute('/brand-guidelines').section).toBe('cockpit');
    // Branding Machine CRIA marca (não opera sobre a ativa) → ancora em 'apps'.
    // 'brands' não tem entrada em NAV_SECTIONS: ancorar ali = rail sem destaque.
    expect(classifyRoute('/my-brandings').section).toBe('apps');
    expect(classifyRoute('/branding-machine').section).toBe('apps');
    expect(classifyRoute('/settings/api-keys').section).toBe('profile');
    expect(classifyRoute('/settings/connected-apps').section).toBe('profile');
  });

  it('ignora query e trailing slash', () => {
    expect(classifyRoute('/brand-guidelines?id=123').section).toBe('cockpit');
    expect(classifyRoute('/apps/').section).toBe('apps');
  });
});

describe('resolveShell', () => {
  it('rota de marketing é sempre marketing', () => {
    expect(resolveShell('/', true)).toBe('marketing');
    expect(resolveShell('/', false)).toBe('marketing');
  });

  it('rota de app só vira app com sessão; deslogado/checando cai em marketing', () => {
    expect(resolveShell('/cockpit', true)).toBe('app');
    expect(resolveShell('/cockpit', false)).toBe('marketing');
    expect(resolveShell('/cockpit', null)).toBe('marketing');
  });

  it('ferramenta grátis logada usa app shell (focus), deslogada usa marketing', () => {
    expect(resolveShell('/qrcode', true)).toBe('app');
    expect(resolveShell('/qrcode', false)).toBe('marketing');
  });
});

describe('isBrandContext', () => {
  it('marca aparece em produção (cockpit, copilot, canvas, criativos, campanhas)', () => {
    for (const p of [
      '/cockpit',
      '/copilot',
      '/canvas/abc',
      '/create',
      '/create/projects',
      '/campaigns',
      '/mockupmachine',
    ]) {
      expect(isBrandContext(p)).toBe(true);
    }
  });

  it('marca some na gestão (biblioteca de marcas, apps, profile, admin)', () => {
    for (const p of [
      '/brand-guidelines',
      '/brand-guidelines?id=x',
      '/my-brandings',
      '/apps',
      '/profile',
      '/settings/api-keys',
      '/admin',
      '/admin/products',
    ]) {
      expect(isBrandContext(p)).toBe(false);
    }
  });
});

describe('routeMode', () => {
  it('retorna focus em editor e full em dashboard', () => {
    expect(routeMode('/mockupmachine')).toBe('focus');
    expect(routeMode('/cockpit')).toBe('full');
  });
});

describe('visibleSections', () => {
  it('Início (cockpit) sempre visível; Copilot gated por flag; sem seção Marcas', () => {
    const ctx: NavCtx = { ...baseCtx, flags: { cockpit: false, copilot: false } };
    const ids = visibleSections(ctx).map((s) => s.id);
    expect(ids).not.toContain('copilot'); // flag off
    expect(ids).toContain('cockpit'); // Início é a casa, sempre presente
    expect(ids).toContain('apps');
    expect(ids).not.toContain('brands'); // colapsado no Início (HOME-ADAPTIVE-IA)
  });

  it('mostra tudo com as flags on', () => {
    const ids = visibleSections(baseCtx).map((s) => s.id);
    expect(ids).toEqual(['cockpit', 'copilot', 'canvas', 'apps']);
  });
});

describe('contextNavFor', () => {
  it('retorna [] em rota sem seção', () => {
    // /mockupmachine é editor sem seção L1 (sectionFor → null).
    expect(classifyRoute('/mockupmachine').section).toBe(null);
    expect(contextNavFor('/mockupmachine', baseCtx)).toEqual([]);
  });

  it('brands/apps/cockpit têm L2 vazia (a própria página traz a sub-nav)', () => {
    expect(contextNavFor('/brand-guidelines', baseCtx)).toEqual([]);
    expect(contextNavFor('/apps', baseCtx)).toEqual([]);
    expect(contextNavFor('/cockpit', baseCtx)).toEqual([]);
  });

  // SSoT do índice de profile: as abas horizontais in-page foram removidas, então
  // `configuration` (BYOK + segurança + zona de perigo, ProfilePage ?tab=configuration)
  // só é alcançável por aqui.
  it('sub-nav de profile lista conta, uso, configurações, api-keys e connected-apps', () => {
    const ids = contextNavFor('/profile', baseCtx).map((i) => i.id);
    expect(ids).toEqual(['account', 'usage', 'configuration', 'api-keys', 'connected-apps']);
  });

  it('todas as seções de nível 1 têm labelKey sob nav.*', () => {
    for (const s of NAV_SECTIONS) {
      expect(s.labelKey.startsWith('nav.')).toBe(true);
    }
  });
});

describe('isBrandScopedEditor', () => {
  it('editores de produção operam sobre a marca (chip aparece)', () => {
    for (const p of [
      '/create',
      '/canvas/abc123',
      '/mockupmachine',
      '/mockupmachine/expert',
      '/image-lab',
      '/3d-studio',
      '/content-studio',
      '/branding-machine',
      '/moodboard',
      '/playground/xyz',
    ]) {
      expect(isBrandScopedEditor(p)).toBe(true);
    }
  });

  it('ferramentas utilitárias NÃO usam marca (chip some)', () => {
    for (const p of [
      '/qrcode',
      '/compress',
      '/pdf-compress',
      '/converter',
      '/remove-bg',
      '/upscale',
      '/favicon',
    ]) {
      expect(isBrandScopedEditor(p)).toBe(false);
    }
  });

  it('/canvas (lista, dashboard) não é editor brand-scoped; /canvas/:id é', () => {
    expect(isBrandScopedEditor('/canvas')).toBe(false);
    expect(isBrandScopedEditor('/canvas/proj-1')).toBe(true);
  });
});

describe('editorHasOwnChrome / naming = editor focus', () => {
  it('/naming é editor focus (não dashboard) — sem rail/AppTopBar', () => {
    expect(classifyRoute('/naming')).toMatchObject({ shell: 'app', mode: 'focus' });
    expect(routeMode('/naming')).toBe('focus');
  });

  it('só o canvas tem header top-0 completo próprio → não recebe AppSpine', () => {
    expect(editorHasOwnChrome('/canvas/abc')).toBe(true);
  });

  it('editores MiniAppShell/ToolEditorShell RESERVAM a faixa do topo → recebem AppSpine (senão buraco)', () => {
    for (const p of [
      '/naming',
      '/image-lab',
      '/3d-studio',
      '/qrcode',
      '/compress',
      '/mockupmachine',
      '/create',
    ]) {
      expect(editorHasOwnChrome(p)).toBe(false);
    }
  });
});
