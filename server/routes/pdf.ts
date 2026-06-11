import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { stripDataUriPrefix } from '../lib/dataUri.js';
import {
  compressPdf,
  convertToCmyk,
  rasterizePages,
  imagesToPdf,
  mergePdfs,
  convertToPdfA,
  convertEpsToPdf,
} from '../services/ghostscriptService.js';

const router = Router();

const pdfRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/pdf/compress
router.post('/compress', pdfRateLimit, authenticate, async (req: AuthRequest, res) => {
  try {
    const { pdf, preset = 'ebook' } = req.body as {
      pdf?: string;
      preset?: 'screen' | 'ebook' | 'printer' | 'prepress';
    };

    if (!pdf) return res.status(400).json({ error: 'pdf (base64) is required' });

    const validPresets = ['screen', 'ebook', 'printer', 'prepress'];
    if (!validPresets.includes(preset)) {
      return res.status(400).json({ error: `Invalid preset. Use: ${validPresets.join(', ')}` });
    }

    const inputBuf = Buffer.from(pdf.replace(/^data:application\/pdf;base64,/, ''), 'base64');
    const result = await compressPdf(inputBuf, preset);

    res.json({
      pdf: result.toString('base64'),
      originalSize: inputBuf.length,
      compressedSize: result.length,
      savings: Math.round((1 - result.length / inputBuf.length) * 100),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Compression failed' });
  }
});

// POST /api/pdf/to-images
router.post('/to-images', pdfRateLimit, authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      pdf,
      dpi = 150,
      format = 'png',
      pages,
    } = req.body as {
      pdf?: string;
      dpi?: number;
      format?: 'png' | 'jpeg';
      pages?: string;
    };

    if (!pdf) return res.status(400).json({ error: 'pdf (base64) is required' });

    const clampedDpi = Math.min(Math.max(dpi, 72), 600);
    const images = await rasterizePages(pdf, { dpi: clampedDpi, format, pages });

    res.json({
      images: images.map((buf, i) => ({
        page: i + 1,
        data: `data:image/${format};base64,${buf.toString('base64')}`,
        size: buf.length,
      })),
      pageCount: images.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Rasterization failed' });
  }
});

// POST /api/pdf/from-images
router.post('/from-images', pdfRateLimit, authenticate, async (req: AuthRequest, res) => {
  try {
    const { images } = req.body as { images?: string[] };

    if (!images?.length) return res.status(400).json({ error: 'images[] (base64) is required' });

    const buffers = images.map((img) => {
      const cleaned = stripDataUriPrefix(img);
      return Buffer.from(cleaned, 'base64');
    });

    const result = await imagesToPdf(buffers);

    res.json({
      pdf: result.toString('base64'),
      size: result.length,
      pageCount: images.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'PDF creation failed' });
  }
});

// POST /api/pdf/merge
router.post('/merge', pdfRateLimit, authenticate, async (req: AuthRequest, res) => {
  try {
    const { pdfs } = req.body as { pdfs?: string[] };

    if (!pdfs?.length || pdfs.length < 2) {
      return res.status(400).json({ error: 'At least 2 PDFs required' });
    }

    const buffers = pdfs.map((p) => {
      const cleaned = p.replace(/^data:application\/pdf;base64,/, '');
      return Buffer.from(cleaned, 'base64');
    });

    const result = await mergePdfs(buffers);

    res.json({
      pdf: result.toString('base64'),
      size: result.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Merge failed' });
  }
});

// POST /api/pdf/cmyk
router.post('/cmyk', pdfRateLimit, authenticate, async (req: AuthRequest, res) => {
  try {
    const { pdf } = req.body as { pdf?: string };
    if (!pdf) return res.status(400).json({ error: 'pdf (base64) is required' });

    const result = await convertToCmyk(pdf);

    res.json({
      pdf: result.toString('base64'),
      size: result.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'CMYK conversion failed' });
  }
});

// POST /api/pdf/pdfa
router.post('/pdfa', pdfRateLimit, authenticate, async (req: AuthRequest, res) => {
  try {
    const { pdf } = req.body as { pdf?: string };
    if (!pdf) return res.status(400).json({ error: 'pdf (base64) is required' });

    const result = await convertToPdfA(pdf);

    res.json({
      pdf: result.toString('base64'),
      size: result.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'PDF/A conversion failed' });
  }
});

export default router;
