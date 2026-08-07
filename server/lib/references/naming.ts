/**
 * Server half of the reference naming SSoT.
 *
 * The rules themselves (what counts as a junk name, how to compose a title from
 * stored dimensions, how to localise) live in src/lib/references/naming.ts so
 * the browser bundle can import them too — the grid has to agree with ingest on
 * what a placeholder is, or it starts guessing again.
 *
 * Only `makeSlug` lives here, because it needs node's crypto.
 *
 * `id` is deliberately absent from all of this. It is a foreign key in the R2
 * thumb path, the Pinecone vector id and users' collections.refIds — it is
 * never derived from a name. `slug` is the friendly handle; `id` stays
 * immutable.
 */

import { createHash } from 'crypto';
import { isPlaceholderName } from '../../../src/lib/references/naming.js';

export {
  PLACEHOLDER_NAME,
  isPlaceholderName,
  pickName,
  titleCase,
  composeName,
  localizedName,
  type ComposableRef,
  type LocalizableRef,
  type NameI18n,
} from '../../../src/lib/references/naming.js';

/**
 * URL-safe handle. Suffixed with 4 chars derived from the id so two refs that
 * compose the same title stay distinguishable — and so the slug is stable
 * across re-runs (no counters, no read-modify-write race).
 */
export function makeSlug(name: string | undefined | null, id: string): string {
  const base = (isPlaceholderName(name) ? 'reference' : (name as string))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  const suffix = createHash('sha1').update(id).digest('hex').slice(0, 4);
  return `${base || 'reference'}-${suffix}`;
}
