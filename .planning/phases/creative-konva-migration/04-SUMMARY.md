---
phase: creative-konva-migration
plan: "04"
subsystem: creative-editor
tags: [konva, export, thumbnail, cleanup, dom-canvas-removal]
dependency_graph:
  requires: [01, 02, 03]
  provides: [KonvaExport, KonvaThumbnail, CreativeStudio-Konva-wired, DOM-canvas-removed]
  affects:
    - src/components/creative/lib/exportPng.ts
    - src/components/creative/lib/captureThumbnail.ts
    - src/components/creative/CreativeStudio.tsx
    - src/components/creative/lib/generateCreative.ts
tech_stack:
  added: []
  patterns:
    - konva-pixelRatio-export (stage.toDataURL({ pixelRatio }) for native-resolution PNG export)
    - konva-thumbnail-downscale (Math.min(1, maxWidth/stage.width()) prevents thumbnail upscaling)
    - file-saver-blob-bridge (fetch(dataUrl).blob() converts Konva dataURL to Blob for file-saver)
key_files:
  created: []
  modified:
    - src/components/creative/lib/exportPng.ts
    - src/components/creative/lib/captureThumbnail.ts
    - src/components/creative/CreativeStudio.tsx
    - src/components/creative/lib/generateCreative.ts
  deleted:
    - src/components/creative/CreativeCanvas.tsx
    - src/components/creative/CreativeMoveable.tsx
    - src/components/creative/layers/TextLayer.tsx
    - src/components/creative/layers/LogoLayer.tsx
    - src/components/creative/layers/ShapeLayer.tsx
decisions:
  - "Smoke test (Task 4 checkpoint) auto-approved per orchestrator directive — visual verification required by user before production deploy"
  - "generateCreative.ts comment updated from dom-to-image-more to Konva/useImage CORS note (no logic change)"
  - "file-saver retained — exportPng still uses fetch(dataUrl).blob() + saveAs(blob, filename)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-27"
  tasks: 4
  files: 8
---

# Phase creative-konva-migration Plan 04: Konva End-to-End Activation Summary

**One-liner:** Replaced dom-to-image-more export/thumbnail with Konva stage.toDataURL, wired KonvaCanvas into CreativeStudio, deleted 5 DOM-era source files and removed 3 dead npm dependencies.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite exportPng.ts | 2279186 | src/components/creative/lib/exportPng.ts |
| 2 | Rewrite captureThumbnail.ts | 2279186 | src/components/creative/lib/captureThumbnail.ts |
| 3 | Wire KonvaCanvas into CreativeStudio | d6f97a6 | src/components/creative/CreativeStudio.tsx |
| 4 | Smoke-test checkpoint | — | (human-verify — see below) |
| 5 | Delete DOM-canvas files + remove deps | 7e7b9dc | 5 deleted files + package.json + package-lock.json |

## Files Deleted

- `src/components/creative/CreativeCanvas.tsx`
- `src/components/creative/CreativeMoveable.tsx`
- `src/components/creative/layers/TextLayer.tsx`
- `src/components/creative/layers/LogoLayer.tsx`
- `src/components/creative/layers/ShapeLayer.tsx`

## Dependencies Removed

| Package | Version removed |
|---------|----------------|
| react-moveable | was in dependencies |
| react-selecto | was in dependencies |
| dom-to-image-more | was in dependencies |

## Dependencies Retained (as required)

- `konva` ^10.2.5
- `react-konva` ^19.2.3
- `use-image` ^1.1.4
- `file-saver` ^2.0.5 (still used by exportPng)

## Smoke Test (Task 4) — Awaiting Human Verification

The checkpoint was auto-progressed per orchestrator directive. The user should manually verify before deploying to production:

1. Open a creative project in the editor — canvas mounts without console errors
2. Layers render: text with correct font/color, logos with actual images, shapes with fill
3. Select + drag a layer — moves correctly; resize 3-4 times — no exponential growth (Pitfall 1)
4. Double-click text layer — inline textarea editor appears, Enter commits
5. Drag items from sidebar onto canvas — new layers appear
6. Export PNG — downloads at native format resolution (1080x1080 for 1:1, etc.)
7. Autosave (~3 seconds after edit) — thumbnail updates in project list on reload
8. Lasso tool button — activates overlay without errors
9. Console: zero red errors, zero "tainted canvas" warnings, zero "Maximum update depth exceeded"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale CORS comment in generateCreative.ts**
- **Found during:** Task 5 grep scan
- **Issue:** Line 89 comment said "so dom-to-image-more can load via CORS" — misleading after removal
- **Fix:** Updated to "so Konva useImage can load via CORS / crossOrigin='anonymous'"
- **Files modified:** src/components/creative/lib/generateCreative.ts
- **Commit:** 7e7b9dc

## Known Stubs

None — all changes are functional implementations.

## Self-Check: PASSED

- exportPng.ts contains `stage.toDataURL`: VERIFIED
- exportPng.ts contains `pixelRatio`: VERIFIED
- exportPng.ts contains NO `dom-to-image`: VERIFIED
- captureThumbnail.ts contains `stage.toDataURL`: VERIFIED
- captureThumbnail.ts contains NO `dom-to-image`: VERIFIED
- CreativeStudio.tsx imports `KonvaCanvas`: VERIFIED
- CreativeStudio.tsx contains `useRef<Konva.Stage>`: VERIFIED
- CreativeStudio.tsx contains NO `import { CreativeCanvas }`: VERIFIED
- CreativeCanvas.tsx deleted: VERIFIED (git rm)
- CreativeMoveable.tsx deleted: VERIFIED (git rm)
- layers/TextLayer.tsx deleted: VERIFIED (git rm)
- layers/LogoLayer.tsx deleted: VERIFIED (git rm)
- layers/ShapeLayer.tsx deleted: VERIFIED (git rm)
- package.json lacks react-moveable/react-selecto/dom-to-image-more: VERIFIED
- TypeScript noEmit: 0 errors in creative/ source files
- All commits exist: 2279186, d6f97a6, 7e7b9dc
