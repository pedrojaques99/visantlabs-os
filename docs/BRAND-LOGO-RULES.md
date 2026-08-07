# Regras de logo derivadas do próprio logo

> Engine: `server/lib/brand/logoRules.ts` · Testes: `server/lib/brand/__tests__/logoRules.test.ts`
> Rota: `POST /api/brand-guidelines/:id/logos/:logoId/rules` · Tool MCP: `brand-guidelines-logo-rules`
> CLI: `npx tsx scripts/derive-logo-rules.ts <arquivo>`
> Piloto executado: Arbolt® (`6a6cf51b970191a7dc083f4f`), 2026-08-05
>
> **Estado:** a engine e os testes estão commitados. A ligação (derivação no
> upload, rota `/rules`, tool MCP, campo `rules` no tipo) está pronta na working
> tree mas **ainda não commitada** — esses arquivos têm trabalho de outra frente
> em andamento e precisam ser separados antes. Até lá, a engine se usa pela CLI.

## O problema

Área de respiro, redução mínima e "sobre qual fundo o logo pode entrar" são as três
páginas que todo manual de marca tem — e que todo designer redesenha à mão, projeto
após projeto. São também as três coisas mais copiadas errado quando o material sai
do estúdio e vai pro cliente aplicar.

Nenhuma delas é opinião. Todas saem de aritmética sobre dois insumos que a guideline
já tem: **o raster do logo** e **a paleta**.

## A tese: onde a IA entra e onde ela atrapalha

Este arquivo é irmão de `server/lib/references/imageFacts.ts`, que já formaliza a
regra da casa: *"um LLM nunca deve ser perguntado por um número que ele não pode
medir"*.

| Camada | Quem faz | Por quê |
|---|---|---|
| Medir o traço, a caixa-alta, a proporção | **determinístico** (sharp) | modelo de visão erra medida com confiança; pixel não erra |
| Contraste contra a paleta | **determinístico** (colord + WCAG) | é fórmula fechada |
| Redução mínima | **determinístico**, dado um limiar de norma | o limiar é da indústria, não da marca |
| Área de respiro | **determinístico**, dada 1 escolha de módulo | 1-de-3, e a escolha fica registrada na saída |
| Usos proibidos genéricos | **gerado** de template | idêntico em toda marca do planeta — digitar isso é desperdício |
| Usos proibidos **específicos da marca** | **modelo**, lendo os números acima | exige entender o sistema gráfico; é o único lugar onde o modelo ganha do cálculo |

O resultado prático: das quatro páginas do manual de logo, três saem sem nenhum
julgamento humano além de dois parâmetros, e a quarta usa IA em cima de fatos
medidos em vez de em cima de nada.

## Como cada regra é calculada

### Geometria (`measureLogo`)

Decodifica via sharp, encontra os limites da tinta e mede:

- **bbox / proporção** — limites reais da tinta dentro da tela do arquivo
- **folga embutida (`bakedPadding`)** — margem que já veio no arquivo, como fração da
  largura da tinta. Sem isso, quem aplica a área de respiro por cima ganha margem
  dobrada e não entende por que a peça respira demais
- **caixa-alta** — altura da tinta (num wordmark caixa-alta, é literalmente isso)
- **haste / barra** — moda das corridas horizontais e verticais
- **traço fino** — **percentil 5** das corridas ≥ 3 px
- **cor da tinta** — média dos pixels opacos; é o que entra na matriz de contraste

**Duas decisões que parecem detalhe e não são:**

**1. Traço fino é percentil, não mínimo.** O ápice de um "A" e a junção de um "R"
produzem corridas de 1–2 px que não são traços. Usar `min()` colapsa toda redução
mínima para "1 px" e o número vira lixo. No piloto da Arbolt isso mudou a resposta:
o mínimo cru dava **28 px** e fazia o traço governar o tamanho mínimo; o percentil 5
dá **39 px** e faz a **caixa-alta** governar. Duas definições de "traço mais fino",
dois resultados. É por isso que a definição mora na engine e não na cabeça de quem
desenha o manual.

**2. `meta.hasAlpha` mente.** Ele só diz que o canal existe. Designer exporta logo
achatado como RGBA o tempo todo — todo pixel opaco, canal presente. Confiar na flag
faz a tela inteira ser lida como tinta e **toda** medição colapsa. A engine pergunta
aos pixels se o alfa carrega forma. Isso foi pego por teste, não por sorte.

### Área de respiro (`deriveClearSpace`)

Único parâmetro convencional do arquivo inteiro: qual módulo define uma unidade de
folga — `capHeight` (padrão), `halfCapHeight` ou `stem`. Escolhido isso, vira
medição. A saída traz `ratioOfWidth` e um `padding: calc(var(--logo-width) * N)`,
porque a regra só é útil se um renderer aplicar sozinho em qualquer tamanho.

### Redução mínima (`deriveMinSize`)

Duas restrições físicas, por meio (tela e impressão), e vence a que morde primeiro:

| meio | restrição | piso |
|---|---|---|
| tela | traço ≥ 1 px de dispositivo | traço abaixo disso some ou cintila |
| tela | caixa-alta ≥ 8 px | abaixo disso a letra para de ser lida |
| impressão | traço ≥ 0,088 mm | 0,25 pt, piso clássico de cobertura de tinta em offset |
| impressão | caixa-alta ≥ 2 mm | abaixo disso o detalhe fecha em papel não revestido |

A saída informa **qual das duas governou** (`governedBy`) — é a diferença entre
"o logo é delicado demais" e "o logo é baixo demais", que pedem correções opostas.

`safety` é o único lugar onde entra julgamento: 1 é o piso nu. A tela é arredondada
pra múltiplo de 4 px pra cair numa escala de espaçamento em vez de brigar com ela.

### Matriz de fundos (`deriveBackgrounds`)

Contraste WCAG entre a cor medida da tinta e cada cor da paleta.

**A barra é 3:1, não 4,5:1.** Logo é objeto gráfico (WCAG 1.4.11 Non-text Contrast),
não texto corrido. Usar a barra de texto reprova combinação perfeitamente legível —
é o erro mais comum de auditoria automática de marca.

### Usos proibidos (`boilerplateMisuse`)

Dez itens genéricos, gerados. O bloco **específico da marca** não está aqui — é uma
passada de modelo separada, que lê a geometria e o sistema gráfico. Ver "Próximo
passo".

## Onde fica

Em `logos[].rules`, dentro do objeto do próprio logo. Duas razões:

1. **Semântica:** respiro e redução mínima descrevem *aquele arquivo*. Um wordmark
   horizontal e um símbolo têm regras diferentes; guardar no nível da marca obrigaria
   a escolher uma e mentir sobre a outra.
2. **Zero migração:** `logos` já é `Json?` no Prisma. Nenhum campo novo, nenhum
   `prisma generate`, nenhum risco em produção.

Derivado automaticamente no upload (best-effort — falha de medição **nunca** custa o
upload do usuário) e re-derivável pela rota, pra backfill e pra trocar o módulo sem
subir o arquivo de novo.

## Piloto: Arbolt®

Wordmark `Union.png`, 1380 × 278, alfa real, sem folga embutida.

| medida | valor |
|---|---|
| proporção | **4,964 : 1** |
| caixa-alta | 278 px |
| haste / barra | 47 / 41 px |
| traço fino (p5) | 39 px = 2,83% da largura |
| cor da tinta | `#eeeeee` |
| densidade de tinta | 0,452 |

**Área de respiro** (módulo = caixa-alta): 278 px, ou **20,1% da largura aplicada**.
`padding: calc(var(--logo-width) * 0.2014)`

**Redução mínima** (safety 1,5): **60 px** em tela, **15 mm** em impressão. Governado
pela caixa-alta nos dois meios — o piso nu seria 40 px / 10 mm.

**Matriz de fundos:**

| fundo | contraste | veredito |
|---|---|---|
| Grafite `#1A1B1F` | 14,83:1 | ok |
| Verde Industrial `#2C352F` | 10,92:1 | ok |
| Verde Profundo `#545C55` | 5,95:1 | ok |
| Verde Médio `#7C847B` | 3,32:1 | ok |
| Verde Neutro `#90988E` | 2,56:1 | atenção |
| Sage `#CDD4C7` | 1,3:1 | reprovado |
| Branco `#FFFFFF` | 1,16:1 | reprovado |
| Concreto `#EEEEEE` | 1,0:1 | reprovado |

**O achado que justifica a engine inteira:** 3 das 8 cores da paleta da Arbolt não
têm logo aplicável hoje. A marca tem só a variante clara — e Concreto `#EEEEEE` é
justamente um `background-light` da paleta, ou seja, o fundo mais provável de uma
peça impressa. Ninguém tinha percebido, e nenhuma leitura visual acharia isso: o
contraste 1,0:1 é logo branco sobre fundo branco. **É preciso subir a versão escura
do wordmark.**

Resultado gravado em `guidelines.dos`, `guidelines.donts` e
`guidelines.accessibility` da Arbolt® (v3). O `logos[].rules` estruturado passa a
existir quando esta branch subir — a tool MCP ainda não está em produção.

## Próximo passo — a camada de modelo

O que o cálculo não alcança e o modelo alcança, lendo os números acima como insumo:

1. **Usos proibidos específicos da marca.** Para a Arbolt: "não aplicar o wordmark
   sobre o grafismo de linhas sem interromper as linhas na área de respiro". Isso
   exige entender o sistema gráfico, não medir o arquivo. Usar `cheapText.ts` (a
   cascata de texto que já existe — **não construir outra**), passando geometria +
   `strategy.graphicSystem` + paleta.
2. **Prosa na voz da marca.** As sentenças de hoje são corretas e neutras. Passar
   pelo `guidelines.voice` da marca custa centavos e faz o manual soar da marca.
3. **Nunca deixar o modelo tocar em número.** Os campos numéricos são a saída da
   engine. A camada de modelo escreve em volta deles, nunca por cima.

## Limitações conhecidas

- **SVG e PDF não têm pixel.** A rota prefere `thumbnailUrl` justamente por isso.
  Logo vetorial sem thumbnail rasterizado retorna 422 em vez de chutar.
- **Logo multicor** vira uma cor média na matriz de contraste. Para um logo de duas
  cores, o veredito é otimista demais. O certo seria medir o contraste do *elemento
  de menor contraste*, não da média — vale quando aparecer o primeiro caso real.
- **Lockup (símbolo + texto) é medido como uma peça só.** A relação entre símbolo e
  wordmark, e a regra de quando separar, continua sendo trabalho humano.
- **`inkDensity`** está medido e gravado mas ainda não é usado por nenhuma regra.
  Serve pra distinguir wordmark de brasão sólido — provável insumo da camada 1 acima.
