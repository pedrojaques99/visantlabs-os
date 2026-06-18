/**
 * Web preset registry — the catalog of headless-renderable templates, keyed by the
 * same `Format/Purpose` id as the Figma library. Each entry declares its dimensions,
 * its image slots (for the asset resolver), and how to map filled slots → HTML.
 * Add a layout = add an entry. The route stays generic.
 */
import { postLaunchHtml, type PresetVars } from './preset-html.js';
import type { ImageSlotSpec } from './figma-asset-resolver.js';

type Text = Record<string, string | string[] | null | undefined>;
type Images = Record<string, { imageUrl: string } | undefined>;

export interface WebPreset {
  id: string;
  width: number;
  height: number;
  /** Image slots the resolver should fill from brand assets. */
  imageSlots: ImageSlotSpec[];
  /** Map resolved text + images → final HTML. */
  build: (vars: PresetVars, text: Text, images: Images, fontCss: string) => string;
}

const asList = (v: string | string[] | null | undefined): string[] | undefined =>
  v == null ? undefined : Array.isArray(v) ? v : [v];
const asStr = (v: string | string[] | null | undefined): string =>
  v == null ? '' : Array.isArray(v) ? v.join(' ') : v;

export const WEB_PRESETS: Record<string, WebPreset> = {
  'post/launch': {
    id: 'Post/Launch',
    width: 1080,
    height: 1350,
    imageSlots: [{ id: 'photo1' }, { id: 'logo', variant: 'dark' }],
    build: (vars, text, images, fontCss) =>
      postLaunchHtml(
        vars,
        {
          h1: asStr(text.h1),
          h2: text.h2 ? asStr(text.h2) : undefined,
          infos: asList(text.infos),
          photoUrl: images.photo1?.imageUrl,
          logoUrl: images.logo?.imageUrl,
        },
        fontCss
      ),
  },
};

export function getWebPreset(id: string): WebPreset | undefined {
  return WEB_PRESETS[id.trim().toLowerCase()];
}

export function listWebPresets(): Array<Pick<WebPreset, 'id' | 'width' | 'height'>> {
  return Object.values(WEB_PRESETS).map((p) => ({ id: p.id, width: p.width, height: p.height }));
}
