/**
 * Module: Template Handling
 *
 * Rules for working with templates (cloning, not editing).
 */

export const TEMPLATE_RULES = `TEMPLATES [Template]:
Frames com "[Template]" sao INTOCAVEIS. NUNCA edite diretamente!

PROIBIDO: SET_TEXT_CONTENT, SET_FILL, RESIZE, DELETE em templates
OBRIGATORIO: Use CLONE_NODE com textOverrides

CLONE_NODE:
{
  "type": "CLONE_NODE",
  "sourceNodeId": "id_do_template",
  "textOverrides": [
    { "name": "Nome do Layer de Texto", "content": "Novo conteudo" }
  ]
}

O "name" em textOverrides e o NOME do layer de texto no template.`;

export const TEMPLATE_EXAMPLE = `EXEMPLO (clonar template trocando texto):
[
  {"type":"CLONE_NODE","sourceNodeId":"123:456","textOverrides":[{"name":"Title","content":"Meu Novo Titulo"}]}
]`;
