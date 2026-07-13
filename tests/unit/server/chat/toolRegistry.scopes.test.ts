import { describe, it, expect } from 'vitest';
import { getChatTools, listChatTools } from '../../../../server/services/chat/toolRegistry.js';

const PAID_TOOLS = ['generate_or_update_mockup', 'propose_creative_plan', 'generate_in_figma'];

function toolNames(tools: Array<{ functionDeclarations: any[] }>): string[] {
  return tools.flatMap((t) => t.functionDeclarations.map((d: any) => d.name));
}

describe('toolRegistry scopes (public | paid | admin)', () => {
  it('promotes the 3 agency tools to paid scope', () => {
    const scopes = Object.fromEntries(listChatTools().map((t) => [t.name, t.scope]));
    for (const name of PAID_TOOLS) {
      expect(scopes[name], name).toBe('paid');
    }
  });

  it('free user (public only) does NOT receive paid tools', () => {
    const names = toolNames(getChatTools({ isAdmin: false, isSubscriber: false }));
    for (const name of PAID_TOOLS) {
      expect(names).not.toContain(name);
    }
    expect(names).toContain('get_brand_context');
  });

  it('active subscriber receives public + paid tools', () => {
    const names = toolNames(getChatTools({ isAdmin: false, isSubscriber: true }));
    for (const name of PAID_TOOLS) {
      expect(names).toContain(name);
    }
    expect(names).toContain('get_brand_context');
  });

  it('admin receives everything (superset)', () => {
    const adminNames = toolNames(getChatTools({ isAdmin: true }));
    const all = listChatTools().map((t) => t.name);
    expect(adminNames.sort()).toEqual(all.sort());
  });

  it('boolean back-compat: getChatTools(true) === admin, getChatTools(false) === public only', () => {
    const asAdmin = toolNames(getChatTools(true));
    const asFree = toolNames(getChatTools(false));
    expect(asAdmin).toEqual(toolNames(getChatTools({ isAdmin: true })));
    for (const name of PAID_TOOLS) {
      expect(asAdmin).toContain(name);
      expect(asFree).not.toContain(name);
    }
  });
});
