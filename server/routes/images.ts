import express, { Request, Response as ExpressResponse } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { validateExternalUrl, getErrorMessage, safeFetch, SSRFValidationError } from '../utils/securityValidation.js';
import { rateLimit } from 'express-rate-limit';
import { LRUCache } from 'lru-cache';
import { uploadImage, isR2Configured } from '../services/r2Service.js';
import { authenticate } from '../middleware/auth.js';

const execPromise = promisify(exec);

// Cache for Instagram extraction results (30 minute TTL)
const instaCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 30,
});

// API rate limiter - general authenticated endpoints
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

/**
 * Extract images from Instagram using Firecrawl
 * POST /api/images/instagram-extract
 * Body: { username: string, limit?: number }
 */
router.post('/instagram-extract', authenticate, apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  // Set explicit long timeout for Firecrawl Agent (5 minutes)
  req.setTimeout(300000);
  
  try {
    const { username, limit = 40 } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check cache first (per user session)
    const userId = (req as any).userId || 'guest';
    const cacheKey = `${userId}-${username}-${limit}`;
    const cachedData = instaCache.get(cacheKey);
    if (cachedData) {
      console.log(`ℹ️ Returning cached Instagram extraction for: ${username}`);
      return res.json({ 
        success: true, 
        username,
        count: cachedData.length,
        images: cachedData,
        fromCache: true
      });
    }

    // Basic sanitization of username
    const cleanUsername = username.replace(/[^a-zA-Z0-9._]/g, '');
    const instagramUrl = `https://www.instagram.com/${cleanUsername}/`;

    console.log(`📸 Starting Instagram extraction for: ${cleanUsername} (limit: ${limit}) [Cache Session Mode]`);

    // Ensure .firecrawl directory exists for temporary storage
    const firecrawlDir = path.join(process.cwd(), '.firecrawl');
    if (!fs.existsSync(firecrawlDir)) {
      fs.mkdirSync(firecrawlDir, { recursive: true });
    }

    const outputFile = path.join(firecrawlDir, `insta-${cleanUsername}-${Date.now()}.json`);
    
    // Construct Firecrawl agent command
    // Using spark-1-mini for speed and a focused prompt to avoid deep navigation
    const prompt = `Extract the direct image URLs and captions for the ${limit} most recent posts from the Instagram profile grid of @${cleanUsername}. Return ONLY a JSON array of objects with 'url' and 'caption'. Do not navigate deep into each post if not necessary.`;
    const command = `firecrawl agent "${prompt}" --urls "${instagramUrl}" --model spark-1-mini --wait --pretty -o "${outputFile}"`;

    console.log(`🚀 Executing: ${command}`);

    try {
      await execPromise(command);
    } catch (execError: any) {
      console.error('Firecrawl execution failed:', execError);
      
      // Check if it was a timeout or a specific error
      const isTimeout = execError.message?.toLowerCase().includes('timeout') || execError.code === 'ETIMEDOUT';
      
      return res.status(500).json({ 
        error: isTimeout ? 'Extraction timed out' : 'Scraping failed', 
        details: execError.message,
        help: 'Try again with a public profile or check if the profile exists.'
      });
    }

    // Read the results
    if (!fs.existsSync(outputFile)) {
      console.error(`❌ Output file not found: ${outputFile}`);
      return res.status(500).json({ error: 'Scraping finished but no output file was generated' });
    }

    const fileContent = fs.readFileSync(outputFile, 'utf8');
    
    // Attempt to parse JSON (Firecrawl agent sometimes adds markdown blocks)
    let data: any;
    try {
      // Basic cleaning in case the agent wrapped the JSON in markdown
      const jsonMatch = fileContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
      const cleanJson = jsonMatch ? jsonMatch[0] : fileContent;
      data = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse Firecrawl output:', parseError);
      return res.status(500).json({ error: 'Failed to process extracted data' });
    }

    const extractedImages = Array.isArray(data) ? data : (data.images || data.data || []);

    if (!extractedImages || extractedImages.length === 0) {
      return res.status(404).json({ error: 'No images found for this profile' });
    }

    // Map the results (no R2 upload as requested by user in previous session)
    const results = extractedImages.slice(0, limit).map((item: any) => ({
      url: item.url,
      caption: item.caption || '',
    }));

    // Store in cache
    instaCache.set(cacheKey, results);

    // Clean up temp file
    try {
      fs.unlinkSync(outputFile);
    } catch (err) {
      // Ignore cleanup errors
    }

    return res.json({ 
      success: true, 
      username: cleanUsername,
      count: results.length,
      images: results 
    });

  } catch (error: any) {
    console.error('Error in Instagram extraction:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Get API key for Google services
const getGoogleApiKey = (): string | null => {
  return (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim() || null;
};

/**
 * Proxy endpoint to fetch images from R2 and return as base64
 * This bypasses CORS restrictions by fetching server-side
 * GET /api/images/proxy?url=<encoded-r2-url>
 */
router.get('/proxy', apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid url parameter',
      });
    }

    let response: globalThis.Response;
    try {
      response = await safeFetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'VSN-Mockup-Machine/1.0',
        },
      });
    } catch (error: unknown) {
      if (error instanceof SSRFValidationError) {
        return res.status(400).json({ error: error.message });
      }
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
router.get('/video-proxy', apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid url parameter',
      });
    }

    const urlValidation = validateExternalUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        error: urlValidation.error || 'Invalid URL',
      });
    }

    const videoUrl = new URL(urlValidation.url!);
    const apiKey = getGoogleApiKey();

    // Whitelist of allowed Google Cloud Storage hostnames
    const allowedGoogleHosts = [
      'storage.googleapis.com',
      'googleapis.com',
    ];

    const headers: Record<string, string> = {
      'User-Agent': 'VSN-Mockup-Machine/1.0',
    };
    if (apiKey && allowedGoogleHosts.includes(videoUrl.hostname)) {
      headers['x-goog-api-key'] = apiKey;
    }

    let response: globalThis.Response;
    try {
      response = await safeFetch(url, {
        method: 'GET',
        headers,
      });
    } catch (error: unknown) {
      if (error instanceof SSRFValidationError) {
        return res.status(400).json({ error: error.message });
      }
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


/**
 * Proxy download endpoint to fetch images from external URLs and trigger a local download
 * GET /api/images/download?url=<encoded-url>&filename=<optional-name>
 */
router.get('/download', apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { url, filename } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing url parameter');
    }

    let response: globalThis.Response;
    try {
      response = await safeFetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'VSN-Mockup-Machine/1.0',
        },
      });
    } catch (error: unknown) {
      if (error instanceof SSRFValidationError) {
        return res.status(400).send(error.message);
      }
      throw error;
    }

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch content: ${response.statusText}`);
    }

    // Get content type and set headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const downloadName = filename || `download-${Date.now()}.${contentType.split('/')[1] || 'ext'}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

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
    console.error('Error in image download proxy:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
});

export default router;

/**
 * Stream proxy endpoint to fetch images from R2 and stream them directly
 * This is used for <img src="..." /> tags where we need CORS headers
 * GET /api/images/stream?url=<encoded-r2-url>
 */
router.get('/stream', apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing using url parameter');
    }

    let response: Response;
    try {
      response = await safeFetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'VSN-Mockup-Machine/1.0',
        },
      });
    } catch (error: unknown) {
      if (error instanceof SSRFValidationError) {
        return res.status(400).send(error.message);
      }
      throw error;
    }

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

