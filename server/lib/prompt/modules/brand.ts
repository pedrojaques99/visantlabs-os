/**
 * Module: Brand Context
 *
 * Injects brand guidelines when available.
 */

export const BRAND_PRIORITY_RULE = `BRAND:
Cores, fontes e logos do usuario tem PRIORIDADE sobre defaults.
Use as cores de marca listadas no contexto.
Se existirem variaveis de cor, prefira APPLY_VARIABLE.`;

/**
 * Build compact brand context
 */
export function buildCompactBrandContext(
  colors?: Array<{ name: string; value: string; role?: string }>,
  fonts?: { primary?: { name: string }; secondary?: { name: string } },
  logos?: { light?: { name: string; key?: string }; dark?: { name: string; key?: string } },
): string {
  const parts: string[] = ['BRAND DO USUARIO:'];

  if (colors?.length) {
    const colorList = colors.slice(0, 6).map(c => `${c.name}:${c.value}`).join(', ');
    parts.push(`Cores: ${colorList}`);
  }

  if (fonts?.primary || fonts?.secondary) {
    const fontList = [
      fonts.primary ? `Primary: ${fonts.primary.name}` : '',
      fonts.secondary ? `Secondary: ${fonts.secondary.name}` : '',
    ].filter(Boolean).join(', ');
    parts.push(`Fontes: ${fontList}`);
  }

  if (logos?.light || logos?.dark) {
    const logoList = [
      logos.light ? `Light: "${logos.light.name}"` : '',
      logos.dark ? `Dark: "${logos.dark.name}"` : '',
    ].filter(Boolean).join(', ');
    parts.push(`Logos: ${logoList}`);
  }

  return parts.length > 1 ? parts.join('\n') : '';
}
