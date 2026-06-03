import { describe, it, expect } from 'vitest';
import { classifyIntent, isChatOnly } from '../prompt/classifier.js';
import { assemblePrompt } from '../prompt/index.js';
import { detectFormat, getFormatDimensions, buildPresetContext } from '../prompt/presets.js';
import { flattenNodesCompact, buildSelectionContext, buildContainersHint } from '../prompt/modules/context.js';
import { buildCompactBrandContext } from '../prompt/modules/brand.js';
import { buildToolsReference } from '../prompt/modules/tools-reference.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Shared fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const BRAND = {
  brandColors: [
    { name: 'Lava', value: '#D4491B', role: 'primary' },
    { name: 'Areia', value: '#F2EAD7', role: 'secondary' },
  ],
  brandFonts: {
    primary: { family: 'Bebas Neue', style: 'Regular', size: 48 },
    secondary: { family: 'Inter', style: 'Regular', size: 16 },
  },
  brandLogos: {
    light: { name: 'Logo Light', key: 'abc123' },
  },
};

const FRAME = { type: 'FRAME', id: '1:1', name: 'Card', width: 400, height: 300 };
const TEXT_NODE = { type: 'TEXT', id: '2:1', name: 'Title', characters: 'Hello World', fontSize: 24 };

// ═══════════════════════════════════════════════════════════════════════════════
// 1. classifyIntent — Primary intents
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyIntent — primary intents', () => {
  // CREATE
  it.each([
    'cria um post para instagram',
    'criar banner profissional',
    'faz um card bonito',
    'faça um layout moderno',
    'gera um design novo',
    'desenha um logo aqui',
    'monta um carrossel instagram',
    'adiciona um botão ao frame',
    'create a new slide presentation',
    'make a card for linkedin',
    'build a dashboard completo',
    'design a banner for youtube',
    'add a new section here',
    'generate a post facebook',
  ])('classifies "%s" as create', (cmd) => {
    expect(classifyIntent(cmd, false).intent).toBe('create');
  });

  // EDIT
  it.each([
    'edita esse frame agora',
    'muda a cor desse elemento',
    'altera a fonte do título',
    'troca o texto do card',
    'modifica o layout principal',
    'ajusta o tamanho do botão',
    'atualiza o título da seção',
    'edit this element here',
    'change the color to red',
    'modify the layout now',
    'update the text content',
    'adjust the font size',
    'fix the alignment issue',
  ])('classifies "%s" as edit', (cmd) => {
    expect(classifyIntent(cmd, false).intent).toBe('edit');
  });

  // CLONE
  it.each([
    'clona esse card aqui',
    'duplica esse frame inteiro',
    'copia esse elemento pra cá',
    'replica esse template todo',
    'clone this frame now',
    'duplicate this frame element',
  ])('classifies "%s" as clone', (cmd) => {
    expect(classifyIntent(cmd, false).intent).toBe('clone');
  });

  // DELETE
  it.each([
    'deleta esse frame agora',
    'remove esse elemento daqui',
    'apaga esse texto todo',
    'exclui isso daqui agora',
    'delete this frame now',
    'remove this element here',
    'erase this element please',
  ])('classifies "%s" as delete', (cmd) => {
    expect(classifyIntent(cmd, false).intent).toBe('delete');
  });

  // ARRANGE
  it.each([
    'organiza esses elementos todos',
    'alinha à esquerda esses frames',
    'distribui uniformemente os cards',
    'posiciona no centro da tela',
    'move pra direita esse botão',
    'centraliza tudo no frame',
    'arrange these elements now',
    'align left all items',
    'distribute evenly here',
    'center this element now',
  ])('classifies "%s" as arrange', (cmd) => {
    expect(classifyIntent(cmd, false).intent).toBe('arrange');
  });

  // PT-BR short action verbs → edit
  it.each([
    'escurece esse fundo todo',
    'clareia a imagem principal',
    'aumenta a fonte do título',
    'diminui o espaçamento vertical',
    'agrupa esses elementos todos',
  ])('classifies PT-BR action verb "%s" as edit', (cmd) => {
    expect(classifyIntent(cmd, true).intent).toBe('edit');
  });

  // PT-BR color/size adjectives → edit
  it.each([
    'vermelho esse fundo',
    'azul esse texto',
    'branco esse card',
  ])('classifies PT-BR adjective "%s" as edit', (cmd) => {
    expect(classifyIntent(cmd, true).intent).toBe('edit');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. classifyIntent — Secondary intents
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyIntent — secondary intents', () => {
  it('mixed clone+edit command includes both intents', () => {
    const r = classifyIntent('clona esse card e muda as cores', true);
    const intents = [r.intent, r.secondaryIntent].filter(Boolean);
    expect(intents).toContain('edit');
  });

  it('mixed create+edit command includes both intents', () => {
    const r = classifyIntent('cria um card e edita o texto do título', false);
    const intents = [r.intent, r.secondaryIntent].filter(Boolean);
    expect(intents).toContain('create');
    expect(intents).toContain('edit');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. classifyIntent — Flags
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyIntent — flags', () => {
  it('hasSelection=true when elements present', () => {
    expect(classifyIntent('qualquer coisa', true).hasSelection).toBe(true);
  });

  it('hasSelection=false with no selection', () => {
    expect(classifyIntent('cria um banner profissional', false).hasSelection).toBe(false);
  });

  it('isTemplate=true for template keywords', () => {
    expect(classifyIntent('usa o template do card', false).isTemplate).toBe(true);
    expect(classifyIntent('usa o modelo principal', false).isTemplate).toBe(true);
    expect(classifyIntent('[Template] Card Layout', false).isTemplate).toBe(true);
  });

  it('isChart=true for chart keywords', () => {
    expect(classifyIntent('cria um gráfico de barras', false).isChart).toBe(true);
    expect(classifyIntent('make a pie chart here', false).isChart).toBe(true);
    expect(classifyIntent('dashboard com dados reais', false).isChart).toBe(true);
    expect(classifyIntent('cria uma visualização de dados', false).isChart).toBe(true);
  });

  it('isColorSpec=true for color spec keywords', () => {
    expect(classifyIntent('gera a paleta com hex e cmyk', false).isColorSpec).toBe(true);
  });

  it('needsDimensions=true for unknown format create with banner/poster', () => {
    const r = classifyIntent('cria um banner profissional', false);
    expect(r.intent).toBe('create');
    expect(r.format).toBe('unknown');
    expect(r.needsDimensions).toBe(true);
  });

  it('needsDimensions=false when format is known', () => {
    const r = classifyIntent('cria um post instagram feed', false);
    expect(r.needsDimensions).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. classifyIntent — Complexity
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyIntent — complexity', () => {
  it('simple for "simples" / "basico" keywords', () => {
    expect(classifyIntent('cria card simples pra instagram', false).complexity).toBe('simple');
    expect(classifyIntent('faz post basico pro linkedin', false).complexity).toBe('simple');
  });

  it('complex for quantity+items or system keywords', () => {
    expect(classifyIntent('cria 5 slides de carrossel', false).complexity).toBe('complex');
    expect(classifyIntent('faz 3 cards completos pro feed', false).complexity).toBe('complex');
    expect(classifyIntent('cria dashboard detalhado pro time', false).complexity).toBe('complex');
  });

  it('medium when no complexity keyword matches', () => {
    expect(classifyIntent('cria post profissional pro instagram feed', false).complexity).toBe('medium');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. classifyIntent — Confidence
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyIntent — confidence', () => {
  it('0.65 for one keyword match', () => {
    const r = classifyIntent('cria algo bonito aqui', false);
    expect(r.confidence).toBe(0.65);
  });

  it('+0.2 bonus for known format', () => {
    const r = classifyIntent('cria um post instagram feed', false);
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('capped at 0.95', () => {
    const r = classifyIntent('cria e faz e gera e desenha e adiciona para instagram stories', false);
    expect(r.confidence).toBeLessThanOrEqual(0.95);
  });

  it('higher confidence with known format', () => {
    const noFormat = classifyIntent('cria algo aqui', false);
    const withFormat = classifyIntent('cria algo pro instagram feed', false);
    expect(withFormat.confidence).toBeGreaterThan(noFormat.confidence);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. isChatOnly
// ═══════════════════════════════════════════════════════════════════════════════

describe('isChatOnly', () => {
  // Greetings
  it.each(['oi', 'olá', 'hello', 'hey', 'bom dia', 'boa tarde', 'boa noite', 'e ai'])('detects greeting "%s" as chat', (msg) => {
      expect(isChatOnly(msg)).toBe(true);
    });

  // Questions without design intent
  it.each([
    'como funciona o auto-layout?',
    'me explica a diferença entre kerning e tracking',
    'voce pode me ajudar a entender isso?',
  ])('detects question "%s" as chat', (msg) => {
    expect(isChatOnly(msg)).toBe(true);
  });

  // Short messages
  it.each(['ok', 'sim', 'não', 'hmm', 'ah'])('detects short "%s" as chat', (msg) => {
      expect(isChatOnly(msg)).toBe(true);
    });

  // Design commands must NOT be chat
  it.each([
    'cria um post bonito',
    'muda a cor desse frame',
    'delete this frame now',
    'clona esse card aqui',
  ])('does NOT flag "%s" as chat', (msg) => {
    expect(isChatOnly(msg)).toBe(false);
  });

  // Short action patterns override short-message rule
  it.each(['bold', 'red', 'center', 'dark mode', 'escurece', 'maior'])('short action "%s" is NOT chat', (msg) => {
      expect(isChatOnly(msg)).toBe(false);
    });

  // Questions WITH design intent
  it('question with create verb is not chat', () => {
    expect(isChatOnly('como cria um post bonito?')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. detectFormat
// ═══════════════════════════════════════════════════════════════════════════════

describe('detectFormat', () => {
  it.each([
    ['post instagram', 'instagram_feed'],
    ['stories', 'instagram_stories'],
    ['reels', 'instagram_stories'],
    ['instagram vertical', 'instagram_portrait'],
    ['destaque', 'instagram_highlight'],
    ['youtube thumbnail', 'youtube_thumbnail'],
    ['linkedin', 'linkedin_post'],
    ['facebook', 'facebook_post'],
    ['tweet', 'twitter_post'],
    ['tiktok', 'tiktok'],
    ['pinterest', 'pinterest'],
    ['slide', 'slide_16_9'],
    ['apresentação', 'slide_16_9'],
    ['4:3', 'slide_4_3'],
    ['deck', 'slide_16_9'],
  ] as const)('detects "%s" as %s', (input, expected) => {
    expect(detectFormat(input)).toBe(expected);
  });

  it('returns unknown for unrecognized', () => {
    expect(detectFormat('something random')).toBe('unknown');
  });

  it('handles accented characters', () => {
    expect(detectFormat('apresentação')).toBe('slide_16_9');
  });
});

describe('getFormatDimensions', () => {
  it('returns correct dimensions for instagram_feed', () => {
    expect(getFormatDimensions('instagram_feed')).toEqual({ width: 1080, height: 1080 });
  });

  it('returns null for unknown', () => {
    expect(getFormatDimensions('unknown')).toBeNull();
  });
});

describe('buildPresetContext', () => {
  it('includes dimensions for known format', () => {
    expect(buildPresetContext('instagram_feed')).toContain('1080x1080');
  });

  it('asks user for unknown format', () => {
    expect(buildPresetContext('unknown')).toMatch(/PERGUNTE/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Selection context (flattenNodesCompact, buildSelectionContext)
// ═══════════════════════════════════════════════════════════════════════════════

describe('flattenNodesCompact', () => {
  it('includes node name, type, id', () => {
    const lines = flattenNodesCompact([{ name: 'Card', type: 'FRAME', id: '1:1' }]);
    expect(lines[0]).toContain('"Card"');
    expect(lines[0]).toContain('FRAME');
    expect(lines[0]).toContain('1:1');
  });

  it('includes dimensions', () => {
    const lines = flattenNodesCompact([{ name: 'Box', type: 'FRAME', id: '1:1', width: 200, height: 100 }]);
    expect(lines[0]).toContain('200x100');
  });

  it('includes position for root-level nodes', () => {
    const lines = flattenNodesCompact([{ name: 'A', type: 'FRAME', id: '1:1', x: 50, y: 100 }]);
    expect(lines[0]).toContain('pos:50,100');
  });

  it('includes fill color', () => {
    const node = { name: 'Bg', type: 'RECTANGLE', id: '1:1', fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] };
    const lines = flattenNodesCompact([node]);
    expect(lines[0]).toContain('fill:#ff0000');
  });

  it('includes fontSize for text nodes', () => {
    const lines = flattenNodesCompact([{ name: 'T', type: 'TEXT', id: '1:1', fontSize: 24 }]);
    expect(lines[0]).toContain('fs:24');
  });

  it('includes componentKey', () => {
    const lines = flattenNodesCompact([{ name: 'Btn', type: 'INSTANCE', id: '1:1', componentKey: 'key-abc' }]);
    expect(lines[0]).toContain('key:"key-abc"');
  });

  it('includes corner radius', () => {
    const lines = flattenNodesCompact([{ name: 'Card', type: 'FRAME', id: '1:1', cornerRadius: 12 }]);
    expect(lines[0]).toContain('r:12');
  });

  it('includes opacity', () => {
    const lines = flattenNodesCompact([{ name: 'Overlay', type: 'FRAME', id: '1:1', opacity: 0.5 }]);
    expect(lines[0]).toContain('op:0.5');
  });

  it('includes layout mode', () => {
    const lines = flattenNodesCompact([{ name: 'Col', type: 'FRAME', id: '1:1', layoutMode: 'VERTICAL' }]);
    expect(lines[0]).toContain('layout:VERTICAL');
  });

  it('includes strokes', () => {
    const node = {
      name: 'Box', type: 'FRAME', id: '1:1',
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: 2,
    };
    const lines = flattenNodesCompact([node]);
    expect(lines[0]).toContain('stroke:#000000/2px');
  });

  it('includes effects', () => {
    const node = { name: 'Card', type: 'FRAME', id: '1:1', effects: [{ type: 'DROP_SHADOW' }] };
    const lines = flattenNodesCompact([node]);
    expect(lines[0]).toContain('fx:DROP_SHADOW');
  });

  it('includes truncated text content', () => {
    const lines = flattenNodesCompact([{ name: 'T', type: 'TEXT', id: '1:1', characters: 'Hello World' }]);
    expect(lines[0]).toContain('"Hello World...');
  });

  it('flattens children with indentation', () => {
    const parent = {
      name: 'Frame', type: 'FRAME', id: '1:1',
      children: [{ name: 'Child', type: 'TEXT', id: '2:1' }],
    };
    const lines = flattenNodesCompact([parent]);
    expect(lines.length).toBe(2);
    expect(lines[1]).toMatch(/^\s+"Child"/);
  });

  it('respects maxDepth', () => {
    const deep = {
      name: 'L0', type: 'FRAME', id: '1:1',
      children: [{
        name: 'L1', type: 'FRAME', id: '2:1',
        children: [{ name: 'L2', type: 'TEXT', id: '3:1' }],
      }],
    };
    const lines = flattenNodesCompact([deep], 0, 1);
    expect(lines.length).toBe(2); // L0 + L1 only
  });
});

describe('buildSelectionContext', () => {
  it('returns empty message when no elements', () => {
    expect(buildSelectionContext([])).toContain('Nenhum elemento');
  });

  it('includes header and node info', () => {
    const ctx = buildSelectionContext([FRAME]);
    expect(ctx).toContain('SELECAO');
    expect(ctx).toContain('Card');
  });

  it('truncates at maxElements', () => {
    const elements = Array.from({ length: 25 }, (_, i) => ({ ...FRAME, id: `${i}:1`, name: `E${i}` }));
    const ctx = buildSelectionContext(elements, 20);
    expect(ctx).toContain('+5 elementos');
  });

  it('uses custom label for scanPage', () => {
    const ctx = buildSelectionContext([FRAME], 20, 'SCAN COMPLETO');
    expect(ctx).toContain('SCAN COMPLETO');
  });
});

describe('buildContainersHint', () => {
  it('lists containers', () => {
    const ctx = buildContainersHint([FRAME]);
    expect(ctx).toContain('CONTAINERS');
    expect(ctx).toContain('Card');
    expect(ctx).toContain('1:1');
  });

  it('returns "nenhum" for non-container types', () => {
    const ctx = buildContainersHint([TEXT_NODE]);
    expect(ctx).toContain('Nenhum');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Brand context
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildCompactBrandContext', () => {
  it('includes colors', () => {
    const ctx = buildCompactBrandContext(BRAND.brandColors);
    expect(ctx).toContain('Lava');
    expect(ctx).toContain('#D4491B');
  });

  it('includes fonts', () => {
    const ctx = buildCompactBrandContext(undefined, BRAND.brandFonts);
    expect(ctx).toContain('Bebas Neue');
  });

  it('includes logo keys', () => {
    const ctx = buildCompactBrandContext(undefined, undefined, BRAND.brandLogos);
    expect(ctx).toContain('abc123');
  });

  it('includes tokens', () => {
    const tokens = { spacing: { sm: 8, md: 16 }, radius: { sm: 4 } };
    const ctx = buildCompactBrandContext(undefined, undefined, undefined, tokens);
    expect(ctx).toContain('sm:8');
    expect(ctx).toContain('sm:4');
  });

  it('returns empty for no brand data', () => {
    const ctx = buildCompactBrandContext();
    expect(ctx).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Tools reference
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildToolsReference', () => {
  it('includes CREATE_FRAME for create intent', () => {
    expect(buildToolsReference('create')).toContain('CREATE_FRAME');
  });

  it('includes SET_IMAGE_FILL for edit intent', () => {
    expect(buildToolsReference('edit')).toContain('SET_IMAGE_FILL');
  });

  it('includes DELETE_NODE for delete intent', () => {
    expect(buildToolsReference('delete')).toContain('DELETE_NODE');
  });

  it('full intent includes all categories', () => {
    const ref = buildToolsReference('full');
    expect(ref).toContain('CREATE_FRAME');
    expect(ref).toContain('DELETE_NODE');
    expect(ref).toContain('SET_IMAGE_FILL');
  });

  it('create intent includes creation tools', () => {
    const ref = buildToolsReference('create');
    expect(ref).toContain('CREATE_TEXT');
    expect(ref).toContain('CREATE_RECTANGLE');
    expect(ref).toContain('CREATE_COMPONENT_INSTANCE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. assemblePrompt — Core module injection
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — core modules', () => {
  it('always includes core, golden_rules, tools for design commands', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', ...BRAND });
    expect(r.modules).toContain('core');
    expect(r.modules).toContain('golden_rules');
    expect(r.modules).toContain('tools');
  });

  it('returns positive token estimate', () => {
    const r = assemblePrompt({ command: 'cria um banner profissional', ...BRAND });
    expect(r.tokenEstimate).toBeGreaterThan(0);
  });

  it('greeting returns chat_only only', () => {
    const r = assemblePrompt({ command: 'oi tudo bem' });
    expect(r.modules).toContain('chat_only');
    expect(r.intent.intent).toBe('chat');
    expect(r.modules).not.toContain('core');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. assemblePrompt — Intent-specific modules
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — intent modules', () => {
  it('create injects create_rules', () => {
    const r = assemblePrompt({ command: 'cria um post para instagram', ...BRAND });
    expect(r.modules).toContain('create_rules');
  });

  it('complex create injects design_excellence and multi_frames', () => {
    const r = assemblePrompt({ command: 'cria 5 slides de carrossel completo', ...BRAND });
    expect(r.modules).toContain('multi_frames');
    expect(r.modules).toContain('sexy_design');
  });

  it('simple create does NOT inject design_excellence', () => {
    const r = assemblePrompt({ command: 'cria um card simples pro instagram', ...BRAND });
    expect(r.modules).not.toContain('sexy_design');
  });

  it('edit injects edit_rules', () => {
    const r = assemblePrompt({
      command: 'muda a cor do fundo',
      selectedElements: [FRAME],
      ...BRAND,
    });
    expect(r.modules).toContain('edit_rules');
  });

  it('edit with text nodes injects text_warning', () => {
    const r = assemblePrompt({
      command: 'muda a fonte do texto',
      selectedElements: [TEXT_NODE],
    });
    expect(r.modules).toContain('text_warning');
  });

  it('edit with text inside frame also injects text_warning', () => {
    const r = assemblePrompt({
      command: 'muda o layout do frame',
      selectedElements: [{ ...FRAME, children: [TEXT_NODE] }],
    });
    expect(r.modules).toContain('text_warning');
  });

  it('delete injects delete_rules', () => {
    const r = assemblePrompt({ command: 'apaga esse frame aqui', selectedElements: [FRAME] });
    expect(r.modules).toContain('delete_rules');
  });

  it('arrange injects arrange_rules', () => {
    const r = assemblePrompt({ command: 'centraliza todos os elementos', selectedElements: [FRAME] });
    expect(r.modules).toContain('arrange_rules');
  });

  it('chart keywords inject chart_rules and chart_example', () => {
    const r = assemblePrompt({ command: 'cria um gráfico de barras pro dashboard' });
    expect(r.modules).toContain('chart_rules');
    expect(r.modules).toContain('chart_example');
  });

  it('color spec keywords inject color_spec', () => {
    const r = assemblePrompt({ command: 'gera paleta com hex e cmyk das cores' });
    expect(r.modules).toContain('color_spec');
  });

  it('template keywords inject template_rules', () => {
    const r = assemblePrompt({ command: 'clona o template do card' });
    expect(r.modules).toContain('template_rules');
    expect(r.modules).toContain('template_example');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. assemblePrompt — Brand context
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — brand', () => {
  it('includes brand module with font family', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', ...BRAND });
    expect(r.modules).toContain('brand');
    expect(r.system).toContain('Bebas Neue');
  });

  it('includes brand colors', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', ...BRAND });
    expect(r.system).toContain('#D4491B');
  });

  it('includes logo key', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', ...BRAND });
    expect(r.system).toContain('abc123');
  });

  it('useBrand=false injects brand_disabled', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', useBrand: false, ...BRAND });
    expect(r.modules).toContain('brand_disabled');
    expect(r.modules).not.toContain('brand');
  });

  it('brand_disabled mentions generic styles', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', useBrand: false });
    expect(r.system).toMatch(/genéric/i);
  });

  it('no brand data = no brand module', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram' });
    expect(r.modules).not.toContain('brand');
  });

  it('brand voice/dos/donts included', () => {
    const r = assemblePrompt({
      command: 'cria um post pro instagram',
      brandColors: BRAND.brandColors,
      brandVoice: 'Confident and bold',
      brandDos: ['Use active voice'],
      brandDonts: ['Avoid jargon'],
    });
    expect(r.system).toContain('Confident and bold');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. assemblePrompt — Selection & containers
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — selection context', () => {
  it('injects selection and containers with elements', () => {
    const r = assemblePrompt({ command: 'edita esse frame agora', selectedElements: [FRAME] });
    expect(r.modules).toContain('selection');
    expect(r.modules).toContain('containers');
    expect(r.system).toContain('Card');
    expect(r.system).toContain('1:1');
  });

  it('scanPage with no elements shows empty page message', () => {
    const r = assemblePrompt({ command: 'cria algo novo no canvas', scanPage: true, selectedElements: [] });
    expect(r.system).toContain('vazia');
  });

  it('scanPage with elements uses custom label', () => {
    const r = assemblePrompt({ command: 'edita o layout todo', scanPage: true, selectedElements: [FRAME] });
    expect(r.system).toContain('TODOS OS ELEMENTOS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. assemblePrompt — Route-level contexts (consolidated)
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — route contexts', () => {
  it('templateContext injects scanned_templates + triggers template_rules', () => {
    const r = assemblePrompt({ command: 'usa esse card pra criar', templateContext: '## TEMPLATES\n- Card' });
    expect(r.modules).toContain('scanned_templates');
    expect(r.modules).toContain('template_rules');
    expect(r.system).toContain('## TEMPLATES');
  });

  it('agentComponentsContext injects scanned_agent_components', () => {
    const r = assemblePrompt({ command: 'cria um banner bonito', agentComponentsContext: '## AGENT COMPONENTS\n- Button' });
    expect(r.modules).toContain('scanned_agent_components');
    expect(r.system).toContain('Button');
  });

  it('enforcedTokens injects enforced_tokens module', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', enforcedTokens: 'ENFORCED: #FF0000' });
    expect(r.modules).toContain('enforced_tokens');
    expect(r.system).toContain('#FF0000');
  });

  it('brandChoiceContext injects brand_choice', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', brandChoiceContext: 'Escolha: A ou B' });
    expect(r.modules).toContain('brand_choice');
    expect(r.system).toContain('Escolha: A ou B');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. assemblePrompt — Components & design system
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — components & design system', () => {
  it('components list includes CREATE_COMPONENT_INSTANCE instruction', () => {
    const r = assemblePrompt({
      command: 'cria um card pro instagram',
      availableComponents: [{ name: 'Button', key: 'btn-123' }],
    });
    expect(r.modules).toContain('components');
    expect(r.system).toMatch(/CREATE_COMPONENT_INSTANCE/);
    expect(r.system).toContain('btn-123');
  });

  it('components capped at 20', () => {
    const comps = Array.from({ length: 30 }, (_, i) => ({ name: `Comp${i}`, key: `k${i}` }));
    const r = assemblePrompt({ command: 'cria um banner profissional', availableComponents: comps });
    expect(r.system).toContain('Comp19');
    expect(r.system).not.toContain('Comp20');
  });

  it('designSystem tokens are injected', () => {
    const r = assemblePrompt({
      command: 'cria um layout pro instagram',
      designSystem: { name: 'MyDS', version: '2.0', spacing: { sm: 8, md: 16 }, radius: { sm: 4 } },
    });
    expect(r.modules).toContain('design_system');
    expect(r.system).toContain('MyDS');
    expect(r.system).toContain('sm:8px');
    expect(r.system).toContain('sm:4px');
  });

  it('color variables are injected', () => {
    const r = assemblePrompt({
      command: 'cria um post pro instagram',
      colorVariables: [{ id: 'v:1', name: 'Primary', value: '#FF0000' }],
    });
    expect(r.modules).toContain('color_vars');
    expect(r.system).toContain('Primary');
    expect(r.system).toContain('APPLY_VARIABLE');
  });

  it('font variables are injected', () => {
    const r = assemblePrompt({
      command: 'cria um post pro instagram',
      fontVariables: [{ id: 'fv:1', name: 'Heading Font' }],
    });
    expect(r.modules).toContain('font_vars');
    expect(r.system).toContain('Heading Font');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. assemblePrompt — Format presets
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — format presets', () => {
  it('known format injects preset module with dimensions', () => {
    const r = assemblePrompt({ command: 'cria um post instagram feed' });
    expect(r.modules).toContain('preset');
    expect(r.system).toContain('1080x1080');
  });

  it('unknown format with needsDimensions injects ask_dimensions', () => {
    const r = assemblePrompt({ command: 'cria um banner profissional' });
    expect(r.modules).toContain('ask_dimensions');
    expect(r.system).toMatch(/PERGUNTE|Formato desconhecido/i);
  });

  it('stories format gets correct dimensions', () => {
    const r = assemblePrompt({ command: 'cria um stories pro instagram' });
    expect(r.system).toContain('1080x1920');
  });

  it('youtube format gets correct dimensions', () => {
    const r = assemblePrompt({ command: 'cria thumbnail pro youtube' });
    expect(r.system).toContain('1280x720');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. assemblePrompt — Think mode & error feedback
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — think mode & feedback', () => {
  it('thinkMode injects full think_mode module with two phases', () => {
    const r = assemblePrompt({ command: 'cria um banner profissional', thinkMode: true, ...BRAND });
    expect(r.modules).toContain('think_mode');
    expect(r.system).toMatch(/PHASE|FASE/i);
    expect(r.system).toMatch(/MESSAGE/);
  });

  it('previousErrors inject feedback module', () => {
    const r = assemblePrompt({
      command: 'cria um post pro instagram',
      previousErrors: ['SET_PROPERTIES not valid', 'Missing width'],
    });
    expect(r.modules).toContain('feedback');
    expect(r.system).toContain('SET_PROPERTIES not valid');
    expect(r.system).toContain('Missing width');
  });

  it('previousErrors capped at 5', () => {
    const errors = Array.from({ length: 10 }, (_, i) => `Error ${i}`);
    const r = assemblePrompt({ command: 'cria um post pro instagram', previousErrors: errors });
    expect(r.system).toContain('Error 4');
    expect(r.system).not.toContain('Error 5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. assemblePrompt — Chat history & attachments
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — history & attachments', () => {
  it('chatHistory injects history module', () => {
    const r = assemblePrompt({
      command: 'continua o design anterior',
      chatHistory: '[USER]: faz um card bonito\n[ASSISTANT]: ok feito',
    });
    expect(r.modules).toContain('history');
    expect(r.system).toContain('faz um card bonito');
  });

  it('attachments inject attachments module', () => {
    const r = assemblePrompt({
      command: 'usa essa imagem no banner',
      attachments: [{ name: 'logo.png', mimeType: 'image/png' }],
    });
    expect(r.modules).toContain('attachments');
    expect(r.system).toContain('logo.png');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. assemblePrompt — Module priority ordering
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — priority ordering', () => {
  it('think_mode (99) appears before golden_rules (96) in modules', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', thinkMode: true, ...BRAND });
    const thinkIdx = r.modules.indexOf('think_mode');
    const goldenIdx = r.modules.indexOf('golden_rules');
    expect(thinkIdx).toBeLessThan(goldenIdx);
  });

  it('feedback (98) appears before tools (97)', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', previousErrors: ['err'] });
    const feedbackIdx = r.modules.indexOf('feedback');
    const toolsIdx = r.modules.indexOf('tools');
    expect(feedbackIdx).toBeLessThan(toolsIdx);
  });

  it('core (100) appears first in non-chat prompts', () => {
    const r = assemblePrompt({ command: 'cria um post pro instagram', ...BRAND });
    expect(r.modules[0]).toBe('core');
  });

  it('selection (95) appears before brand (85)', () => {
    const r = assemblePrompt({
      command: 'edita esse frame agora',
      selectedElements: [FRAME],
      ...BRAND,
    });
    const selIdx = r.modules.indexOf('selection');
    const brandIdx = r.modules.indexOf('brand');
    expect(selIdx).toBeLessThan(brandIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. assemblePrompt — Golden rules content
// ═══════════════════════════════════════════════════════════════════════════════

describe('assemblePrompt — golden rules content', () => {
  const r = assemblePrompt({ command: 'cria um post pro instagram', ...BRAND });

  it('warns about SET_PROPERTIES not existing', () => {
    expect(r.system).toMatch(/SET_PROPERTIES/);
  });

  it('lists valid fontStyle values', () => {
    expect(r.system).toMatch(/fontStyle/);
    expect(r.system).toMatch(/Regular|Bold|Medium/);
  });

  it('mentions APPLY_VARIABLE limitation', () => {
    expect(r.system).toMatch(/APPLY_VARIABLE/);
  });

  it('includes shadow guidelines', () => {
    expect(r.system).toMatch(/DROP_SHADOW/);
  });

  it('includes auto-layout vs NONE distinction', () => {
    expect(r.system).toMatch(/layoutMode/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. Regression guards
// ═══════════════════════════════════════════════════════════════════════════════

describe('regressions', () => {
  it('design_excellence does NOT contain blob/ellipse/blur rules', async () => {
    const { DESIGN_EXCELLENCE_RULES } = await import('../prompt/modules/design-excellence.js');
    expect(DESIGN_EXCELLENCE_RULES).not.toMatch(/blob/i);
    expect(DESIGN_EXCELLENCE_RULES).not.toMatch(/CREATE_ELLIPSE/);
    expect(DESIGN_EXCELLENCE_RULES).not.toMatch(/LAYER_BLUR.*fundo/i);
  });

  it('brand priority rule mentions CREATE_COMPONENT_INSTANCE for logos', async () => {
    const { BRAND_PRIORITY_RULE } = await import('../prompt/modules/brand.js');
    expect(BRAND_PRIORITY_RULE).toContain('CREATE_COMPONENT_INSTANCE');
  });

  it('edit rules content includes color variable tools', async () => {
    const { EDIT_RULES } = await import('../prompt/modules/edit.js');
    expect(EDIT_RULES).toMatch(/BIND_NEAREST_COLOR_VARIABLES|CREATE_COLOR_VARIABLES/);
  });

  it('golden rules warn about non-existent SET_PROPERTIES', async () => {
    const { GOLDEN_RULES } = await import('../prompt/modules/golden-rules.js');
    expect(GOLDEN_RULES).toMatch(/SET_PROPERTIES/);
  });

  it('think mode rules have two-phase structure', async () => {
    const { THINK_MODE_RULES } = await import('../prompt/modules/golden-rules.js');
    expect(THINK_MODE_RULES.length).toBeGreaterThan(100);
    expect(THINK_MODE_RULES).toMatch(/MESSAGE/);
  });
});
