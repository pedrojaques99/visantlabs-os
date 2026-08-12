/**
 * Deriva o registry de docs (`PLATFORM_TOOLS`) do servidor MCP real.
 *
 * Por que existe: `server/mcp/platform-mcp.ts` (runtime) e `server/lib/mcp-gen.ts`
 * (registry que alimenta as docs publicas e o llms.txt) mantinham a MESMA lista
 * escrita duas vezes, a mao. Em 2026-08-05 tinham divergido em 45 tools ausentes
 * no registry, 3 obsoletas e 17 descricoes diferentes — ou seja, 45 tools que
 * existem e a documentacao nao menciona. Doc mentindo por omissao.
 *
 * O runtime passa a ser a UNICA fonte: este script le os tools registrados,
 * converte o shape zod em JSON Schema (zod 4 faz nativo) e escreve
 * `server/lib/mcp-tools.generated.json`, que o mcp-gen importa.
 *
 * Uso:
 *   npx tsx server/lib/tools/sync-mcp-registry.ts          # reescreve o arquivo gerado
 *   npx tsx server/lib/tools/sync-mcp-registry.ts --check   # falha se estiver desatualizado (CI)
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(ROOT, 'server/lib/mcp-tools.generated.json');

export type ToolCost = 'free' | 'credits';

export interface GeneratedTool {
  name: string;
  description: string;
  required: string[];
  properties: Record<string, unknown>;
  cost: ToolCost;
  category: string;
  auth: boolean;
}

/**
 * Tools que respondem sem credencial. Tudo o mais exige auth — e o default
 * seguro e `true`: marcar uma tool autenticada como publica na doc convida o
 * agente a tentar sem token e tomar 401.
 */
const PUBLIC_TOOLS = new Set(['auth-register', 'auth-login', 'brand-guidelines-public']);

/**
 * Categoria derivada do prefixo do nome. Ordem importa: o primeiro match vence,
 * entao prefixos mais especificos vem antes (brand-guidelines antes de brand).
 */
const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/^auth-/, 'auth'],
  [/^(account|api-key|oauth|payments|settings)-/, 'account'],
  [/^brand-guidelines-|^figma-(extract|templates|preset)/, 'brand-guidelines'],
  [/^brand(ing)?-/, 'branding'],
  [/^mockup|^psd-/, 'mockups'],
  [/^canvas-/, 'canvas'],
  [/^budget-/, 'budget'],
  [/^community-/, 'community'],
  [/^moodboard-/, 'moodboard'],
  [/^reference-/, 'references'],
  [/^creative-/, 'branding'],
  [/^campaign-/, 'branding'],
  [/^playground-/, 'ai'],
  [/^studio3d|studio3d-scene$|-studio3d-scene$/, 'ai'],
  [/^(ai|image|video|smart|document|images|pdf|upload)-/, 'ai'],
];

function categoryFor(name: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(name)) return cat;
  return 'ai';
}

/** Converte o shape zod registrado no `server.tool` em JSON Schema. */
function schemaFor(inputSchema: unknown): {
  properties: Record<string, unknown>;
  required: string[];
} {
  if (!inputSchema) return { properties: {}, required: [] };
  try {
    // O SDK guarda um ZodMiniObject (zod/v4-mini), que NAO e `instanceof
    // z.ZodType` do zod classico — checar por `instanceof` mandava o schema
    // inteiro pro branch de "shape cru" e produzia lixo. Ambos compartilham o
    // core do zod 4, entao `.def` e o discriminador confiavel e o
    // `z.toJSONSchema` aceita os dois.
    const s = inputSchema as any;
    const obj = s.def || s._def ? s : z.object(inputSchema as z.ZodRawShape);
    const json = z.toJSONSchema(obj, { io: 'input', unrepresentable: 'any' }) as any;
    return {
      properties: json?.properties ?? {},
      required: Array.isArray(json?.required) ? json.required : [],
    };
  } catch (err) {
    throw new Error(`Falha ao converter schema: ${(err as Error).message}`);
  }
}

export async function deriveTools(): Promise<GeneratedTool[]> {
  const { createPlatformMcpServer, scopeForTool } = await import('../../mcp/platform-mcp.js');
  const server = createPlatformMcpServer() as any;
  const registered = server._registeredTools;

  if (!registered || typeof registered !== 'object') {
    throw new Error(
      'Nao consegui ler `_registeredTools` do McpServer. O SDK mudou de shape — ' +
        'atualize este script em vez de reescrever o registry a mao.'
    );
  }

  const tools: GeneratedTool[] = Object.entries(registered).map(([name, def]: [string, any]) => {
    const { properties, required } = schemaFor(def.inputSchema);
    const scope = scopeForTool(name);
    return {
      name,
      description: String(def.description || ''),
      required,
      properties,
      // Escopo `generate` e exatamente o conjunto que consome credito.
      cost: scope === 'generate' ? 'credits' : 'free',
      category: categoryFor(name),
      auth: !PUBLIC_TOOLS.has(name),
    };
  });

  tools.sort((a, b) => a.name.localeCompare(b.name));
  return tools;
}

/**
 * Serializa JA no estilo do Prettier.
 *
 * O `format:check` do CI varre `**\/*.json`, e o gerado entra nessa conta: com
 * `JSON.stringify` cru, os dois portoes se contradiziam — `mcp:sync --check`
 * exigia a saida do stringify, o `format:check` exigia a do Prettier, e nao
 * havia arquivo que passasse nos dois. Ficou vermelho em main sem ninguem ter
 * escrito nada errado.
 */
async function serialize(tools: GeneratedTool[]): Promise<string> {
  const raw = JSON.stringify(
    {
      $comment:
        'GERADO por scripts/sync-mcp-registry.ts a partir de server/mcp/platform-mcp.ts. NAO EDITE A MAO — rode `npm run mcp:sync`.',
      generatedFrom: 'server/mcp/platform-mcp.ts',
      tools,
    },
    null,
    2
  );

  const prettier = await import('prettier');
  const config = (await prettier.resolveConfig(OUT)) ?? {};
  return prettier.format(raw, { ...config, filepath: OUT });
}

async function main() {
  const check = process.argv.includes('--check');
  const tools = await deriveTools();
  const next = await serialize(tools);

  if (check) {
    // Compara sem fim de linha. Com `core.autocrlf=true` o git entrega o
    // arquivo em CRLF no working tree enquanto `serialize()` devolve LF, e a
    // comparacao crua reprovava em toda maquina Windows mesmo com o conteudo
    // identico byte a byte. Em CI Linux passava, entao o portao mentia so pra
    // quem desenvolve. E o mesmo tipo de briga entre portoes que o comentario
    // do `serialize()` descreve, agora entre plataformas.
    const eol = (s: string) => s.replace(/\r\n/g, '\n');
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf-8') : '';
    if (eol(current) !== eol(next)) {
      console.error(
        `[mcp:sync] ${OUT} esta desatualizado em relacao a platform-mcp.ts.\n` +
          '           Rode `npm run mcp:sync` e commite o resultado.'
      );
      process.exit(1);
    }
    console.log(`[mcp:sync] OK — ${tools.length} tools em sincronia.`);
    return;
  }

  writeFileSync(OUT, next, 'utf-8');
  console.log(`[mcp:sync] ${tools.length} tools escritas em ${OUT}`);
}

// Só executa quando chamado direto (o modulo tambem e importado pelo teste).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('[mcp:sync] falhou:', err);
    process.exit(1);
  });
}
