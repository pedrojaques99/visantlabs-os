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
- SET_TEXT_STYLE: { nodeId, fontSize?, fontFamily?, fills? }
- SET_AUTO_LAYOUT: { nodeId, layoutMode, itemSpacing? }
- SET_OPACITY: { nodeId, opacity } (0 a 1)
- RENAME: { nodeId, name }`;

export const EDIT_EXAMPLE = `EXEMPLO (mudar cor e texto):
[
  {"type":"SET_FILL","nodeId":"123:456","fills":[{"type":"SOLID","color":{"r":0.2,"g":0.4,"b":1}}]},
  {"type":"SET_TEXT_CONTENT","nodeId":"123:789","content":"Novo texto","fontFamily":"Inter","fontStyle":"Bold"}
]`;

export const TEXT_EDIT_WARNING = `TEXTO: Use nodeId do no TEXT, nao do frame pai.
Se a selecao for FRAME com filhos TEXT, use o id do filho.`;
