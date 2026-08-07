import { describe, it, expect } from 'vitest';
import { deriveTools } from '../tools/sync-mcp-registry.js';
import { generatePlatformMCPSpec } from '../mcp-gen.js';

// Derivar sobe um McpServer inteiro (~3s). Uma vez só, compartilhado entre os
// casos: seis construcoes disputavam CPU com o resto da suite sem ganhar nada.
let cached: ReturnType<typeof deriveTools> | null = null;
const tools = () => (cached ??= deriveTools());

/**
 * O registry de docs era escrito a mao ao lado do servidor MCP: a mesma lista,
 * duas vezes. Divergiu em 45 tools ausentes na doc, 3 falsos "obsoletos" e 17
 * descricoes diferentes — e nada falhava, porque documentacao desatualizada nao
 * quebra teste nenhum. Agora quebra.
 */
describe('platform MCP registry — derivado do runtime, nunca escrito a mao', () => {
  it('o JSON gerado cobre exatamente os tools registrados no servidor', async () => {
    const derived = await tools();
    const spec = generatePlatformMCPSpec();

    const inRuntime = derived.map((t) => t.name).sort();
    const inDocs = spec.tools.map((t) => t.name).sort();

    // Mensagem util no lugar de um diff de 131 strings.
    const missingInDocs = inRuntime.filter((n) => !inDocs.includes(n));
    const staleInDocs = inDocs.filter((n) => !inRuntime.includes(n));
    expect(
      { missingInDocs, staleInDocs },
      'rode `npm run mcp:sync` e commite server/lib/mcp-tools.generated.json'
    ).toEqual({ missingInDocs: [], staleInDocs: [] });
  });

  it('nenhuma descricao divergente entre runtime e doc', async () => {
    const derived = await tools();
    const spec = generatePlatformMCPSpec();
    const docs = new Map(spec.tools.map((t) => [t.name, t.description]));

    const drift = derived.filter((t) => docs.get(t.name) !== t.description).map((t) => t.name);

    expect(drift, 'rode `npm run mcp:sync`').toEqual([]);
  });

  it('toda tool tem descricao e schema — doc vazia e pior que doc ausente', async () => {
    const derived = await tools();
    expect(derived.length).toBeGreaterThan(100);

    const semDescricao = derived.filter((t) => !t.description?.trim()).map((t) => t.name);
    expect(semDescricao).toEqual([]);

    // `required` sem a propriedade correspondente faria o agente mandar campo
    // que a tool nao declara.
    const requiredOrfao = derived
      .filter((t) => t.required.some((r) => !(r in t.properties)))
      .map((t) => t.name);
    expect(requiredOrfao).toEqual([]);
  });

  it('as tools que o feedback apontou como invisiveis estao na doc publica', async () => {
    const spec = generatePlatformMCPSpec();
    const names = new Set(spec.tools.map((t) => t.name));
    for (const n of [
      'brand-guidelines-health-check',
      'brand-guidelines-compile',
      'brand-guidelines-export',
      'figma-extract-text',
      'brand-guidelines-figma-preview',
      'brand-guidelines-media-upload-urls',
      'brand-guidelines-media-commit',
    ]) {
      expect(names.has(n), `${n} deveria estar na doc publica`).toBe(true);
    }
  });

  it('marca como paga toda tool de escopo generate, e so ela', async () => {
    const derived = await tools();
    const pagas = derived.filter((t) => t.cost === 'credits').map((t) => t.name);

    expect(pagas).toContain('ai-generate-image');
    expect(pagas).toContain('mockup-generate');
    // Leitura nunca pode aparecer como paga: assusta o agente a nao chamar.
    expect(pagas).not.toContain('brand-guidelines-get');
    expect(pagas).not.toContain('brand-guidelines-list');
  });

  /**
   * `llms.txt` é a terceira cópia da lista — e é justamente a que os agentes
   * leem. O cabeçalho dela conta os tools dinamicamente (`getMcpToolCount()`)
   * enquanto o corpo era escrito à mão, então dizia "131 total" listando 122.
   *
   * A curadoria ali é editorial (agrupada por produto, com prosa por seção) e
   * vale mais que um dump gerado, então ela CONTINUA à mão. O que não pode é
   * omitir em silêncio: se uma tool nova não for documentada, isto quebra.
   */
  it('llms.txt menciona toda tool registrada', async () => {
    const { readFileSync } = await import('fs');
    const src = readFileSync('server/routes/llms.ts', 'utf-8');

    // No fonte os nomes vêm entre backticks escapados dentro do template literal.
    const mentioned = new Set<string>();
    for (const m of src.matchAll(/\\?`([a-z0-9]+(?:-[a-z0-9]+)+)\\?`/g)) mentioned.add(m[1]);

    const derived = await tools();
    const undocumented = derived.map((t) => t.name).filter((n) => !mentioned.has(n));

    expect(
      undocumented,
      'tool registrada mas ausente do llms.txt — documente na seção certa de server/routes/llms.ts'
    ).toEqual([]);
  });

  it('so as tools realmente publicas aparecem sem auth', async () => {
    const derived = await tools();
    const publicas = derived
      .filter((t) => !t.auth)
      .map((t) => t.name)
      .sort();
    expect(publicas).toEqual(['auth-login', 'auth-register', 'brand-guidelines-public']);
  });
});
