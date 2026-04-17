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
import { mediaSessionCache } from '../lib/mediaSessionCache.js';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, hashQuery, hashObject } from '../lib/cache-utils.js';

const execPromise = promisify(exec);

// Cache for extraction results (30 minute TTL)
const extractionCache = new LRUCache<string, any>({
  max: 200,
  ttl: 1000 * 60 * 30,
});

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

// Rate limiter for media session reads (lightweight endpoint)
const sessionReadLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_SESSION_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_SESSION || '30', 10), // More lenient for reads
  message: { error: 'Too many session requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Don't rate limit if content-type is not json (security: prevent abuse)
    return req.method === 'GET' && !req.is('application/json');
  },
});

const router = express.Router();

/**
 * Extract images from Instagram using Firecrawl
 * POST /api/images/instagram-extract
 * Body: { username: string, limit?: number }
 */

/**
 * Unified Search endpoint (Google Images + Instagram)
 * POST /api/images/search
 * Body: { query: string, mode: 'google' | 'instagram', limit?: number }
 */
router.post('/search', authenticate, apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { query, mode = 'google', limit = 40, designerParams } = req.body;
    const serperKey = process.env.SERPER_API_KEY;

    if (!serperKey) {
      return res.status(500).json({ error: 'Search engine not configured (missing Serper API Key)' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Security: Sanitize query
    const safeQuery = query.trim().replace(/[<>"{}]/g, '');
    
    // Construct final query based on mode
    let finalQuery = safeQuery;
    let tbs = '';

    if (mode === 'instagram') {
      const handle = safeQuery.startsWith('@') ? safeQuery.slice(1) : safeQuery;
      finalQuery = `site:instagram.com "${handle}" -reels -video -stories`;
    } else {
      // Prioritize clean, production-ready assets
      // Exclude stock clusters, watermarks, commercial patterns, and paid stock sites
      const negativeOperators = [
        '-stock', '-watermark', '-template', '-mockup', '-flyer',
        ...(designerParams?.type !== 'clipart' ? ['-clipart', '-vector', '-cartoon'] : [])
      ];

      finalQuery = `${safeQuery} ${negativeOperators.join(' ')}`;
    }

    // Process Designer Parameters (tbs)
    if (designerParams && typeof designerParams === 'object') {
      const filters: string[] = [];
      
      // Size filter
      if (designerParams.size === 'large') filters.push('isz:l');
      
      // Type/Color filters
      if (designerParams.type === 'transparent') filters.push('ic:trans');
      if (designerParams.type === 'clipart') filters.push('itp:clipart');
      if (designerParams.type === 'lineart') filters.push('itp:lineart');
      if (designerParams.type === 'photo') filters.push('itp:photo');
      
      // Aspect ratio
      if (designerParams.aspect === 'square') filters.push('iar:s');
      if (designerParams.aspect === 'wide') filters.push('iar:w');
      if (designerParams.aspect === 'tall') filters.push('iar:t');
      
      if (filters.length > 0) {
        tbs = filters.join(',');
      }
    }

    // Cache check
    const userId = (req as any).userId || 'guest';
    const cacheHash = hashQuery(finalQuery, `${mode}-${limit}-${tbs}`);
    const redisCacheKey = CacheKey.imageSearch(userId, cacheHash);

    // Track session user
    mediaSessionCache.trackQuery(userId, safeQuery, mode);

    // 🟢 CACHE CHECK (Redis first, then local LRU)
    const redisCache = await redisClient.get(redisCacheKey).catch(() => null);
    if (redisCache) {
      const cached = JSON.parse(redisCache);
      return res.json({ success: true, count: cached.length, images: cached, fromCache: true });
    }

    // Fall back to local LRU
    const lruCacheKey = `search-${userId}-${mode}-${finalQuery}-${limit}-${tbs}`;
    const lruCached = extractionCache.get(lruCacheKey);
    if (lruCached) return res.json({ success: true, count: lruCached.length, images: lruCached, fromCache: true });

    console.log(`🔍 [Serper] Searching: "${finalQuery}" (Mode: ${mode}, tbs: ${tbs})`);

    const response = await safeFetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: finalQuery,
        num: limit,
        gl: 'br',
        hl: 'pt-br',
        tbs: tbs || undefined
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Serper API error');
    }

    const data = await response.json();
    const rawImages = data.images || [];

    // Transform, Filter and Sort by Resolution (HD first)
    const results = rawImages
      .filter((img: any) => {
        // Skip video/reels
        const isReel = img.imageUrl?.includes('/reels/') || img.link?.includes('/reels/') || img.title?.toLowerCase().includes('reel');
        const isVideo = img.imageUrl?.includes('video') || img.title?.toLowerCase().includes('video');
        if (isReel || isVideo) return false;

        const url = (img.imageUrl || '').toLowerCase();
        const title = (img.title || '').toLowerCase();
        const domain = (img.domain || '').toLowerCase();

        // ========== PAID STOCK SITES ==========
        const paidStockSites = [
          // Adobe family
          'adobestock', 'stock.adobe',
          // Getty & premium
          'gettyimages', 'istock', 'pond5',
          // Stock-specific
          'shutterstock', 'alamy', 'dreamstime', 'depositphotos', 'fotolia',
          '123rf', 'clipart.com', 'canstockphoto',
          // Free but often watermarked
          'pixabay', 'pexels', 'stockvault'
        ];
        if (paidStockSites.some(p => url.includes(p) || domain.includes(p))) {
          return false;
        }

        // ========== WATERMARK & TARJA DETECTION ==========
        const watermarkKeywords = [
          'watermark', 'watermarked', 'tarja', 'stamp', '©', '®',
          'copyright', 'all rights reserved',
          'confidential', 'draft',
          'logo watermark', 'brand watermark'
        ];
        if (watermarkKeywords.some(k => title.includes(k))) {
          return false;
        }

        // ========== COMMERCIAL/TEMPLATE CONTENT ==========
        const commercialPatterns = [
          // Templates & mockups
          'template', 'mockup', 'psd file', 'photoshop',
          // Marketing materials
          'flyer', 'poster', 'brochure', 'leaflet', 'pamphlet', 'infographic',
          'presentation', 'slide deck', 'powerpoint',
          // Social media templates
          'facebook cover', 'facebook post', 'instagram post', 'instagram story',
          'twitter header', 'linkedin banner', 'youtube thumbnail',
          // Graphics with text/logos
          'business card', 'letterhead', 'envelope', 'packaging',
          // Commercial indicators
          'buy now', 'for sale', 'subscribe', 'premium', 'pro version',
          'licensed', 'commercial use', 'resale rights'
        ];
        if (commercialPatterns.some(p => title.includes(p))) {
          return false;
        }

        // ========== CLIPART & VECTOR EXCLUSION ==========
        if (designerParams?.type !== 'clipart') {
          const clipartPatterns = [
            'clipart', 'vector', 'illustration', 'cartoon', 'drawing',
            'graphic design', 'digital art', 'animated'
          ];
          if (clipartPatterns.some(p => title.includes(p) || url.includes(p))) {
            return false;
          }
        }

        // ========== LOW-QUALITY INDICATORS ==========
        // Reject if title suggests bad quality
        const lowQualityPatterns = [
          'low res', 'low quality', 'pixelated', 'blurry',
          'placeholder', 'no image', 'image not found'
        ];
        if (lowQualityPatterns.some(p => title.includes(p))) {
          return false;
        }

        return true;
      })
      .map((img: any) => ({
        url: img.imageUrl,
        title: img.title || 'Untitled',
        width: img.imageWidth || 0,
        height: img.imageHeight || 0,
        thumbnailUrl: img.thumbnailUrl,
        source: mode === 'instagram' ? 'Instagram' : 'Google Search',
        domain: img.domain,
        link: img.link
      }));

    // Perform sort by resolution (HD first)
    results.sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height));

    // 💾 CACHE SET (Redis + local LRU)
    await redisClient.setex(redisCacheKey, CACHE_TTL.IMAGE_SEARCH, JSON.stringify(results)).catch(() => {});
    extractionCache.set(lruCacheKey, results);

    // Add to user session history
    mediaSessionCache.addToHistory(userId, {
      type: 'search',
      query: safeQuery,
      mode,
      resultCount: results.length,
    });

    return res.json({ success: true, count: results.length, images: results });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search images', message: error.message });
  }
});

/**
 * Extract Images from Website URL
 * POST /api/images/extract-url
 * Body: { url: string, limit?: number }
 */
router.post('/extract-url', authenticate, apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { url, limit = 50 } = req.body;

    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Security: Strict SSRF validation
    const urlValidation = validateExternalUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({ error: 'Invalid or forbidden URL', details: urlValidation.error });
    }

    const targetUrl = urlValidation.url!;
    const userId = (req as any).userId || 'guest';
    const cacheHash = hashQuery(targetUrl, String(limit));
    const redisCacheKey = CacheKey.imageExtract(userId, cacheHash);

    // 🟢 CACHE CHECK (Redis first, then local LRU)
    const redisCache = await redisClient.get(redisCacheKey).catch(() => null);
    if (redisCache) {
      const cached = JSON.parse(redisCache);
      return res.json({ success: true, count: cached.length, images: cached, fromCache: true });
    }

    const lruCacheKey = `url-${userId}-${targetUrl}-${limit}`;
    const lruCached = extractionCache.get(lruCacheKey);
    if (lruCached) return res.json({ success: true, count: lruCached.length, images: lruCached, fromCache: true });

    console.log(`🌐 [Firecrawl] Extracting from: ${targetUrl}`);

    // Call Firecrawl Scrape (Cheaper mode)
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) return res.status(500).json({ error: 'Scraping engine not configured' });

    const response = await safeFetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['rawHtml', 'markdown'],
        onlyMainContent: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl error: ${response.statusText}`);
    }

    const content = await response.json();
    const html = content.data?.rawHtml || '';

    // Security: Parse HTML securely (regex for src only)
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const foundUrls = new Set<string>();
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) {
        const urlObj = new URL(targetUrl);
        src = `${urlObj.protocol}//${urlObj.host}${src}`;
      }

      // Filter out tiny UI elements, icons, base64 data strings (to avoid bloat)
      if (src.startsWith('http') && !src.includes('base64') && !src.endsWith('.svg')) {
        foundUrls.add(src);
      }
    }

    const results = Array.from(foundUrls).slice(0, limit).map(src => ({
      url: src,
      title: 'Extracted Content',
      width: 0, // Firecrawl doesn't return dimensions easily
      height: 0
    }));

    // 💾 CACHE SET (Redis + local LRU)
    await redisClient.setex(redisCacheKey, CACHE_TTL.IMAGE_SEARCH, JSON.stringify(results)).catch(() => {});
    extractionCache.set(lruCacheKey, results);
    return res.json({ success: true, count: results.length, images: results });
  } catch (error: any) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Failed to extract images from URL', message: error.message });
  }
});

/**
 * Extract Images from PDF/Doc Page (Gemini Proxy)
 * POST /api/images/extract-doc
 * Body: { imageBase64: string, pageNumber: number }
 */
router.post('/extract-doc', authenticate, apiRateLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const { imageBase64, pageNumber } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'Page image is required' });

    // Use Docling-like prompt logic ported to server
    const prompt = `Analyze this document page and identify all high-quality visual elements (images, charts, photos).
    Rules:
    1. For each image, provide a name, brief description, and its bounding box.
    2. Bounding box must be [ymin, xmin, ymax, xmax] in 0-1000 scale.
    3. Return in JSON format.`;

    const { GoogleGenAI } = await import('@google/genai');
    const { GEMINI_MODELS } = await import('../../src/constants/geminiModels.js');
    const apiKey = getGoogleApiKey();
    if (!apiKey) throw new Error('AI API Key not configured');

    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: GEMINI_MODELS.IMAGE_NB2,
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64, mimeType: "image/png" } }
        ]
      }]
    });

    // Extract text from response
    let text = '';
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        text += part.text;
      }
    }

    // Security: Basic JSON cleaning
    const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return res.json({ success: true, pageNumber, data });
  } catch (error: any) {
    console.error('Doc extraction error:', error);
    res.status(500).json({ error: 'AI failed to process document page' });
  }
});

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
    const cacheHash = hashQuery(username, String(limit));
    const redisCacheKey = CacheKey.instagramExtract(userId, cacheHash);

    // Track session user
    mediaSessionCache.trackQuery(userId, username, 'instagram');

    // 🟢 CACHE CHECK (Redis first, then local LRU)
    const redisCache = await redisClient.get(redisCacheKey).catch(() => null);
    if (redisCache) {
      const cachedData = JSON.parse(redisCache);
      console.log(`ℹ️ Returning cached Instagram extraction for: ${username}`);
      return res.json({
        success: true,
        username,
        count: cachedData.length,
        images: cachedData,
        fromCache: true
      });
    }

    const lruCacheKey = `${userId}-${username}-${limit}`;
    const cachedData = instaCache.get(lruCacheKey);
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
    const prompt = `CRITICAL: Extract ONLY static image URLs from the Instagram profile grid of @${cleanUsername}.

STRICT REQUIREMENTS:
1. Extract ONLY single PHOTO/IMAGE posts from the profile grid
2. MUST BE static JPG/PNG images - absolutely NO video content
3. EXCLUDE EVERYTHING THAT IS NOT A STATIC IMAGE:
   - Reels (short videos)
   - Video posts
   - IGTV
   - Stories
   - Carousel/Albums (multiple images)
   - GIFs or animated content
4. Get the TOP ${limit} image posts only
5. Extract: direct image URL and caption text

RESPONSE FORMAT: Return ONLY valid JSON array:
[{"url": "https://...", "caption": "..."}, ...]

DO NOT include any text, markdown, or explanation. ONLY JSON.`;
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

    let extractedImages = Array.isArray(data) ? data : (data.images || data.data || []);

    if (!extractedImages || extractedImages.length === 0) {
      return res.status(404).json({ error: 'No images found for this profile' });
    }

    // Debug: log all extracted URLs to identify patterns
    console.log(`📊 Firecrawl extracted ${extractedImages.length} items for @${cleanUsername}:`);
    extractedImages.slice(0, 5).forEach((item: any, idx: number) => {
      console.log(`  [${idx}] URL: ${String(item.url || '').slice(0, 100)}`);
      console.log(`      Caption: ${String(item.caption || '').slice(0, 80)}`);
    });

    // Filter out reels and videos (safety net in case Firecrawl included them)
    const beforeFilter = extractedImages.length;
    extractedImages = extractedImages.filter((item: any) => {
      if (!item || typeof item !== 'object') return false;

      const url = String(item.url || '').toLowerCase();
      const caption = String(item.caption || '').toLowerCase();

      // Exclude reels - multiple patterns
      if (
        url.includes('/reel') ||
        url.includes('/reels/') ||
        url.includes('/tv/') ||  // Instagram TV / Reels are under /tv/
        caption.includes('reel') ||
        caption.includes('video')
      ) {
        console.log(`  ❌ Filtered reel/tv: ${url.slice(0, 80)}`);
        return false;
      }

      // Exclude videos (mp4, webm, video indicators in URL/caption)
      if (
        url.includes('video') ||
        url.includes('.mp4') ||
        url.includes('.webm') ||
        url.includes('.mov') ||
        url.includes('.m4v')
      ) {
        console.log(`  ❌ Filtered video file: ${url.slice(0, 80)}`);
        return false;
      }

      return true;
    });

    console.log(`✅ After filter: ${beforeFilter} → ${extractedImages.length} items`);

    // Map the results (no R2 upload as requested by user in previous session)
    const results = extractedImages.slice(0, limit).map((item: any) => ({
      url: item.url,
      caption: item.caption || '',
    }));

    // 💾 CACHE SET (Redis + local LRU)
    await redisClient.setex(redisCacheKey, CACHE_TTL.INSTAGRAM, JSON.stringify(results)).catch(() => {});
    instaCache.set(lruCacheKey, results);

    // Add to user session history
    mediaSessionCache.addToHistory(userId, {
      type: 'instagram',
      query: cleanUsername,
      mode: 'instagram',
      resultCount: results.length,
    });

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

/**
 * Get user media session data and extraction history
 * Rate-limited endpoint for per-user extraction session retrieval
 *
 * Security:
 * - Authenticated only (authenticate middleware)
 * - Rate limited (sessionReadLimiter)
 * - Input validation on query parameters
 * - User isolation enforced
 *
 * GET /api/images/session?limit=20 (optional, default 20, max 100)
 */
router.get('/session', authenticate, sessionReadLimiter, async (req: Request, res: ExpressResponse) => {
  try {
    const userId = (req as any).userId || 'guest';

    // Validate and sanitize limit parameter
    let limit = 20; // default
    if (req.query.limit) {
      const parsed = parseInt(String(req.query.limit));
      if (!isNaN(parsed)) {
        limit = Math.max(1, Math.min(parsed, 100)); // Clamp between 1-100
      }
    }

    try {
      const session = mediaSessionCache.getSession(userId);
      const history = mediaSessionCache.getHistory(userId, limit);

      // Always return success with null session if not found (don't expose that user doesn't exist)
      return res.json({
        userId,
        session: session ? {
          lastActivity: session.lastActivity,
          extractionModes: session.extractionModes,
          recentQueries: session.recentQueries,
          preferences: session.preferences,
        } : null,
        history,
      });
    } catch (validationError: any) {
      // Invalid user ID or other validation error
      console.warn('Session validation error:', {
        userId: String(userId).slice(0, 20),
        error: validationError.message,
      });
      return res.status(400).json({
        error: 'Invalid session request',
        message: 'Invalid user ID format',
      });
    }
  } catch (error: any) {
    console.error('Error retrieving session:', {
      message: getErrorMessage(error),
      path: req.path,
    });
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: 'An error occurred while fetching session data',
    });
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

