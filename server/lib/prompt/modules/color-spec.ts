/**
 * Color Specification Module
 * Rules for generating color specification cards from selected elements
 */

export const COLOR_SPEC_RULES = `
## COLOR SPECIFICATION CARDS

When the user asks for color information, swatches, specs, or cards (hex, hsl, cmyk, pantone, paleta, palette, swatch):

1. EXTRACT fills from the selected elements (they appear in the SELECAO section with fill:#hex)
2. For EACH selected element with a solid fill, CREATE a spec card containing:
   - A color swatch rectangle with the exact fill color
   - The element/layer name as title
   - Color values: HEX, HSL, CMYK, and nearest Pantone equivalent
3. Layout: arrange cards horizontally with auto-layout, consistent spacing
4. Typography: use brand font if available, monospace for values
5. If the user says "um pra cada" or "for each", create individual cards per selected element

CONVERSION RULES:
- HEX: use the fill color directly
- HSL: convert from RGB (round to integers)
- CMYK: convert from RGB using standard formula (percentages, round to integers)
- Pantone: use the nearest common Pantone color name (approximate match is acceptable)

IMPORTANT: Each card must reference the SPECIFIC color from each selected element. Do NOT use generic/placeholder colors.
`;

export const COLOR_SPEC_PATTERNS = [
  /\b(hex|hsl|cmyk|pantone)\b/i,
  /\b(swatch|paleta|palette|color.?card|especifica[cç][aã]o|specification)\b/i,
  /\b(cores?|colors?)\s+(info|spec|card|detail)/i,
];
