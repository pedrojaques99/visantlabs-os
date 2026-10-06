// EXCEÇÃO ao audit:design/hex: cor de DOCUMENTO, não de interface. O valor é gravado no
// orçamento do usuário, alimenta <input type="color"> (só aceita hex) e é rasterizado pelo
// html2canvas na exportação de PDF (não resolve var() nem oklch). Token CSS aqui quebra os três.
export const DEFAULT_DOCUMENT_ACCENT = '#52ddeb';
