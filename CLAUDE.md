# Visant Labs OSS - Project Instructions

## Before Implementing Anything

**ALWAYS consult these files first:**

1. `.agent/memory/LEARNED.md` - Padroes tecnicos e learnings do projeto
2. `.agent/memory/marketing.md` - Diferenciais e posicionamento de mercado
3. `.agent/memory/MEMORY.md` - Core reference (architecture, rules, navigation)
4. `.agent/` - Para qualquer skills, memoria, ou documentacao util.

## Design System

Never create new UI components without explicit permission. Use existing from `src/components/`.

## Code Patterns

- Canvas state: prefer sub-contexts for hot state; legacy uses full `CanvasHeaderContext`
- API methods: add optional params at end of signature
- Prisma: run `npx prisma generate` after schema changes (stop dev server first on Windows)

## Memory System

**Single source of truth: `.agent/memory/`**

Nao usar memoria especifica de ferramentas (Claude, Cursor, etc) - tudo fica em `.agent/`

## Key Differentiator

> "Brand Guidelines sao INPUT para geracao IA, nao apenas OUTPUT de documentacao"

Isso diferencia Visant de Frontify/Brandfolder - guidelines alimentam a geracao, nao sao apenas docs estaticos.
