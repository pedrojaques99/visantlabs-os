/**
 * Module: Edit Intent
 *
 * Rules for editing existing elements.
 */

export const EDIT_RULES = `EDICAO:
Use o nodeId dos elementos selecionados para editar:
- RESIZE: { nodeId, width, height }
- SET_FILL: { nodeId, fills: [...] }
- SET_STROKE: { nodeId, strokes: [...], strokeWeight }
- SET_CORNER_RADIUS: { nodeId, cornerRadius }
- SET_TEXT_CONTENT: { nodeId, content, fontFamily?, fontStyle?, fontSize? }
- SET_TEXT_STYLE: { nodeId, fontSize?, fontFamily?, fontStyle?, fills? }
  REGRA: Ao aplicar brand guidelines em texto, SEMPRE inclua fontFamily (e fontStyle se disponível). Não envie SET_TEXT_STYLE só com fills sem fontFamily quando houver fonte de marca disponível.
- SET_AUTO_LAYOUT: { nodeId, layoutMode, itemSpacing?, primaryAxisSizingMode?, counterAxisSizingMode? }
  REGRA: Se o frame já tem dimensões fixas, inclua primaryAxisSizingMode:"FIXED" e counterAxisSizingMode:"FIXED". Nunca aplique SET_AUTO_LAYOUT sem o usuário pedir organização/layout explicitamente.
- SET_OPACITY: { nodeId, opacity } (0 a 1)
- RENAME: { nodeId, name }
- CREATE_COLOR_VARIABLES_FROM_SELECTION: { collectionName? }
  REGRA: Quando o usuário pedir para extrair cores como variáveis, salvar cores no library, ou criar variables a partir da seleção, use esta operação. Ela lê automaticamente os fills de todos os elementos selecionados e cria variáveis com o nome de cada camada. Não precisa de nodeId.
- BIND_NEAREST_COLOR_VARIABLES: { threshold?, scope?, collectionName? }
  REGRA: Quando o usuário pedir para vincular/linkar/aplicar/refatorar cores hardcoded para variáveis/tokens, use esta operação. Ela percorre TODOS os nós recursivamente e substitui cada fill/stroke por a variável de cor mais próxima (distância RGB ≤ threshold). scope="page" para a página inteira, "selection" para apenas seleção. Não precisa de nodeId.`;

export const EDIT_EXAMPLE = `EXEMPLO (mudar cor e fonte):
[
  {"type":"SET_FILL","nodeId":"123:456","fills":[{"type":"SOLID","color":{"r":0.2,"g":0.4,"b":1}}]},
  {"type":"SET_TEXT_STYLE","nodeId":"123:789","fontFamily":"Montserrat","fontStyle":"Bold","fontSize":24}
]`;

export const TEXT_EDIT_WARNING = `TEXTO: Use nodeId do no TEXT, nao do frame pai.
Se a selecao for FRAME com filhos TEXT, use o id do filho.`;
