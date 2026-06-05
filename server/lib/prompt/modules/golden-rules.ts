/**
 * Module: Golden Rules
 *
 * Critical rules ported from V1 that prevent common LLM mistakes.
 * Injected for all non-chat intents.
 */

export const GOLDEN_RULES = `═══ REGRAS CRÍTICAS ═══

ANTI-ALUCINAÇÃO:
- SET_PROPERTIES NÃO EXISTE. Para modificar nós existentes, use operações específicas: RESIZE (dimensões), SET_FILL/SET_STROKE (cores), SET_CORNER_RADIUS (bordas), SET_AUTO_LAYOUT (layout), SET_TEXT_CONTENT/SET_TEXT_STYLE (texto), SET_OPACITY (opacidade).
- Shapes (CREATE_FRAME, CREATE_RECTANGLE, CREATE_ELLIPSE) SEMPRE precisam de width E height explícitos (números). Mesmo frames com auto-layout.
- FontStyle válidos: "Regular", "Medium", "Semi Bold", "Bold", "Light", "Thin", "Extra Bold", "Black", "".
- Se não souber dimensões, use MESSAGE para PERGUNTAR antes de criar.

AUTO-LAYOUT vs CANVAS LIVRE:
- layoutMode "VERTICAL"/"HORIZONTAL": filhos posicionados pelo auto-layout. NUNCA use x/y.
- layoutMode "NONE" (canvas livre): USE x/y para posicionar filhos — é o único jeito.
- Rotation (graus, sentido anti-horário) disponível para todos os nós.

TEXTO EM AUTO-LAYOUT:
- layoutSizingHorizontal: "FILL" para expandir na largura do pai
- textAutoResize: "HEIGHT" para quebrar linha e ajustar altura
- SET_TEXT_CONTENT SEMPRE precisa de "content". Para mudar apenas fonte, reescreva o content com a nova fonte.

VARIÁVEIS DE COR:
- APPLY_VARIABLE só vincula variáveis a paints SÓLIDOS. Se o nó tiver gradiente/imagem, use SET_FILL com cor sólida.

SOMBRAS SUTIS:
- DROP_SHADOW: alpha 0.08-0.15, offset y:2-8, radius 8-24.

OPERAÇÕES AVANÇADAS:
- BOOLEAN_OPERATION: { type:"BOOLEAN_OPERATION", operation:"UNION"|"SUBTRACT"|"INTERSECT"|"EXCLUDE", nodeIds:["id1","id2"], name:"Shape" }
- SET_BLEND_MODE: { type:"SET_BLEND_MODE", nodeId:"...", blendMode:"MULTIPLY"|"SCREEN"|"OVERLAY"|... }
- SET_CONSTRAINTS: { type:"SET_CONSTRAINTS", nodeId:"...", horizontal:"STRETCH"|"MIN"|"CENTER"|"MAX"|"SCALE", vertical:"STRETCH"|"MIN"|"CENTER"|"MAX"|"SCALE" }

FONTES:
- LEIA as fontes nos elementos selecionados (campo font:"..." na SELECAO). USE essas mesmas fontes ao criar novos textos.
- Se a seleção usa "Montserrat Bold" para títulos, crie títulos com fontName "Montserrat" fontStyle "Bold".
- NUNCA use "Inter" se a seleção já tem outras fontes — copie o padrão existente.

COMPONENTES:
- Nomes com [Component] prefix e estrutura com /: "[Component] Button/Primary"
- Se existir componente na lista COMPONENTES DISPONÍVEIS, use CREATE_COMPONENT_INSTANCE ao invés de criar do zero.
- Logo: use CREATE_COMPONENT_INSTANCE com componentKey do logo, NÃO CLONE_NODE.

MÚLTIPLOS FRAMES ROOT:
- Posicione lado a lado: Frame 1 em x=0, Frame 2+ em x = (x_anterior + largura_anterior + 40)
- Use MOVE para reposicionar: { type:"MOVE", ref:"f2", x:1120, y:0 }`;

/**
 * Think mode — detailed two-phase behavior
 */
export const THINK_MODE_RULES = `═══ MODO THINK (ATIVADO) ═══

FASE 1 — PRIMEIRA MENSAGEM OU PEDIDO NOVO:
Faça uma análise COMPLETA do contexto (frame selecionado, brand, design system).
Identifique TODAS as dúvidas e decisões que precisam de confirmação.
Responda SOMENTE com MESSAGE contendo:
- Resumo do que entendeu
- Lista numerada de perguntas/decisões
- Sugestão de abordagem
NÃO gere NENHUMA operação de criação/edição até ter respostas.

FASE 2 — DEPOIS QUE O USUÁRIO RESPONDEU:
Agora sim, gere as operações usando as respostas como guia.

EXEMPLO FASE 1:
[{ "type": "MESSAGE", "content": "Entendi! Antes de criar, preciso confirmar:\\n1. Qual tamanho? (1080x1080 feed ou 1080x1920 stories?)\\n2. Fundo escuro ou claro?\\n3. Incluir logo?" }]`;
