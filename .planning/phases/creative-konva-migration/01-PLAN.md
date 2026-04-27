---
phase: creative-konva-migration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - src/components/creative/store/creativeTypes.ts
autonomous: true
requirements:
  - KONVA-DEPS
  - KONVA-TYPES
must_haves:
  truths:
    - "react-konva, konva, use-image are installed and importable"
    - "TextLayerData, LogoLayerData, ShapeLayerData accept optional opacity, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY props"
    - "TypeScript build compiles with the new optional props"
  artifacts:
    - path: package.json
      provides: "react-konva@^19.2.3, konva@^10.2.5, use-image@^1.1.4 in dependencies"
      contains: "react-konva"
    - path: src/components/creative/store/creativeTypes.ts
      provides: "Optional shadow/opacity props on TextLayerData, LogoLayerData, ShapeLayerData"
      contains: "shadowColor"
  key_links:
    - from: "node_modules/react-konva"
      to: "konva peer dep"
      via: "npm install"
      pattern: "react-konva.*konva"
    - from: "creativeTypes.ts"
      to: "creativeStore.updateLayer (Partial<CreativeLayerData>)"
      via: "structural Partial<>"
      pattern: "shadowColor|shadowBlur|opacity"
---

<objective>
Install Konva ecosystem packages and extend layer data types with optional opacity / drop-shadow
fields so subsequent waves can wire them into Konva nodes without store rewrites.

Purpose: Foundation for the migration. Without packages installed, no Konva code can compile.
Without the type extension, downstream waves either skip the new capabilities or have to touch
the store mid-migration. Doing both up front (Wave 1) unblocks all parallel waves that follow.

Output:
- npm packages installed (react-konva, konva, use-image)
- creativeTypes.ts extended with optional shadow/opacity fields on three layer data interfaces
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/creative-konva-migration/RESEARCH.md
@src/components/creative/store/creativeTypes.ts
@package.json

<interfaces>
<!-- Current type shapes (will be extended, NOT replaced) -->

From src/components/creative/store/creativeTypes.ts:
```typescript
export interface TextLayerData {
  type: 'text';
  content: string;
  role: 'headline' | 'subheadline' | 'body' | 'custom';
  position: { x: number; y: number };
  size: { w: number; h: number };
  align: 'left' | 'center' | 'right';
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
}

export interface LogoLayerData {
  type: 'logo';
  url: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export interface ShapeLayerData {
  type: 'shape';
  shape: 'rect';
  color: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
}
```

From package.json (current relevant deps):
```
"dom-to-image-more": "^3.7.2",
"file-saver": "^2.0.5",
"react-moveable": "^0.56.0",
"react-selecto": "^1.26.3"
```

NOTE: Do NOT remove react-moveable / react-selecto / dom-to-image-more in this plan.
Removal happens in the cleanup task of Wave 4 once the new render path is verified.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install react-konva, konva, use-image</name>
  <files>package.json, package-lock.json</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/package.json (verify React 19 + current deps)
    - Z:/Cursor/visantlabs-os/.planning/phases/creative-konva-migration/RESEARCH.md (Environment Availability table — versions HIGH-confidence)
  </read_first>
  <action>
    Run from project root (Z:/Cursor/visantlabs-os):

    `npm install react-konva@^19.2.3 konva@^10.2.5 use-image@^1.1.4`

    Versions are confirmed against the npm registry per RESEARCH.md (2026-04-27) and have
    no breaking compatibility issues with React 19 + Vite 6 + TypeScript 5.8.

    Do NOT use `--legacy-peer-deps` or `--force`. If a peer-dep warning appears, read it,
    do not paper over it. If install fails on Windows because the dev server is running,
    ask the user to stop it (project-known constraint per CLAUDE.md).

    Do NOT remove react-moveable, react-selecto, or dom-to-image-more in this task.
    They stay installed until the cleanup task in Wave 4.

    Do NOT touch any vite.config / tsconfig — research confirms no config changes are
    needed (react-konva 18+ resolved the older Vite ESM issue).

    After install:
    1. Verify install succeeded by reading package.json — the three new entries must
       appear under `dependencies`.
    2. Verify the project still builds: `npm run build` (or whatever the existing build
       script is — check package.json scripts). A successful build confirms no peer-dep
       breakage. If build fails for unrelated reasons (other in-flight changes), at
       minimum run `npx tsc --noEmit` to confirm TS still passes.
    3. Do NOT add any imports yet. This task is install-only.
  </action>
  <verify>
    <automated>node -e "const p=require('Z:/Cursor/visantlabs-os/package.json'); const d=p.dependencies||{}; if(!d['react-konva']||!d['konva']||!d['use-image']) { console.error('Missing deps:', {rk:d['react-konva'], k:d['konva'], ui:d['use-image']}); process.exit(1); } console.log('OK', d['react-konva'], d['konva'], d['use-image']);"</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` `dependencies` contains `react-konva` (^19.2.3 or compatible),
      `konva` (^10.2.5 or compatible), and `use-image` (^1.1.4 or compatible).
    - `package-lock.json` is updated and committed.
    - `npx tsc --noEmit` passes (no new TS errors introduced).
    - `react-moveable`, `react-selecto`, `dom-to-image-more` are still present
      (not removed in this task).
    - No vite.config.* or tsconfig.json modifications.
  </acceptance_criteria>
  <done>
    Three new packages appear in package.json + package-lock.json, TypeScript
    compiles, no other deps removed. Install-only task — no source files touched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend layer data types with optional opacity + shadow props</name>
  <files>src/components/creative/store/creativeTypes.ts</files>
  <read_first>
    - Z:/Cursor/visantlabs-os/src/components/creative/store/creativeTypes.ts (full file)
    - Z:/Cursor/visantlabs-os/.planning/phases/creative-konva-migration/RESEARCH.md (section "Opacity, Shadow, Blur (new capabilities)")
    - Z:/Cursor/visantlabs-os/src/components/creative/store/creativeStore.ts (lines 219-240, the updateLayer signature — confirm `Partial<CreativeLayerData>` already accepts optional fields without store changes)
  </read_first>
  <action>
    Add the SAME five optional fields to `TextLayerData`, `LogoLayerData`, and
    `ShapeLayerData` (NOT to `GroupLayerData` — groups don't render directly). All five
    are OPTIONAL (`?:`). No defaults, no required fields, no migration of existing data.

    The exact fields to add to each of the three interfaces:

    ```typescript
    /** 0-1; defaults to 1 (fully opaque) when undefined */
    opacity?: number;
    /** Drop-shadow color, e.g. "rgba(0,0,0,0.5)" or "#000000". Required for shadow to render. */
    shadowColor?: string;
    /** Shadow blur radius in px (Konva pixel units). Default 0 = sharp. */
    shadowBlur?: number;
    /** Shadow X offset in px. Default 0. */
    shadowOffsetX?: number;
    /** Shadow Y offset in px. Default 0. */
    shadowOffsetY?: number;
    ```

    These map 1:1 onto Konva node props (`opacity`, `shadowColor`, `shadowBlur`,
    `shadowOffsetX`, `shadowOffsetY`) per RESEARCH.md "Opacity, Shadow, Blur" section.
    Wave 3 layer ports will read them directly.

    Add the fields at the END of each interface, AFTER the existing fields (after `bold`
    in TextLayerData, after `size` in LogoLayerData, after `size` in ShapeLayerData).

    Add a JSDoc block above each set of new fields:
    ```typescript
    // ── Konva-rendered visual effects (added 2026-04-27, all optional) ──
    ```

    DO NOT:
    - Add these to `GroupLayerData` (out of scope; groups proxy children).
    - Add `blurRadius` / filters in this plan — research notes filters require `.cache()`,
      out of scope for this phase.
    - Touch `creativeStore.ts` — `Partial<CreativeLayerData>` in `updateLayer` already
      accepts the new optional fields by structural typing. Verify by re-reading lines
      219-240 of creativeStore.ts.
    - Touch `creativeTypes.ts` interfaces beyond these three (CreativeOverlay,
      CreativeAIResponse, etc. stay untouched).
    - Add UI controls — toolbar/sidebar updates are explicitly out of scope per the
      phase scope_constraints.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p Z:/Cursor/visantlabs-os</automated>
  </verify>
  <acceptance_criteria>
    - `creativeTypes.ts` contains `opacity?:`, `shadowColor?:`, `shadowBlur?:`,
      `shadowOffsetX?:`, `shadowOffsetY?:` exactly three times each (once per
      TextLayerData, LogoLayerData, ShapeLayerData).
    - Grep: `grep -c "opacity?:" src/components/creative/store/creativeTypes.ts` returns 3.
    - Grep: `grep -c "shadowColor?:" src/components/creative/store/creativeTypes.ts` returns 3.
    - `GroupLayerData` is unchanged (does NOT contain `opacity?` or `shadowColor?`).
    - `creativeStore.ts` is NOT modified.
    - `npx tsc --noEmit` passes from project root with zero new errors.
    - Existing fields (content, role, position, size, align, fontSize, fontFamily, color,
      bold for text; url for logo; shape, color for shape) are unchanged in name and
      type.
  </acceptance_criteria>
  <done>
    Three layer data interfaces gain five optional Konva-friendly visual effect props.
    Store and existing call sites are untouched. Type checker passes. Wave 3 ports can
    now read these fields without further type changes.
  </done>
</task>

</tasks>

<verification>
1. `cat package.json | grep -E '"(react-konva|konva|use-image)"'` shows all three.
2. `npx tsc --noEmit` from Z:/Cursor/visantlabs-os returns exit 0.
3. `grep -c "opacity?:" src/components/creative/store/creativeTypes.ts` returns 3.
4. `grep -c "shadowColor?:" src/components/creative/store/creativeTypes.ts` returns 3.
5. `git diff src/components/creative/store/creativeStore.ts` is empty (store untouched).
</verification>

<success_criteria>
- Three Konva-ecosystem packages installed at the recommended versions.
- TextLayerData, LogoLayerData, ShapeLayerData each carry five new OPTIONAL visual fields.
- TypeScript compiles cleanly across the entire repo.
- No other dependencies removed; no UI / store / route changes.
- Wave 2 and Wave 3 plans can `import { Stage, Layer, Rect, Text, Image, Transformer } from 'react-konva'` and `import useImage from 'use-image'` without further setup.
</success_criteria>

<output>
After completion, create `.planning/phases/creative-konva-migration/01-SUMMARY.md` documenting:
- Exact installed versions (read from package.json after install).
- The five fields added and which three interfaces received them.
- Confirmation that creativeStore.ts was untouched.
</output>
