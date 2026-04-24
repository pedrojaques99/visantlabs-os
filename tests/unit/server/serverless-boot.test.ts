/**
 * Serverless boot smoke tests
 *
 * Verifies that server modules load cleanly in a Lambda-like environment
 * (no browser globals, no native canvas bindings). A top-level import of a
 * package that requires DOMMatrix / @napi-rs/canvas at eval time crashes the
 * entire Vercel function before it can serve a single request — exactly what
 * happened with pdfjs-dist.
 *
 * Strategy: mock the packages that are known to crash in Lambda so Vitest
 * runs in the same constrained environment, then assert the import completes
 * without throwing.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'

// Simulate Lambda: remove browser globals that pdfjs-dist / canvas libs need.
beforeAll(() => {
  // @ts-ignore
  delete (globalThis as any).DOMMatrix
  // @ts-ignore
  delete (globalThis as any).ImageData
  // @ts-ignore
  delete (globalThis as any).Path2D
})

// Make pdfjs-dist throw on import, exactly as it does in Lambda when
// @napi-rs/canvas is missing. This validates that our code never reaches
// this import at module-evaluation time.
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  throw new Error(
    '[test-sentinel] pdfjs-dist evaluated at module load — must be lazy-imported inside the function'
  )
})

describe('serverless boot — no banned top-level imports', () => {
  it('brand-parse loads without triggering pdfjs-dist', async () => {
    // If the import below throws "[test-sentinel]" it means pdfjs-dist is still
    // imported at the top level of brand-parse.ts.
    await expect(
      import('../../../server/lib/brand-parse.js')
    ).resolves.toBeDefined()
  })

  it('parsePdf defers pdfjs-dist import to call time', async () => {
    const { parsePdf } = await import('../../../server/lib/brand-parse.js')

    // Calling parsePdf will now hit the vi.mock — that's expected and fine.
    // The important thing is that the module loaded above without crashing.
    const minimalPdf = Buffer.from('%PDF-1.4\n%%EOF\n')
    await expect(parsePdf(minimalPdf, 'test.pdf')).rejects.toThrow()
    // The error should NOT be our sentinel (module-load crash); it should be
    // a runtime error from pdfjs-dist trying to parse an invalid PDF.
    // Either way: the function was reached, meaning the module loaded fine.
  })

  it('brand-parse exports the expected API surface', async () => {
    const mod = await import('../../../server/lib/brand-parse.js')
    expect(typeof mod.parseUrl).toBe('function')
    expect(typeof mod.parsePdf).toBe('function')
    expect(typeof mod.parseImage).toBe('function')
    expect(typeof mod.parseJson).toBe('function')
  })
})
