/**
 * Module: Brand Context
 *
 * Injects brand guidelines as hard constraints.
 * Compact format — actionable facts only, ≤500 chars target.
 */

export const BRAND_PRIORITY_RULE = `BRAND (HARD CONSTRAINTS — override generic styles):
- ALWAYS use brand fonts in CREATE_TEXT/SET_TEXT_STYLE. NEVER use "Inter" when brand fonts exist.
- Principal font → Headings/Titles. Secundária → Body/Captions.
- Brand colors (Primary, Secondary, Accent) override any generic palette.
- If color variables ($v) exist, prefer APPLY_VARIABLE for dynamic binding.
- Clone brand logos via CLONE_NODE sourceName for layout signatures.`;

export interface BrandContextInput {
  colors?: Array<{ name: string; value: string; role?: string }>;
  fonts?: {
    primary?: { family?: string; style?: string; size?: number; availableStyles?: string[] };
    secondary?: { family?: string; style?: string; size?: number; availableStyles?: string[] };
  };
  logos?: { light?: { name: string; key?: string }; dark?: { name: string; key?: string } };
  tokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
    shadows?: Record<string, any>;
  };
  voice?: string;
  dos?: string[];
  donts?: string[];
}

/**
 * Build compact brand context — colors, fonts, logos, tokens, voice
 */
export function buildCompactBrandContext(
  colors?: BrandContextInput['colors'],
  fonts?: BrandContextInput['fonts'],
  logos?: BrandContextInput['logos'],
  tokens?: BrandContextInput['tokens'],
  voice?: string,
  dos?: string[],
  donts?: string[],
): string {
  const parts: string[] = ['BRAND:'];

  if (colors?.length) {
    const colorList = colors.slice(0, 6).map(c => {
      const role = c.role ? ` (${c.role})` : '';
      return `${c.name}${role}:${c.value}`;
    }).join(', ');
    parts.push(`Cores: ${colorList}`);
  }

  if (fonts?.primary || fonts?.secondary) {
    const renderFont = (label: string, f: any) => {
      if (!f?.family) return '';
      const styles = f.availableStyles?.length ? f.availableStyles.join(', ') : f.style || 'Regular';
      return `${label}: "${f.family}" (${styles})`;
    };
    const fontParts = [
      renderFont('Principal', fonts.primary),
      renderFont('Secundária', fonts.secondary),
    ].filter(Boolean);
    if (fontParts.length) parts.push(`Fontes: ${fontParts.join(' | ')}`);
  }

  if (logos?.light || logos?.dark) {
    const logoList = [
      logos.light ? `Light: "${logos.light.name}"` : '',
      logos.dark ? `Dark: "${logos.dark.name}"` : '',
    ].filter(Boolean).join(', ');
    parts.push(`Logos: ${logoList}`);
  }

  if (tokens) {
    const tokenParts: string[] = [];
    if (tokens.spacing && Object.keys(tokens.spacing).length) {
      const top3 = Object.entries(tokens.spacing).slice(0, 4).map(([k, v]) => `${k}:${v}px`).join(', ');
      tokenParts.push(`spacing(${top3})`);
    }
    if (tokens.radius && Object.keys(tokens.radius).length) {
      const top3 = Object.entries(tokens.radius).slice(0, 4).map(([k, v]) => `${k}:${v}px`).join(', ');
      tokenParts.push(`radius(${top3})`);
    }
    if (tokenParts.length) parts.push(`Tokens: ${tokenParts.join(' | ')}`);
  }

  if (voice) parts.push(`Voz: ${voice.slice(0, 80)}`);
  if (dos?.length) parts.push(`DO: ${dos.slice(0, 3).join('; ')}`);
  if (donts?.length) parts.push(`DON'T: ${donts.slice(0, 3).join('; ')}`);

  return parts.length > 1 ? parts.join('\n') : '';
}
