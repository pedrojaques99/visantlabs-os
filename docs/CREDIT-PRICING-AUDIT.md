# Audit: cobrança de créditos × custo dos provedores (2026-10-26)

Escopo: preço em créditos do Visant Labs contra o que cada provedor cobra. Dados: código
(`server/lib/pricing-data.ts`, `src/utils/pricing.ts`, `src/utils/creditCalculator.ts`,
`server/utils/usageTracking.ts`, `server/routes/video.ts`), APIs do fal (pricing, usage, billing)
e **leitura** do Mongo de produção (`usage_records`, `payments`, `users`). Nada foi gravado no banco.

## 1. Resumo

- **Receita real é quase zero.** Todos os pagamentos são de dez/2025: 2 pagos (R$ 19,80), 10 sem status
  (R$ 99) e 44 `PENDING` (R$ 1.284 nunca confirmados). Em `transactions`, 8 registros somam ~R$ 110 (moeda presumida BRL). Não há
  pagamento desde dez/2025. O gasto com provedor dos usuários comuns é US$ 29,95.
- **86% do gasto registrado é interno:** US$ 181,84 de US$ 211,78 vêm de contas admin (3.890 de 8.395
  gerações), com só 675 créditos debitados. A feature `agent` (bots/MCP) sozinha são US$ 34,57 a zero créditos.
- **Margem por geração é boa em quase tudo**, mas há bugs de contabilização e de cobrança que
  escondiam o custo real, e 2 tiers que vendem abaixo do custo.

## 2. Bugs encontrados (corrigidos no PR deste audit)

| #   | Bug                                                                                                 | Evidência                                                                              | Efeito                                                     |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Servidor ignorava `klingMode` ao cobrar: `kling-v3` pro/4k saía a 20 créditos, a UI anunciava 30/40 | `usageTracking.getVideoCreditsRequired(model)` só olhava o nome do modelo              | Clipe pro/4k cobrado como std                              |
| 2   | Crédito do Kling era fixo por clipe, sem olhar duração, e o fal cobra US$ 0,14/s                    | UI aceita 3-15s                                                                        | Clipe de 15s: custo US$ 2,10, receita ~US$ 1,44 (prejuízo) |
| 3   | Todo vídeo era contabilizado como **Veo standard 8s = US$ 3,20**                                    | 8 clipes `kling-v3` = US$ 25,60 no relatório                                           | Custo de Kling/Seedance superestimado ~4,5x                |
| 4   | 11 clipes `veo-3.1-generate-preview` gravados com `cost: 0`                                         | consulta em `usage_records`                                                            | ~US$ 35 de custo Veo invisível (11 × US$ 3,20)             |
| 5   | Três cópias da regra de crédito de vídeo divergentes (server, `creditCalculator`, `pricing-data`)   | Seedance 1.5 Pro: 35 no servidor, 25 na UI; Lite: 20 vs 10                             | Cobrança diferente do que o usuário via                    |
| 6   | Tabela `googlePriceUSD` defasada                                                                    | GPT Image 2 2K: 0,12 na tabela, 0,211 no código; Kling v3 std: 0,50 contra 0,70 do fal | Margem calculada errada                                    |

## 3. O que foi aplicado

- `getVideoCreditsRequired(model, { klingMode, durationSec })` no servidor agora delega para a mesma função da
  UI. O preço de clipes de até 5s **não mudou** (20/30/40). Acima de 5s o Kling escala: `ceil(base × s / 5)` (10s std = 40, 15s pro = 90).
- A UI (`VideoNode`) mostra o crédito já com a duração.
- `videoProviderCostUsd()` em `server/lib/ai/cost.ts`: custo por família (Veo por segundo × duração, Kling/Seedance pela tabela ÷ 5 × duração), no lugar de "tudo é Veo".
- Tabela corrigida: Kling v3 std 0,70 (fal), GPT Image 2 2K 0,211.
- Guarda de CI `server/lib/__tests__/creditPricingGuard.test.ts`: reprova tier novo vendido abaixo do custo, tabela divergente do código e UI ≠ servidor.
- Antes, no #279: custo real do fal por geração, por usuário, no admin (`/api/admin/ai-costs`).

## 4. Margem por tier (receita no crédito mais barato, US$ 0,072; infra US$ 0,013 imagem / 0,15 vídeo)

Abaixo do custo hoje: **Veo Lite 1080p (-10%)** e **GPT Image 2 2K (-4%)**.
Finos (< 25%): Veo Lite 720p (5%), Veo Standard (7%), Veo Fast (23%, real US$ 0,96 e não 1,20), Gemini 3.1 Flash 512px (19%), GPT Image 2 4K (22%).
Saudáveis (45-85%): Gemini 3/3.1, Imagen, Ideogram, Seedream, Seedance, Kling até 5s.

## 5. Decisões que dependem de você (preço ao cliente: não apliquei)

Créditos para ~30% de margem no piso:

| Tier                   | Hoje | Sugerido |
| ---------------------- | ---- | -------- |
| Veo Lite 720p 8s       | 8    | 11       |
| Veo Lite 1080p 8s      | 10   | 16       |
| Veo Fast 8s            | 20   | 23       |
| Veo Standard 8s        | 50   | 67       |
| GPT Image 2 2K         | 3    | 5        |
| Gemini 3.1 Flash 512px | 1    | 2        |

Outras decisões:

1. O Veo cobra por clipe fixo (8s), mesmo que o usuário peça 4s ou 6s. Hoje isso cobra a mais, o que é seguro, mas inconsistente com o Kling.
2. As contas admin e bots (86% do gasto) pulam o débito. Se quiser que o gasto delas apareça como custo e não como crédito, o relatório do #279 já separa por usuário.
3. Os 44 pagamentos `PENDING` (R$ 1.284): ou nunca foram pagos, ou o webhook da AbacatePay não chegou. O cron de reconciliação (`POST /api/cron/reconcile-payments`) precisa estar agendado no Coolify. Vale conferir.
4. Plano gratuito: 126 usuários × ~23 créditos/mês. Pior caso (tudo em Veo Standard, US$ 0,064/crédito): ~US$ 200/mês. Observado hoje: US$ 0,018/crédito, ~US$ 57/mês.

## 6. O que não consegui confirmar

- Preço do fal para Kling **pro, 4K, omni e com áudio**: a API de pricing devolve só o preço-base (0,14/s em v3 std/pro e o3; 0,07 em v2.6 pro). O 4K segue com o valor antigo da tabela (US$ 1,00/5s), sem confirmação.
- Preço real do Seedance na BytePlus e da Kling direta (só valores da tabela).
- `pricing.ts` não tem preço de Seedream 4.5/5-lite e Reve: o custo registrado vem de fallback.
- Receita por crédito usa o pacote de 500 (US$ 0,072) como piso; a receita real média é maior (US$ 0,072-0,094).
