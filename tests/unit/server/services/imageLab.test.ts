/**
 * ImageLab service — unit tests for the security guards hardened in Phase 1.
 *
 * validateImageUrl / isSupportedImageBuffer / fetchImageBuffer are module-private,
 * so we exercise them through the public imageLabApplyEffect entrypoint, which
 * runs URL validation → fetch → magic-byte check → size check BEFORE any canvas
 * work. We mock @napi-rs/canvas and r2Service so the test never needs native
 * image decoding; every assertion here fails (throws) before reaching them.
 *
 * Covers:
 *  - validateImageUrl: rejects localhost/private IPs/link-local, accepts public https
 *  - magic bytes (Phase 1.6): a buffer with an invalid signature is rejected
 *  - size limit: oversized data: payload is rejected
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Native canvas — never actually exercised for the rejection paths, but must be
// mockable so the module imports cleanly under node.
const mockLoadImage = vi.fn();
vi.mock('@napi-rs/canvas', () => ({
  createCanvas: vi.fn(() => ({
    getContext: () => ({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: vi.fn(),
    }),
    toDataURL: () => 'data:image/png;base64,AAAA',
  })),
  loadImage: (...args: any[]) => mockLoadImage(...args),
}));

vi.mock('../../../../server/services/r2Service.js', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://cdn.test/uploaded.png'),
}));

const { imageLabApplyEffect } = await import('../../../../server/services/imageLab/index.js');

// data: URL helper — wraps an arbitrary byte signature as base64.
function dataUrl(bytes: number[]): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('imageLab service — security guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // For URL-validation tests that would otherwise reach fetch, make fetch
    // throw so we never hit the network (and to prove validation ran first when
    // it's expected to reject BEFORE fetch).
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch should not be called for blocked URLs');
      })
    );
  });

  // ─── validateImageUrl ──────────────────────────────────────────────────────

  describe('validateImageUrl (via apply-effect)', () => {
    const blocked: [string, string][] = [
      ['localhost', 'http://localhost/x.png'],
      ['loopback IP', 'http://127.0.0.1/x.png'],
      ['0.0.0.0', 'http://0.0.0.0/x.png'],
      ['GCP metadata', 'http://metadata.google.internal/x.png'],
      ['private 10.x', 'http://10.0.0.5/x.png'],
      ['private 192.168.x', 'http://192.168.1.10/x.png'],
      ['private 172.16.x', 'http://172.16.0.1/x.png'],
      ['link-local 169.254.x', 'http://169.254.169.254/x.png'],
    ];

    for (const [label, url] of blocked) {
      it(`rejects ${label}`, async () => {
        await expect(
          imageLabApplyEffect({ imageUrl: url, mode: 'halftone' }, 'user-1')
        ).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
      });
    }

    it('rejects non-http(s) protocols (ftp/file)', async () => {
      await expect(
        imageLabApplyEffect({ imageUrl: 'file:///etc/passwd', mode: 'halftone' }, 'user-1')
      ).rejects.toThrow(/http/i);
    });

    it('rejects an unparseable URL', async () => {
      await expect(
        imageLabApplyEffect({ imageUrl: 'not a url', mode: 'halftone' }, 'user-1')
      ).rejects.toThrow();
    });

    it('allows a public https URL through validation (fails later at fetch, not URL check)', async () => {
      // Public host passes validateImageUrl; the mocked fetch then throws, proving
      // the URL guard did NOT block it.
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('network-marker');
        })
      );
      await expect(
        imageLabApplyEffect({ imageUrl: 'https://cdn.example.com/a.png', mode: 'halftone' }, 'u')
      ).rejects.toThrow(/network-marker/);
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  // ─── Magic bytes (Phase 1.6) ───────────────────────────────────────────────

  describe('magic-byte signature check (via data: URL)', () => {
    it('rejects a buffer with an invalid signature', async () => {
      const badSig = dataUrl([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]); // not any known format
      await expect(
        imageLabApplyEffect({ imageUrl: badSig, mode: 'halftone' }, 'u')
      ).rejects.toThrow(/unsupported or invalid image/i);
      // Never attempted to decode it.
      expect(mockLoadImage).not.toHaveBeenCalled();
    });

    it('rejects an HTML error page masquerading as an image', async () => {
      const html = dataUrl([...Buffer.from('<html><body>404</body></html>')]);
      await expect(imageLabApplyEffect({ imageUrl: html, mode: 'halftone' }, 'u')).rejects.toThrow(
        /unsupported or invalid image/i
      );
    });

    it('accepts a valid PNG signature (passes magic-byte gate, reaches decoder)', async () => {
      // Pad the PNG signature so the buffer is long enough, then let the mocked
      // loadImage throw a marker — proving the magic-byte gate let it through.
      mockLoadImage.mockRejectedValue(new Error('decode-marker'));
      const png = dataUrl([...PNG_SIG, ...new Array(32).fill(0)]);
      await expect(
        imageLabApplyEffect({ imageUrl: png, mode: 'halftone' }, 'u')
      ).rejects.toThrow(/decode-marker/);
      expect(mockLoadImage).toHaveBeenCalledOnce();
    });

    it('accepts an SVG (text-based) signature', async () => {
      mockLoadImage.mockRejectedValue(new Error('decode-marker'));
      const svg = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
      ).toString('base64')}`;
      await expect(
        imageLabApplyEffect({ imageUrl: svg, mode: 'halftone' }, 'u')
      ).rejects.toThrow(/decode-marker/);
    });
  });

  // ─── Size limit ────────────────────────────────────────────────────────────

  describe('size limit', () => {
    it('rejects a data: payload larger than the 50MB cap', async () => {
      // Build a >50MB buffer with a valid PNG header so size — not signature —
      // is the failing gate.
      const big = Buffer.concat([
        Buffer.from(PNG_SIG),
        Buffer.alloc(51 * 1024 * 1024, 0),
      ]);
      const url = `data:image/png;base64,${big.toString('base64')}`;
      await expect(imageLabApplyEffect({ imageUrl: url, mode: 'halftone' }, 'u')).rejects.toThrow(
        /too large/i
      );
      expect(mockLoadImage).not.toHaveBeenCalled();
    });
  });

  // ─── Mode validation ───────────────────────────────────────────────────────

  describe('mode validation', () => {
    it('rejects an unknown effect mode before touching the image', async () => {
      await expect(
        imageLabApplyEffect({ imageUrl: dataUrl(PNG_SIG), mode: 'bogus' as any }, 'u')
      ).rejects.toThrow(/invalid mode/i);
    });

    it('rejects a missing imageUrl', async () => {
      await expect(
        imageLabApplyEffect({ imageUrl: '', mode: 'halftone' }, 'u')
      ).rejects.toThrow(/imageUrl is required/i);
    });
  });
});
