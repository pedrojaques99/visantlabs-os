# Audit v2: cobrança de créditos × custo dos provedores (2026-10-27)

Escopo: o preço em créditos do Visant Labs contra o que cada provedor cobra de fato.
Fontes: código; leitura (sem escrita) do Mongo de produção; APIs do fal e do Google consultadas
com as chaves da casa; medição com 2 clipes reais no fal; pesquisa externa (links na seção 3).
Confiança de cada número: **alta** (API/medição da conta), **média** (agregadores independentes
que batem entre si), **baixa** (um revendedor ou fonte contraditória).

## 1. Resumo

- **A receita real é quase zero** e o gasto é quase todo interno. O produto está pré-receita: a
  precificação precisa estar certa _antes_ de entrar volume.
- **Os maiores vazamentos eram de cobrança e contabilidade, não de preço de tabela:** o servidor cobrava
  Kling pro/4k como std, o Kling não escalava com a duração, todo vídeo era contabilizado como Veo
  standard de 8s, e havia três cópias divergentes da regra de crédito.
- **Quatro tiers vendiam abaixo do custo ou no zero a zero** (Veo Lite, Veo Fast, Veo Standard, GPT Image 2
  2K). Corrigidos nesta versão, para ~30% de margem líquida de taxas.
- **Dois riscos operacionais que não são de preço:** a conta da OpenAI está **sem crédito** desde 2/out
  (GPT Image 2 falha 100%), e o Google marcou o modelo de imagem padrão como aposentado (2/out).

## 2. O que os dados internos mostram (produção, leitura)

| Medida                      | Valor                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Período dos `usage_records` | 19/nov/2025 a 26/out/2026, 8.395 gerações                                                 |
| Custo registrado            | US$ 211,78 (inclui US$ 25,60 fantasma do bug nº 3 abaixo)                                 |
| Parcela de contas admin     | 86% (US$ 181,84, 3.890 gerações, só 675 créditos debitados)                               |
| Usuários comuns             | US$ 29,95 de custo, 1.657 créditos, ~US$ 0,018 de custo por crédito                       |
| Últimos 30 dias             | 104 gerações, US$ 29,27, **0 créditos debitados** (tudo interno)                          |
| Pagamentos (`payments`)     | 56, todos de dez/2025: 2 pagos (R$ 19,80), 10 sem status (R$ 99), 44 `PENDING` (R$ 1.284) |
| `transactions`              | 8 registros, ~R$ 111 (moeda presumida BRL)                                                |
| Usuários                    | 136 (126 free com ~23 créditos/mês; 7 fundador/premium)                                   |
| Refação                     | **73%** das gerações de imagem repetem, em menos de 10 min, modelo e usuário da anterior  |
| Feedback (👍/👎)            | 42 / 8 (84% positivo)                                                                     |

Leitura: o crédito gasto por usuário comum custa ~US$ 0,018 ao provedor e vende a US$ 0,072-0,094,
ou seja, a margem _por crédito consumido_ é alta. O risco não é o preço médio, e sim os tiers
específicos caros (vídeo) e o plano gratuito.

## 3. Pesquisa externa: custo real de cada provedor

### 3.1 Kling no fal.ai (alta, medido na conta)

- API de pricing da conta (`GET api.fal.ai/v1/models/pricing`): **v3 std, pro e t2v: US$ 0,14/s**; **o3 std/pro: 0,14/s**;
  **v3 4K: 0,42/s**; v2.5-turbo pro 0,07/s e std 0,042/s; v2.6 pro 0,07/s.
- **Medição:** dois clipes pro de 3s, um sem áudio e outro com áudio, custaram US$ 0,84 no total (saldo 6,22 → 5,38),
  que é 6 s × 0,14. **O áudio não muda o preço** nessa conta. Páginas públicas que citam US$ 0,112/s, 0,168/s,
  0,224/s ou 0,336/s ([fal](https://fal.ai/explore/image-to-video-apis), [teamday](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026))
  **não batem com a conta**: não usei.
- O endpoint de uso do fal confirmou o mesmo: 27s = US$ 3,78 em 26/10 (std) e 6s = US$ 0,84 em 27/10 (pro).

### 3.2 Kling direto (baixa: só revendedor, [Atlas Cloud](https://www.atlascloud.ai/blog/guides/kling-ai-api-pricing))

- Unidade a US$ 0,14: v3 720p ~0,6 un/s = **US$ 0,084/s**; 1080p 1,2 un/s = US$ 0,168/s; com áudio 0,9 un/s; 4K 3 un/s = US$ 0,42/s.
- Se for verdade, **o std 5s custa US$ 0,42 direto contra US$ 0,70 no fal** (−40%). O pro direto (0,168/s) seria
  _mais caro_ que o fal (0,14/s). Oportunidade a validar, não a assumir (seção 6).

### 3.3 Veo 3.1 (média: [benchlm](https://benchlm.ai/media-pricing/veo) e [novoads](https://novoads.ai/blog/veo-3-1-lite) batem)

- Standard US$ 0,40/s (720p/1080p) e 0,60/s (4K); Fast 0,10/0,12/0,30; Lite 0,05 (720p) e 0,08 (1080p).
  Confere com `src/utils/pricing.ts`. A página oficial do Google não lista Veo/Imagen na versão que consegui ler.
- A tabela antiga cobrava Fast a US$ 0,15/s (1,20 por clipe); o oficial é 0,12/s (0,96).
- Os três modelos Veo respondem na API da casa (`GET /v1beta/models/<id>` = 200).

### 3.4 Imagem

- **Gemini** (alta, [página oficial do Google](https://ai.google.dev/gemini-api/docs/pricing), atualizada em 27/out): 2.5 Flash Image US$ 0,039; 3.1 Flash Image 0,045/0,067/0,101/0,151 (512/1K/2K/4K);
  3 Pro Image 0,134 (1K-2K) e 0,24 (4K). Tudo igual ao código.
- **GPT Image 2** (média): tabela publicada US$ 0,006 / 0,053 / 0,211 (baixa/média/alta, 1024²;
  [GMI](https://docs.gmicloud.ai/model-quickstarts/image/gpt-image-2-generate.md)), igual ao código. O
  [Segmind](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/)
  mediu 0,0078 / 0,066 / 0,264, mas é revendedor (cobra o Nano Banana 2 a 0,08/0,12/0,16 contra 0,067/0,101/0,151 no Google, ~+6 a 19%),
  então o excesso é markup dele. Conferir no painel da OpenAI.

### 3.5 Seedance (baixa, e **sem uso em produção**: 0 registros)

- Segundo o [Atlas Cloud](https://www.atlascloud.ai/blog/seedance-2.0-pricing-full-cost-breakdown-2026), a BytePlus lista Seedance 1.5 Pro a
  **US$ 0,10-0,80 por minuto** (a tabela da casa assume US$ 0,65 por 5s, ~10x mais) e o 2.0 "ainda não está na API";
  revendedores citam 2.0 a US$ 0,112/s e Fast a 0,09/s (tabela da casa: 0,92 e 0,46 por 5s). Fontes contraditórias: **não alterei**
  o preço do Seedance; precisa conferir no console da BytePlus.

### 3.6 Mercado e benchmarks

- Créditos de app custam cerca de 2x a API: Runway ~US$ 0,019 por crédito contra ~0,01 na API
  ([Michael Stake](https://michaelstake.com/ai-video-generation-pricing-business-model-nobody-puts-on-the-checkout-page/)). O Kling std 5s da casa vende a ~2x o custo do fal (1,44 contra 0,70), consistente; o Veo
  Standard antigo vendia a 1,1x (abaixo de qualquer referência: Runway API US$ 0,40/s, Luma US$ 0,84/s).
- Crédito de consumidor do Kling: US$ 0,0062-0,0133 ([Kling](https://kling.ai/blog/kling-video-3-0-credit-cost-guide)); o 4K é 30 créditos/s.
- Plano gratuito é "uma conta de GPU com rótulo de aquisição" (mesma fonte), e margem de vídeo é sensível: no exemplo da Pika,
  56% a US$ 0,10/clipe cai a 0% a US$ 0,23. Concordo com a regra de precificar por modelo/resolução/duração e contar refação.
- Não encontrei discussões no Reddit sobre margem de créditos (a busca só devolveu blogs de fornecedores); o ângulo "fundador" ficou sem fonte.

### 3.7 Câmbio e taxas de pagamento

- Dólar ~R$ 5,14 em setembro, Focus R$ 5,20 para o fim de 2026 ([Mercado Hoje](https://mercadohoje.uai.com.br/2026/09/18/dolar-hoje-18-09-2026-veja-as-informacoes-da-moeda-americana/)). A tabela de pacotes assume R$ 5,50: o crédito vale
  um pouco mais em dólar do que o documentado (R$ 198/500 créditos = US$ 0,076, não 0,072).
- Taxas (baixa, não-oficiais): AbacatePay PIX ~R$ 0,80 por transação; cartão ~3,5% + R$ 0,60
  ([GitHub bacen](https://github.com/bacen/pix-api/discussions/266), [TabNews](https://www.tabnews.com.br/)). Num pacote de R$ 9,90 isso é 8-10% da receita.
  Usei **5% de perda por taxa/câmbio/IOF** no cálculo (premissa; conferir com a AbacatePay e o extrato do cartão).

## 4. Bugs de cobrança e contabilidade (corrigidos)

| #   | Bug                                                                                                                                                  | Efeito                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Servidor ignorava `klingMode`: pro/4k saíam a 20 créditos, a UI mostrava 30/40                                                                       | Clipe pro/4k cobrado como std                                           |
| 2   | Crédito do Kling fixo por clipe, sem duração; o fal cobra US$ 0,14/s                                                                                 | Clipe de 15s: custo US$ 2,10, receita ~1,44 (prejuízo de 61% com taxas) |
| 3   | Todo vídeo contabilizado como Veo standard 8s (US$ 3,20)                                                                                             | 8 clipes Kling = US$ 25,60 no relatório, e o Seedance idem              |
| 4   | 11 clipes Veo standard gravados com `cost: 0`                                                                                                        | ~US$ 35 invisíveis                                                      |
| 5   | Três cópias divergentes da regra de crédito (servidor, UI, tabela) + um quarto lugar (`src/pages/docs/data/pricingData.ts`) com Veo a 15/40 créditos | Cobrança diferente do que a UI/docs mostravam                           |
| 6   | Tabela defasada: GPT Image 2 2K (0,12 vs 0,211), Kling v3 std (0,50 vs 0,70), Veo Fast (1,20 vs 0,96), Kling 4K (1,00 vs 2,10)                       | Margem calculada errada                                                 |
| 7   | `videoProviderCostUsd` devolvia 0 para Kling omni/v2.6 (sem linha na tabela)                                                                         | Gasto sumia do relatório                                                |

## 5. Preços aplicados (v2)

Regra: `créditos = ceil( (custo + infra) / (1 − 30% − 5% taxas) / US$ 0,072 )`, com infra US$ 0,013 por imagem e 0,15 por vídeo (`VISANT_INFRA_COSTS`) e piso de US$ 0,072 por crédito (pacote de 500).
Margem líquida de taxas, sobre a receita:

| Tier                                                  | Créditos antes → depois        | Custo (provedor) | Margem antes → depois   |
| ----------------------------------------------------- | ------------------------------ | ---------------- | ----------------------- |
| Veo 3.1 Lite 720p, 8s                                 | 8 → **12**                     | US$ 0,40         | 0% → 31%                |
| Veo 3.1 Fast, 8s                                      | 20 → **24**                    | US$ 0,96         | 18% → 31%               |
| Veo 3.1 Standard, 8s                                  | 50 → **72**                    | US$ 3,20         | 2% → 30%                |
| Kling v3 4K, 5s                                       | 40 → **50**                    | US$ 2,10         | 17% → 32%               |
| GPT Image 2 2K                                        | 3 → **4**                      | US$ 0,211        | −9% → 17%               |
| Kling std 10s / 15s                                   | 20 → **40 / 60** (duração, v1) | 1,40 / 2,10      | −13% / −61% → 41% / 43% |
| Kling std, pro 5s; Gemini; Imagen; Ideogram; Seedream | sem mudança                    |                  | 23-70%                  |

- O Veo Lite 1080p saiu da tabela: o produto só oferece o Lite em 720p (e o Veo 4K não é oferecido na UI).
- Ficam abaixo de 30% mas positivos: GPT Image 2 (17%: 2K e 4K têm o mesmo custo, então o mesmo preço), Gemini 2.5 Flash Image (23%), Gemini 3.1 Flash 512px (14%).
- Contagens de vídeo dos pacotes na página de preços foram recalculadas (500 créditos: 20 Fast ou 6 Standard).
- Referência de mercado: o Veo Standard a 72 créditos sai a ~US$ 0,65/s ao crédito mínimo, entre o Runway API (0,40) e o Luma (0,84).

## 6. O que depende de você (não dá para eu fazer)

1. **Recarregar a conta da OpenAI.** Todas as chamadas de GPT Image 2 desde 2/out falham com `429 You have no credits remaining`
   (7 de 7 nos últimos 30 dias). Painel: platform.openai.com/settings/organization/billing.
2. **Migrar o modelo de imagem padrão.** O Google marca `gemini-2.5-flash-image` como aposentado em 2/out/2026 e o `gemini-3.1-flash-image-preview` em 25/jun/2026 (substituto: `gemini-3.1-flash-image`, já disponível na API).
   Os dois ainda respondem, mas podem cair sem aviso. Trocar o id muda custo (0,039 → 0,067) e créditos (1 → 2): é decisão de produto.
3. **Avaliar um pacote da Kling direta** para o std (US$ 0,084/s contra 0,14 no fal, se o revendedor estiver certo). Exige comprar resource pack: não comprei nada.
4. **Conferir os 44 pagamentos `PENDING` (R$ 1.284)** na AbacatePay e se o cron `POST /api/cron/reconcile-payments` está agendado no Coolify.
5. **Conferir taxas reais da AbacatePay** e o câmbio/IOF do cartão que paga os provedores (premissa de 5%).
6. **Conferir o preço do Seedance** no console da BytePlus (hoje não afeta ninguém: 0 uso).
7. **Política do plano gratuito:** 126 usuários × ~23 créditos/mês. Pior caso (tudo em Veo Standard, agora 72 créditos): ~US$ 0,046/crédito de custo. Hoje o gasto observado é todo interno.
8. **Contas admin e bots (86% do gasto):** continuam sem débito de crédito, por desenho. O relatório `/api/admin/ai-costs?groupBy=user` mostra o custo delas.

## 7. Como manter coerente

- `server/lib/__tests__/creditPricingGuard.test.ts` (CI): reprova tier abaixo do custo já descontando 5% de taxas, tabela divergente do código,
  e UI diferente do servidor ou da tabela.
- `npm run check:provider-prices` (`scripts/check-provider-prices.mjs`): compara o preço do fal e a disponibilidade dos modelos Google com o que o código assume.
  Sai com código 1 se divergir. Vale rodar toda semana (ex.: cron do Coolify).
- Custo real por geração do fal: `usage_records.cost` e `/api/admin/ai-costs` (PR #279).

## 8. Limites desta análise

- Não vi faturas dos provedores (Google, OpenAI, fal), só APIs e registros internos; o custo "de verdade" do Google/OpenAI é o do `usage_records`, calculado por tabela.
- Falhas no meio da geração não gravam custo (o fal pode cobrar).
- O custo do Kling direto e do Seedance é de revendedor; o 4K do fal (0,42/s) vem da API de pricing, **não medi** um clipe 4K.
- Taxas de pagamento e IOF são premissas.
