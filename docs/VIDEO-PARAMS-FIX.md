# Geração de vídeo: os parâmetros se perdem no caminho

Anotado em 17/08/2026. Diagnosticado em `Z:/Cursor/@Clients - Web/video-empreendimento-36s`, que
teve que contornar tudo isso falando direto com as APIs (`gen-clips.mjs` é a referência do que
funciona — três provedores, first/last frame nativo, parâmetro traduzido por provedor).

**Sintoma:** pede 9:16 de 5s pelo MCP, volta 16:9 de 8s com a arquitetura redesenhada por
outpainting. No Kling, toda geração falha.

**Custo real:** este projeto pagou ~R$ 444 em geração, e a maior parte do trabalho foi diagnóstico,
não vídeo. Todo projeto de vídeo novo paga o mesmo pedágio enquanto não consertar.

---

## 1. Veo — o parâmetro vai no lugar errado, com o nome errado

`server/services/videoService.ts:240-245`

```ts
if (aspectRatio) { requestParams.aspectRatio = aspectRatio; }
if (duration)   { requestParams.numberOfSeconds = parseInt(duration, 10) || undefined; }
```

Dois erros no mesmo bloco:

- **container errado** — a API põe isso dentro de `parameters` (REST `:predictLongRunning`) ou de
  `config` (SDK GenAI). No topo do request, é silenciosamente ignorado;
- **nome errado** — o campo é **`durationSeconds`**, não `numberOfSeconds`. Não existe.

Campo desconhecido não dá erro: a API cai no default, que é **16:9 e 8s**. É exatamente o sintoma.
Falta também `resolution`, que a chamada que funciona fixa em `'1080p'`.

O payload que funciona (`gen-clips.mjs:252-264`):

```js
parameters: {
  aspectRatio: cfg.aspectRatio,
  durationSeconds: Number(String(cfg.duration).replace(/s$/, '')),
  resolution: '1080p',
  negativePrompt: cfg.negativePrompt,
  personGeneration: 'allow_adult',
}
```

## 2. Kling — o `"5s"` chega cru numa API que quer `"5"`

`server/mcp/platform-mcp.ts:1502`

```ts
duration: z.enum(['5s', '10s']).default('5s')
```

Esse literal atravessa a rota e o `klingService` sem tradução (`klingService.ts:77,101` passa
`params.duration ?? '5'` adiante — o default dele está certo, ele é vítima, não causa) e chega na
API do Kling, que espera `"5"` / `"10"`. Toda geração falha.

**Correção:** normalizar na borda do provedor, não no schema. O schema pode manter `'5s'` porque é
melhor de ler; quem fala com o Kling faz `String(duration).replace(/s$/, '')`.

Repare também que `aspectRatio` no mesmo schema (`platform-mcp.ts:1500`) tem `.default('16:9')` —
que é o que aparece quando o parâmetro se perde no item 1. Os dois sintomas se somam.

## 3. Seedance/Ark — parâmetro no corpo, quando a API quer no texto — **confirmar**

`server/services/seedanceService.ts:126-130` monta:

```ts
const body = { model, content, ratio: aspectRatio, duration };
```

A chamada que funciona põe os parâmetros **dentro do texto do prompt**, não no corpo
(`gen-clips.mjs:204-208`):

```js
const texto = `${clipe.prompt} --resolution ${res} --duration ${dur} --ratio ${cfg.aspectRatio}`;
```

E o host difere: `ark.ap-southeast-1.byteplusapi.com` aqui contra
`ark.ap-southeast.bytepluses.com` no que funciona.

**Marquei como confirmar** porque tenho uma referência funcionando, não a doc dos dois contratos.
Checar antes de mexer — pode ser versão diferente da API, não bug.

---

## Plano

1. **Consertar o Veo** (item 1) — é o de maior impacto e o mais isolado: um bloco, um arquivo.
2. **Normalizar `duration` na borda de cada provedor** (item 2), com o schema do MCP intacto.
3. **Confirmar o contrato do Ark** (item 3) antes de tocar.
4. **Teste de contrato por provedor**: pedir 9:16/5s e afirmar sobre o arquivo que voltou. Um
   `ffprobe` de largura, altura e duração pega os três bugs de uma vez — e é o teste que faltou.

O passo 4 é o que impede a regressão. Os três bugs são invisíveis em runtime: nenhum levanta
exceção, todos entregam um vídeo — só que o vídeo errado.
