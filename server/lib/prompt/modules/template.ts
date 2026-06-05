/**
 * Module: Template & Clone Handling
 *
 * Rules for cloning frames — both [Template] protected frames and regular frames.
 */

export const TEMPLATE_RULES = `TEMPLATES [Template]:
Frames com "[Template]" sao INTOCAVEIS. NUNCA edite diretamente!

PROIBIDO: SET_TEXT_CONTENT, SET_FILL, RESIZE, DELETE em templates
OBRIGATORIO: Use CLONE_NODE com textOverrides

CLONE_NODE (funciona para QUALQUER frame, nao apenas templates):
{
  "type": "CLONE_NODE",
  "sourceNodeId": "id_do_frame_original",
  "name": "Nome do Clone",
  "textOverrides": [
    { "name": "Nome do Layer de Texto", "content": "Novo conteudo" }
  ]
}

O "name" em textOverrides e o NOME do layer de texto dentro do frame.

QUANDO USAR CLONE_NODE (IMPORTANTE):
- Quando o usuario pede para DUPLICAR/CLONAR um frame existente e mudar apenas o texto
- Quando o usuario pede VARIAÇÕES de um design existente (ex: "faça 4 versões", "clone e mude a copy")
- Quando existe um frame SELECIONADO como referência e o pedido é criar similares
- CLONE preserva: fontes, cores, layout, imagens, efeitos — só troca o texto via textOverrides
- Para trocar imagem de fundo no clone, adicione SET_IMAGE_FILL no clone depois`;

export const TEMPLATE_EXAMPLE = `EXEMPLO (clonar frame selecionado para 3 variações):
[
  {"type":"CLONE_NODE","sourceNodeId":"123:456","name":"Anúncio 1","textOverrides":[{"name":"Title","content":"Novo Titulo 1"},{"name":"Subtitle","content":"Novo Sub 1"}]},
  {"type":"CLONE_NODE","sourceNodeId":"123:456","name":"Anúncio 2","textOverrides":[{"name":"Title","content":"Novo Titulo 2"},{"name":"Subtitle","content":"Novo Sub 2"}]},
  {"type":"CLONE_NODE","sourceNodeId":"123:456","name":"Anúncio 3","textOverrides":[{"name":"Title","content":"Novo Titulo 3"},{"name":"Subtitle","content":"Novo Sub 3"}]}
]`;
