/**
 * Module: Brand Context
 *
 * Injects brand guidelines when available.
 */

export const BRAND_PRIORITY_RULE = `BRAND (REGRAS CRITICAS):
1. NUNCA use a fonte "Inter" se o usuário já escolheu fontes de marca. Use SEMPRE as fontes de marca em CREATE_TEXT e SET_TEXT_STYLE.
2. MAPEAMENTO: Use a fonte "Principal" para Headings/Títulos e "Secundária" para Textos de apoio/Legendas.
3. CORES de marca (Primary, Secondary, Accent) têm PRIORIDADE absoluta em FILLS e STROKES.
4. Se existirem variáveis ($v), use APPLY_VARIABLE para vinculação dinâmica.
5. LOGOS: Posicione os logos de marca no layout para fechamento e assinatura (ex: cantos ou selos).`;

/**
 * Build compact brand context — family-first typography
 */
export function buildCompactBrandContext(
  colors?: Array<{ name: string; value: string; role?: string }>,
  fonts?: { primary?: { family?: string; style?: string; size?: number; availableStyles?: string[] }; secondary?: { family?: string; style?: string; size?: number; availableStyles?: string[] } },
  logos?: { light?: { name: string; key?: string }; dark?: { name: string; key?: string } },
): string {
  const parts: string[] = ['BRAND DO USUARIO:'];

  if (colors?.length) {
    const colorList = colors.slice(0, 6).map(c => `${c.name}:${c.value}`).join(', ');
    parts.push(`Cores: ${colorList}`);
  }

  if (fonts?.primary || fonts?.secondary) {
    const renderFont = (label: string, f: any) => {
      if (!f || !f.family) return '';
      const styles = f.availableStyles?.length ? f.availableStyles.join(', ') : f.style || 'Regular';
      return `${label}: "${f.family}" (pesos: ${styles})`;
    };

    const fontParts = [
      renderFont('Principal (Headings)', fonts.primary),
      renderFont('Secundária (Body)', fonts.secondary),
    ].filter(Boolean);

    parts.push(`Fontes: ${fontParts.join(' | ')}`);
    parts.push(`INSTRUÇÃO TIPOGRAFIA: Use SEMPRE fontFamily da marca em CREATE_TEXT e SET_TEXT_STYLE. NUNCA utilize "Inter" se houver fontes de marca disponíveis. Escolha o peso apropriado dos disponíveis (ex: Bold para chamadas, Regular para parágrafos).`);
  }

  if (logos?.light || logos?.dark) {
    const logoList = [
      logos.light ? `Light: "${logos.light.name}" (key: "${logos.light.key}")` : '',
      logos.dark ? `Dark: "${logos.dark.name}" (key: "${logos.dark.key}")` : '',
    ].filter(Boolean).join(', ');
    parts.push(`Logos: ${logoList}`);
  }

  return parts.length > 1 ? parts.join('\n') : '';
}
