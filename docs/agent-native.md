# Agent-native — lições de campo e para onde isso pode ir

Escrito depois de usar a plataforma de verdade por uma sessão inteira, como
agente, num trabalho real de cliente (catálogo de mockup da Days). Não é
auditoria de código: é o relato de onde a ferramenta me atrapalhou, e o que ela
poderia ser se essas fricções virassem produto.

---

# Parte 1 — As lições

## 1. Base64 num campo de tool é uma armadilha, não uma conveniência

Parece inofensivo: "manda a imagem em base64". Mas quem chama é um modelo, e
mandar base64 significa **o arquivo inteiro passa pelo contexto dele e é
reemitido byte a byte**. Um JPEG de 47 KB vira ~63 mil caracteres. Duas
consequências:

- **Custo linear no tamanho do arquivo**, em ambos os sentidos.
- **Acima de alguns milhares de caracteres, o payload chega truncado.** Não é
  hipótese: aconteceu comigo duas vezes nesta sessão.

E o truncamento era **silencioso**. `Buffer.from(x, 'base64')` do Node descarta
cauda inválida sem erro, então o servidor respondia `200` com uma URL apontando
pra um JPEG quebrado. Arquivo de 8171 B subiu como 7554 B. Eu só descobri
porque baixei de volta e comparei — se tivesse confiado no `200`, teria gerado
em cima de uma referência corrompida e culpado o modelo pelo resultado ruim.

**Lição:** todo campo que aceita bytes precisa de (a) uma alternativa por URL,
(b) verificação de integridade no servidor, e (c) uma rota que não passe pelo
modelo. As três foram implementadas — `imageUrl` nas tools, guarda de
truncamento em `/images/upload`, e `visant upload` no CLI.

## 2. Ecoar o parâmetro de entrada esconde falha de produção

`ai-generate-image` devolvia o `model` e o `resolution` que o chamador tinha
mandado. Parece inofensivo — é só devolver o contexto da chamada.

Passei **horas** convencido de que o parâmetro `resolution` estava com bug,
porque pedia 4K e recebia 1024×1536. Cheguei a documentar como pendência
conhecida, medir período de trama, calcular px/cm e concluir que era limitação
física de resolução.

Era fallback. O provider Gemini estava fora, tudo caía em `gpt-image-1`, e a
API me confirmava, a cada chamada, que tinha entregue Gemini.

A rota **sempre soube** — devolve `modelUsed`, `providerUsed`, `fellBack`. Era a
camada MCP que jogava fora e repetia o pedido. Meia hora depois do deploy da
correção, a primeira chamada expôs um apagão de provider que estava rodando há
sabe-se lá quanto tempo.

**Lição, e é a mais cara desta sessão:** _todo eco de parâmetro de entrada num
campo de resposta é um lugar onde uma falha de produção pode se esconder._ Se o
valor efetivo não é conhecido, ou não devolve o campo, ou nomeia
`...Requested`. Nunca deixa o chamador achar que é resultado.

## 3. Resposta de tool não é lugar de payload binário

`moodboard-upscale` devolvia a imagem em base64. Um 4K viram megabytes de texto
na resposta — que estoura o contexto de quem chamou, e é inútil, porque o passo
seguinte quase sempre é repassar a imagem por URL de qualquer forma.

**Lição:** resultado de mídia sai como URL, sempre. Se o storage não está
configurado, falha explicitamente em vez de despejar bytes.

## 4. Um portão derivado vale mais que uma revisão atenta

Mudei três descrições de tool e não regenerei `mcp-tools.generated.json`. Rodei
typecheck e testes de integração e me dei por satisfeito. O gate
`mcp-registry-sync` reprovou no CI e me obrigou a rodar `npm run mcp:sync`.

Funcionou exatamente como devia — e me pegou. Portão que compara artefato
derivado com a fonte é barato e não depende de ninguém lembrar.

## 5. Teste que sai pra rede deixa de ser teste

Dois casos nesta sessão. `psd-render-scene-fastpath` mockava só o Spaces; quando
`uploadRenderOutput` passou a preferir R2, o teste **parou de exercitar o mock e
passou a subir arquivo de verdade num bucket real a cada rodada** — e a
asserção quebrou. E `pdf-ingestion` falha por _rate limit de API externa_.

**Lição:** quando uma dependência ganha um caminho novo, o mock antigo não
falha alto — ele silenciosamente deixa de cobrir. Vale um teste que afirme "não
houve chamada de rede".

## 6. Medir antes de consertar, e desconfiar da própria medida

Medi que o render tinha 3,4% de micro-contraste contra 14,4% da foto real, e
concluí "falta trama". Construí um enxertador de textura. O resultado parecia
estuque.

O erro não estava na medida — estava na interpretação. O período da malha é
8,5 px na macro (~119 px/cm); o render entrega ~17 px/cm, então trama real teria
período de 1,2 px. **Está abaixo do pixel.** Aqueles 14,4% eram ruído de sensor
e micro-sombra de dobra, não trama.

**Lição:** um número que confirma a hipótese é o momento mais perigoso. A
pergunta seguinte tem que ser "o que mais explicaria esse número?".

---

# Parte 2 — Para onde isso pode ir

O que segue é opinião, não plano aprovado. Mas sai de fricção vivida, não de
brainstorm.

## A tese

Existe uma categoria inteira de plataforma de IA sendo construída como se o
usuário fosse humano clicando. A Visant já tem o motor certo — o que falta é
assumir que **o cliente principal é um agente**, e transformar isso na promessa
de venda em vez de num detalhe de implementação.

Três coisas, nesta ordem.

## 1. "A API que não mente" — honestidade como feature

Esta sessão provou o valor num caso real: um campo novo (`fellBack`) expôs em
minutos um apagão de provider que estava invisível. Isso não é higiene, é
diferencial.

O que dá pra construir em cima:

- **Recibo de geração.** Toda resposta carrega o que rodou, o que foi pedido,
  se houve fallback, quanto custou e por quê. Um `generationId` que abre um
  trace legível.
- **Health do provider exposto na resposta.** Se o Gemini está fora, o agente
  descobre na primeira chamada, não depois de três horas de investigação.
- **Fallback como escolha, não como surpresa.** `onFallback: "error" | "auto"`.
  Um agente de catálogo prefere falhar a receber outro modelo em silêncio.

Argumento de venda: _"toda outra API te diz o que você pediu. A nossa te diz o
que aconteceu."_ É uma frase que vende sozinha para quem já se queimou.

## 2. Determinismo mensurável — o que já está no motor e ninguém sabe

O pipeline de mockup da Days entrega cor com **ΔE abaixo de 1** contra a foto do
produto. Isso é forte e é invisível: não aparece em lugar nenhum do produto.

- **ΔE como saída de primeira classe.** A resposta de um mockup de marca devolve
  a distância medida entre a cor entregue e a cor da marca. "Não achamos que
  bateu — medimos: ΔE 0,4."
- **Selo de fidelidade de marca.** Um relatório por peça, exportável, que o
  cliente final manda pro time de brand. Isso vende para agência.
- **Diferencial contra o resto do mercado:** todo mundo gera imagem bonita.
  Ninguém prova que a cor está certa. Marca séria não compra "bonito", compra
  "conforme".

## 3. Agent-native de verdade — as arestas que sobraram

- **Ferramenta de upload em toda superfície.** `visant upload` resolveu meu
  caso; devia ser o caminho anunciado em toda tool que aceita mídia.
- **Capability discovery.** Uma tool que diz o que está vivo agora: providers
  no ar, quota restante, resolução máxima real por modelo. Meia dúzia das minhas
  horas teria virado uma chamada.
- **Custo antes do gasto.** `dryRun: true` devolvendo o custo estimado sem
  gerar. Agente que planeja lote precisa disso pra não queimar crédito testando.
- **Idempotência por chave.** Retry de agente é comum; cobrar duas vezes pelo
  mesmo trabalho, não.

## O que eu NÃO faria

- Não investiria em upscaler próprio antes de consertar o roteamento de
  provider. O gargalo que eu atribuí à resolução era um provider fora do ar —
  quase construí a solução errada com muita convicção.
- Não esconderia o fallback pra parecer mais confiável. A confiança vem de
  mostrar, não de esconder.

---

## Sequência sugerida

|                                                  | por quê                                              |
| ------------------------------------------------ | ---------------------------------------------------- |
| 1. Consertar provider Gemini + secrets do deploy | dois apagões silenciosos, custo zero de produto      |
| 2. Recibo de geração + health na resposta        | o diferencial mais barato de construir               |
| 3. ΔE como saída de primeira classe              | o motor já faz; falta expor                          |
| 4. `dryRun` e capability discovery               | o que mais me custou tempo depois dos dois primeiros |

O item 1 não é feature, é dívida. Mas é o que estava fazendo todo o resto
parecer pior do que é.
