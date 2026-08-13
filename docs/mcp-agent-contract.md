# Contrato das tools MCP com agentes

Notas de duas correções feitas em 2026-08-12, e a regra geral que elas implicam.
Vale ler antes de escrever tool nova.

## 1. Imagem entra por URL, não por base64

Uma tool que só aceita `base64` é inutilizável na prática por um agente. Ele
teria que carregar o arquivo inteiro no próprio contexto e re-emitir os bytes na
chamada — custo de token proporcional ao arquivo e, passando de alguns milhares
de caracteres, **o payload chega truncado**.

Pior: chegava truncado **em silêncio**. `Buffer.from(x, 'base64')` do Node
descarta cauda inválida sem erro, então o servidor respondia `200` com uma URL
apontando pra um JPEG quebrado. Caso real medido: arquivo de 8171 B subiu como
7554 B, e ninguém percebeu até a imagem ser usada.

**Regra:** toda tool que recebe imagem expõe `imageUrl` (preferido) e aceita
`base64` só como fallback declarado como tal na descrição. Toda geração da
plataforma já devolve URL, então na maioria dos fluxos base64 nunca é preciso.

Corrigidas: `moodboard-detect-grid`, `moodboard-upscale`, `smart-analyze`.
Já estavam certas: `ai-describe-image`, `ai-change-object`, `ai-apply-theme`.

Do lado do CLI existe `visant upload <arquivo> --json`, que manda o arquivo do
disco pra rede sem passar pelo modelo. É o caminho recomendado.

A resolução da URL passa por `resolveImageBase64`, que usa `safeFetch` — a
validação anti-SSRF continua valendo. Não abrir caminho novo pra rede.

## 2. Imagem também não SAI por base64

`moodboard-upscale` devolvia `upscaledBase64`. Um 4K em base64 são megabytes de
texto na resposta da tool — estoura o contexto de quem chamou e não serve pra
nada, já que o passo seguinte quase sempre é passar a imagem adiante por URL.

**Regra:** resultado de imagem sai como URL. Se o armazenamento não estiver
configurado, falhar explicitamente em vez de despejar base64 na resposta.

## 3. A resposta relata o que ACONTECEU, não o que foi pedido

`ai-generate-image` e `mockup-generate` ecoavam de volta o `model` e o
`resolution` recebidos na entrada. Só que existe `generateImageWithFallback`: se
o modelo escolhido falha, o roteador cai em outro provider ou modelo. A rota
sempre soube disso e devolve `modelUsed`, `providerUsed` e `fellBack` — a
camada MCP é que jogava fora e repetia o pedido.

O efeito é uma resposta que **mente sobre a própria geração**: o agente é
informado que recebeu `gemini-3-pro-image-preview` quando rodou outra coisa. E
como o `resolution` também era só eco, não havia como saber se ele foi honrado.

Agora:

| campo                 | significado                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `model`               | o que **rodou**                                                   |
| `provider`            | o provider que rodou                                              |
| `modelRequested`      | o que foi pedido                                                  |
| `fellBack`            | `true` se houve troca                                             |
| `resolutionRequested` | o que foi pedido — deliberadamente **não** é promessa do que saiu |

`resolutionRequested` tem esse nome de propósito: o serviço repassa
`imageConfig.imageSize` pro Gemini, mas o provider pode devolver outra dimensão,
e chamar o campo de `resolution` faria a resposta prometer o que não controla.

**Regra:** nunca ecoar parâmetro de entrada num campo que o chamador vai ler
como resultado. Se o valor efetivo não é conhecido, ou não devolve o campo, ou
nomeia como `...Requested`.

## O que a correção nº 3 revelou na primeira hora

A pendência que abri aqui era: "o `resolution` do Gemini não está sendo honrado,
1K/2K/4K devolvem 1024×1536". Assim que os campos novos subiram, a resposta
explicou sozinha:

```json
{
  "model": "gpt-image-1",
  "provider": "openai",
  "modelRequested": "gemini-3-pro-image-preview",
  "fellBack": true
}
```

**O `resolution` nunca foi ignorado — as requisições não chegavam no Gemini.**
Caíam no fallback da OpenAI, que entrega 1024×1536. `gemini-3-pro-image-preview`
e `gemini-3.1-flash-image-preview` caem os dois, então é **o provider Gemini
inteiro que está fora** para esta conta, não um modelo. Chave inválida, quota
estourada ou o breaker do `withResilience` aberto — só o log do servidor separa.

Enquanto a resposta ecoava o pedido, isso era **invisível**: o usuário pedia
Gemini, recebia OpenAI, e a API confirmava que tinha entregue Gemini.

Fica como lição, não só como bug: **todo eco de parâmetro de entrada é um lugar
onde uma falha de produção pode se esconder.**

## Pendência conhecida

Provider Gemini fora para esta conta (ver acima). Diagnóstico precisa do log do
backend — a linha `[GENERATION] Fell back to %s (%s)` em `routes/mockups.ts`
registra `failedAttempts` com a causa real.
