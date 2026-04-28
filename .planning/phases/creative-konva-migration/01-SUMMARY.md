---
phase: creative-konva-migration
plan: "01"
subsystem: creative-editor
tags: [konva, types, dependencies, foundation]
dependency_graph:
  requires: []
  provides: [react-konva, konva, use-image, layer-shadow-opacity-types]
  affects: [creative/store/creativeTypes.ts, package.json]
tech_stack:
  added: [react-konva@19.2.3, konva@10.2.5, use-image@1.1.4]
  patterns: [optional-props-extension]
key_files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - src/components/creative/store/creativeTypes.ts
decisions:
  - "Kept react-moveable/react-selecto/dom-to-image-more — removal deferred to Wave 4 cleanup"
  - "Optional fields only — no defaults, no required fields, no store changes"
  - "GroupLayerData excluded — groups proxy children, don't render directly"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-27"
  tasks: 2
  files: 3
---

# Phase creative-konva-migration Plan 01: Deps + Type Foundation Summary

**One-liner:** Installed react-konva/konva/use-image ecosystem and extended three layer data interfaces with five optional Konva-compatible visual effect props (opacity + drop-shadow).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install react-konva, konva, use-image | 8107830 | package.json, package-lock.json |
| 2 | Extend layer data types with opacity + shadow props | 176bd1a | src/components/creative/store/creativeTypes.ts |

## Installed Versions

Read from package.json after install:

- `react-konva`: `^19.2.3`
- `konva`: `^10.2.5`
- `use-image`: `^1.1.4`

## Type Extension Details

Five optional fields added to **TextLayerData**, **LogoLayerData**, and **ShapeLayerData**:

```typescript
// ── Konva-rendered visual effects (added 2026-04-27, all optional) ──
opacity?: number;
shadowColor?: string;
shadowBlur?: number;
shadowOffsetX?: number;
shadowOffsetY?: number;
```

- `opacity?` — 0-1, defaults to 1 (fully opaque) when undefined
- `shadowColor?` — drop-shadow color (required for shadow to render)
- `shadowBlur?` — shadow blur radius in px
- `shadowOffsetX?` — shadow X offset in px
- `shadowOffsetY?` — shadow Y offset in px

**GroupLayerData**: unchanged (groups proxy children, don't render directly).

## creativeStore.ts Confirmation

`creativeStore.ts` was NOT modified. The existing `updateLayer(Partial<CreativeLayerData>)` signature already accepts the new optional fields via structural typing.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- package.json contains react-konva, konva, use-image: VERIFIED
- creativeTypes.ts has 3x opacity?, 3x shadowColor?: VERIFIED
- creativeStore.ts unchanged: VERIFIED
- TypeScript compiles with no new errors in creativeTypes.ts: VERIFIED
