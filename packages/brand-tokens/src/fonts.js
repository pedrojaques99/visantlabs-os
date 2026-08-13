// Resolução de fonte da marca — o par que faltava do portão de contraste.
//
// O PROBLEMA QUE ISTO RESOLVE
//
// A engine emite `--font-display: 'Termina', ui-sans-serif, system-ui`. Se
// Termina não estiver carregada no projeto de destino, o navegador cai para
// system-ui **em silêncio**: nenhum erro, nenhum aviso, nenhum pixel vermelho.
// O site inteiro passa a parecer de outra marca e o build reporta sucesso.
//
// Isso já aconteceu em produção. No site da Kastrup® o vault declarava
// Termina + Funnel Sans; o projeto shipou Archivo + Mozilla Text + JetBrains
// Mono e ninguém notou por semanas, porque nada no caminho tinha como reclamar.
//
// A assimetria era essa: **cor era verificada e travava o build, tipografia era
// apenas afirmada.** Este módulo dá à tipografia o mesmo tratamento.
//
// COMO
//
// A API oficial do Google Fonts (css2) responde 200 para família existente e
// 400 para inexistente. É endpoint público, sem chave e sem dependência nova —
// não vale escrever um catálogo local, que nasceria desatualizado.
//
// Família ausente NÃO é erro por si só: fonte paga e licenciada é decisão
// legítima de marca. O que não pode existir é ela sumir sem ninguém saber.
// Ausente vira uma declaração explícita, com instrução do que fazer.

const GOOGLE_CSS2 = 'https://fonts.googleapis.com/css2';

/** Pesos que um par display/corpo precisa para não cair em faux-bold. */
export const DEFAULT_WEIGHTS = [300, 400, 500, 600, 700];

/**
 * URL da API css2 para uma família. Exportada porque o consumidor precisa
 * emitir exatamente a mesma string que a sondagem validou — um resolvedor,
 * uma fonte de verdade (mesma regra do `oklchStr`).
 */
export function googleFontUrl(family, weights = DEFAULT_WEIGHTS) {
  const name = String(family).trim().replace(/\s+/g, '+');
  const wght = [...new Set(weights)].sort((a, b) => a - b).join(';');
  return `${GOOGLE_CSS2}?family=${name}:wght@${wght}&display=swap`;
}

/**
 * A família existe no Google Fonts?
 *
 * `fetchImpl` é injetável para o teste não tocar a rede. Falha de rede devolve
 * 'unknown', nunca 'absent': dizer "essa fonte não existe" porque o wifi caiu
 * é pior que admitir que não deu para checar.
 */
export async function probeGoogleFont(family, { fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(googleFontUrl(family), {
      method: 'GET',
      signal: ctrl.signal,
      // sem UA de browser a css2 devolve a variante TTF; tanto faz para existir/não
      headers: { 'user-agent': 'visant-brand-tokens' },
    });
    if (res.status === 200) return 'google';
    if (res.status === 400 || res.status === 404) return 'absent';
    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve o par de fontes de um `compiled.type`.
 *
 * Devolve uma entrada por papel, deduplicada por família — marca de face única
 * (display === sans) é decisão legítima e não deve sondar nem importar duas vezes.
 */
export async function resolveFonts(type, opts = {}) {
  const papeis = [
    { role: 'display', family: type.display },
    { role: 'sans', family: type.sans },
  ];

  const cache = new Map();
  const out = [];
  for (const p of papeis) {
    if (!cache.has(p.family)) {
      cache.set(p.family, await probeGoogleFont(p.family, opts));
    }
    const availability = cache.get(p.family);
    out.push({
      ...p,
      availability,
      url: availability === 'google' ? googleFontUrl(p.family) : null,
    });
  }
  return out;
}

/**
 * Bloco de topo do CSS: os `@import` do que dá para carregar e a declaração
 * ruidosa do que não dá.
 *
 * O `@import` precisa vir antes de qualquer regra — por isso o consumidor
 * monta este bloco no início do arquivo, nunca no meio.
 */
export function fontHeader(fonts = []) {
  if (!fonts.length) return '';

  const importaveis = [...new Set(fonts.filter((f) => f.url).map((f) => f.url))];
  const faltantes = fonts.filter((f) => f.availability !== 'google');

  const linhas = [];

  for (const url of importaveis) linhas.push(`@import url('${url}');`);

  if (faltantes.length) {
    linhas.push('');
    linhas.push(
      '/* ⚠ FONTE NÃO RESOLVIDA — o token abaixo promete o que o projeto talvez não entregue.'
    );
    for (const f of faltantes) {
      const motivo =
        f.availability === 'absent'
          ? 'não existe no Google Fonts — licença própria ou nome errado no vault'
          : 'não foi possível checar (rede)';
      linhas.push(`   · ${f.role}: "${f.family}" — ${motivo}`);
    }
    linhas.push('');
    linhas.push('   Sem @font-face ou next/font para estas famílias, o navegador cai em');
    linhas.push('   system-ui SEM AVISAR e o produto inteiro muda de marca em silêncio.');
    linhas.push('   Carregue a face, ou troque a família no vault por uma obtenível. */');
  }

  return linhas.join('\n');
}

/** Uma linha por papel, para o relatório de build ficar do lado do de contraste. */
export function fontReport(fonts = []) {
  const rotulo = { google: 'OK   ', absent: 'AUSENTE', unknown: '? ' };
  return fonts.map((f) => `  ${rotulo[f.availability] ?? '? '}  ${f.role.padEnd(7)} ${f.family}`);
}
