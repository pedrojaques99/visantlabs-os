import express from 'express';
import { validateExternalUrl, getErrorMessage } from '../utils/securityValidation';

const router = express.Router();

// Get API key for Google services
const getGoogleApiKey = (): string | null => {
  return (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim() || null;
};

/**
 * Proxy endpoint to fetch images from R2 and return as base64
 * This bypasses CORS restrictions by fetching server-side
 * GET /api/images/proxy?url=<encoded-r2-url>
 */
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid url parameter',
      });
    }

    // Validate URL format and SSRF protection
    const urlValidation = validateExternalUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        error: urlValidation.error || 'Invalid URL',
      });
    }

    // Fetch the image from the URL
    let response: Response;
    try {
      response = await fetch(urlValidation.url!, {
        method: 'GET',
        headers: {
          'User-Agent': 'VSN-Mockup-Machine/1.0',
        },
      });
    } catch (error: unknown) {
      console.error('Error fetching image from URL:', error);
      return res.status(500).json({
        error: 'Failed to fetch image from URL',
        message: getErrorMessage(error),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch image',
        status: response.status,
        statusText: response.statusText,
      });
    }

    // Check if response is an image or PDF
    const contentType = response.headers.get('content-type');
    if (!contentType || (!contentType.startsWith('image/') && contentType !== 'application/pdf')) {
      return res.status(400).json({
        error: 'URL does not point to an image or PDF',
        contentType: contentType || 'unknown',
      });
    }

    // Convert to buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return res.status(400).json({
        error: 'Image file is empty',
      });
    }

    // Convert buffer to base64
    const base64 = buffer.toString('base64');

    // Return base64 with mime type
    res.json({
      base64,
      mimeType: contentType,
    });
  } catch (error: unknown) {
    console.error('Error in image proxy:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: getErrorMessage(error),
    });
  }
});

/**
 * Proxy endpoint to fetch videos from Google Cloud Storage with authentication
 * GET /api/images/video-proxy?url=<encoded-video-url>
 */
router.get('/video-proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid url parameter',
      });
    }

    // Validate URL format and SSRF protection
    const urlValidation = validateExternalUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        error: urlValidation.error || 'Invalid URL',
      });
    }

    // Parse URL for hostname check (already validated above)
    const videoUrl = new URL(urlValidation.url!);

    // Get Google API key for authentication
    const apiKey = getGoogleApiKey();

    // Fetch the video from the validated URL with authentication if it's a Google Cloud Storage URL
    let response: Response;
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'VSN-Mockup-Machine/1.0',
      };

      // Add API key if available (for Google Cloud Storage)
      if (apiKey && (videoUrl.hostname.includes('googleapis.com') || videoUrl.hostname.includes('storage.googleapis.com'))) {
        headers['x-goog-api-key'] = apiKey;
      }

      response = await fetch(urlValidation.url!, {
        method: 'GET',
        headers,
      });
    } catch (error: unknown) {
      console.error('Error fetching video from URL:', error);
      return res.status(500).json({
        error: 'Failed to fetch video from URL',
        message: getErrorMessage(error),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch video',
        status: response.status,
        statusText: response.statusText,
      });
    }

    // Check if response is a video
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('video/')) {
      return res.status(400).json({
        error: 'URL does not point to a video',
        contentType: contentType || 'unknown',
      });
    }

    // Stream the video response
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', response.headers.get('content-length') || '');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Pipe the video data to response
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return res.status(400).json({
        error: 'Video file is empty',
      });
    }

    // Send as base64 for client compatibility
    const base64 = buffer.toString('base64');

    res.json({
      base64,
      mimeType: contentType,
    });
  } catch (error: unknown) {
    console.error('Error in video proxy:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: getErrorMessage(error),
    });
  }
});

export default router;

/**
 * Stream proxy endpoint to fetch images from R2 and stream them directly
 * This is used for <img src="..." /> tags where we need CORS headers
 * GET /api/images/stream?url=<encoded-r2-url>
 */
router.get('/stream', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing using url parameter');
    }

    // Validate URL format and SSRF protection
    const urlValidation = validateExternalUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).send(urlValidation.error || 'Invalid URL');
    }

    // Fetch the image from the validated URL
    const response = await fetch(urlValidation.url!, {
      method: 'GET',
      headers: {
        'User-Agent': 'VSN-Mockup-Machine/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Set CORS headers to allow canvas usage
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the body
    if (response.body) {
      // @ts-ignore - ReadableStream/Node stream mismatch
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }

  } catch (error: unknown) {
    console.error('Error in image stream proxy:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
});

