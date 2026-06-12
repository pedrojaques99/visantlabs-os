/**
 * ImageLab Presets — thin re-export of @visant/print-fx.
 *
 * The preset catalog now has a single source of truth in the package
 * (`@visant/print-fx/presets`). This module is kept as a re-export so every
 * existing importer (client stores, server presets view) keeps its path and
 * client/server can never drift — both consume the same package data.
 */
export {
  HALFTONE_PRESETS_DATA,
  RISO_FULL_PRESETS_DATA,
  TEXTURE_PRESETS_DATA,
} from '@visant/print-fx/presets';
