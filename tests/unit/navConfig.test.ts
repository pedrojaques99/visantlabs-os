import { describe, it, expect } from 'vitest';
import {
  classifyRoute,
  resolveShell,
  routeMode,
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
    for (const p of ['/', '/pricing', '/about', '/docs', '/docs/getting-started', '/community', '/community/presets']) {
      expect(classifyRoute(p)).toMatchObject({ shell: 'marketing', mode: 'full' });
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
    for (const p of ['/login', '/auth', '/welcome', '/onboard', '/thank-you', '/thank-you-pro', '/connect/abc123']) {
      expect(classifyRoute(p).shell).toBe('marketing');
    }
  });

  it('páginas shared públicas são marketing', () => {
    expect(classifyRoute('/canvas/shared/xyz').shell).toBe('marketing');
    expect(classifyRoute('/budget/shared/xyz').shell).toBe('marketing');
    expect(classifyRoute('/playground/shared/xyz').shell).toBe('marketing');
  });

  it('editores são app/focus', () => {
    for (const p of ['/mockupmachine', '/3d-studio', '/image-lab', '/create', '/canvas/abc', '/qrcode', '/compress', '/labs/wind-tunnel']) {
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
    expect(classifyRoute('/canvas')).toMatchObject({ shell: 'app', mode: 'full', section: null });
    expect(classifyRoute('/canvas/abc')).toMatchObject({ shell: 'app', mode: 'focus' });
  });

  it('distingue /create (editor) de /create/projects (dashboard)', () => {
    expect(classifyRoute('/create').mode).toBe('focus');
    expect(classifyRoute('/create/projects').mode).toBe('full');
  });

  it('mapeia seções de nível 1', () => {
    expect(classifyRoute('/cockpit').section).toBe('cockpit');
    expect(classifyRoute('/apps').section).toBe('apps');
    expect(classifyRoute('/copilot').section).toBe('copilot');
    expect(classifyRoute('/brand-guidelines').section).toBe('brands');
    expect(classifyRoute('/my-brandings').section).toBe('brands');
    expect(classifyRoute('/settings/api-keys').section).toBe('profile');
    expect(classifyRoute('/developer/usage').section).toBe('profile');
  });

  it('ignora query e trailing slash', () => {
    expect(classifyRoute('/brand-guidelines?id=123').section).toBe('brands');
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

describe('routeMode', () => {
  it('retorna focus em editor e full em dashboard', () => {
    expect(routeMode('/mockupmachine')).toBe('focus');
    expect(routeMode('/cockpit')).toBe('full');
  });
});

describe('visibleSections', () => {
  it('esconde cockpit e copilot quando as flags estão off', () => {
    const ctx: NavCtx = { ...baseCtx, flags: { cockpit: false, copilot: false } };
    const ids = visibleSections(ctx).map((s) => s.id);
    expect(ids).not.toContain('cockpit');
    expect(ids).not.toContain('copilot');
    expect(ids).toContain('brands');
    expect(ids).toContain('apps');
  });

  it('mostra tudo com as flags on', () => {
    const ids = visibleSections(baseCtx).map((s) => s.id);
    expect(ids).toEqual(['cockpit', 'brands', 'copilot', 'apps']);
  });
});

describe('contextNavFor', () => {
  it('retorna [] em rota sem seção', () => {
    expect(contextNavFor('/canvas', baseCtx)).toEqual([]);
  });

  it('sub-nav de brands ganha o item guideline só com marca ativa', () => {
    const semMarca = contextNavFor('/brand-guidelines', baseCtx).map((i) => i.id);
    expect(semMarca).not.toContain('guideline');

    const comMarca = contextNavFor('/brand-guidelines', { ...baseCtx, activeBrandId: 'b1' });
    const guideline = comMarca.find((i) => i.id === 'guideline');
    expect(guideline?.to).toBe('/brand-guidelines?id=b1');
  });

  it('sub-nav de profile lista conta, uso, api-keys e connected-apps', () => {
    const ids = contextNavFor('/profile', baseCtx).map((i) => i.id);
    expect(ids).toEqual(['account', 'usage', 'api-keys', 'connected-apps']);
  });

  it('todas as seções de nível 1 têm labelKey sob nav.*', () => {
    for (const s of NAV_SECTIONS) {
      expect(s.labelKey.startsWith('nav.')).toBe(true);
    }
  });
});
