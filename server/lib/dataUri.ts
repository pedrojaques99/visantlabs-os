/**
 * Strip a `data:` URI prefix from a base64 string, returning the bare base64 payload.
 *
 * Replaces the narrow `/^data:image\/\w+;base64,/` pattern used across the codebase,
 * which failed on MIME types containing non-word characters (e.g. `image/svg+xml`)
 * and on uppercase schemes. This accepts any `data:<mime>;base64,` prefix.
 *
 * If the input has no such prefix (already-bare base64), it is returned unchanged.
 */
export function stripDataUriPrefix(input: string): string {
  return input.replace(/^data:[^;]+;base64,/i, '');
}
