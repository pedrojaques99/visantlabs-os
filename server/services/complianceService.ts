/**
 * Brand Compliance Service
 *
 * Analyzes content (colors, text, images) against brand guidelines
 * and returns a compliance score with specific violations.
 */

import { GoogleGenAI } from '@google/genai';
import type { BrandGuideline } from '../../src/lib/figma-types.js';
import { buildBrandContext } from '../lib/brandContextBuilder.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ComplianceCheckInput {
  /** Colors to check (hex format) */
  colors?: string[];
  /** Text content to analyze tone/voice */
  text?: string;
  /** Image to analyze (base64 or URL) */
  image?: {
    base64?: string;
    url?: string;
    mimeType?: string;
  };
  /** Options */
  checkContrast?: boolean;
  checkColors?: boolean;
  checkTone?: boolean;
}

export interface ComplianceViolation {
  type: 'color-mismatch' | 'contrast' | 'tone' | 'imagery';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
  affected?: {
    hex?: string;
    contrast?: number;
    expected?: string;
  };
}

export interface ComplianceResult {
  complianceScore: number;
  violations: ComplianceViolation[];
  summary: {
    onBrandColors: number;
    contrastCompliance: 'AAA' | 'AA' | 'FAIL' | 'N/A';
    toneMatch: number;
  };
  aiAnalysis?: {
    isOnBrand: boolean;
    confidence: number;
    notes: string;
  };
}

// --------------------------------------------------------------------------
// Color Utilities (duplicated from frontend to avoid import issues)
// --------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1: string, color2: string): number {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt(
    Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2)
  );
}

// --------------------------------------------------------------------------
// Core Compliance Checks
// --------------------------------------------------------------------------

/**
 * Check if provided colors match brand palette
 */
function checkColorCompliance(
  inputColors: string[],
  brandColors: Array<{ hex: string; name: string; role?: string }>
): { violations: ComplianceViolation[]; onBrandPercent: number } {
  const violations: ComplianceViolation[] = [];
  let matchCount = 0;

  const brandHexes = brandColors.map((c) => c.hex.toLowerCase());
  const SIMILARITY_THRESHOLD = 50; // RGB distance threshold for "similar"

  for (const inputHex of inputColors) {
    const normalized = inputHex.toLowerCase();

    // Exact match
    if (brandHexes.includes(normalized)) {
      matchCount++;
      continue;
    }

    // Check for similar color
    let closestDistance = Infinity;
    let closestBrand: string | null = null;

    for (const brandHex of brandHexes) {
      const dist = colorDistance(normalized, brandHex);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestBrand = brandHex;
      }
    }

    if (closestDistance <= SIMILARITY_THRESHOLD) {
      // Close enough - count as match but note it
      matchCount++;
    } else {
      // Off-brand color
      violations.push({
        type: 'color-mismatch',
        severity: 'medium',
        message: `Color ${inputHex} is not in brand palette`,
        suggestion: closestBrand
          ? `Consider using ${closestBrand} instead`
          : 'Use a color from the brand palette',
        affected: { hex: inputHex, expected: closestBrand || undefined },
      });
    }
  }

  const onBrandPercent =
    inputColors.length > 0 ? Math.round((matchCount / inputColors.length) * 100) : 100;

  return { violations, onBrandPercent };
}

/**
 * Check contrast between color pairs
 */
function checkContrastCompliance(
  colors: string[]
): { violations: ComplianceViolation[]; compliance: 'AAA' | 'AA' | 'FAIL' } {
  const violations: ComplianceViolation[] = [];
  let worstCompliance: 'AAA' | 'AA' | 'FAIL' = 'AAA';

  // Check all pairs (text on background scenarios)
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const ratio = getContrastRatio(colors[i], colors[j]);

      if (ratio < 3.0) {
        // Fails even large text AA
        violations.push({
          type: 'contrast',
          severity: 'critical',
          message: `Contrast between ${colors[i]} and ${colors[j]} is ${ratio.toFixed(2)}:1 (fails WCAG)`,
          suggestion: 'Increase contrast to at least 4.5:1 for normal text',
          affected: { contrast: ratio },
        });
        worstCompliance = 'FAIL';
      } else if (ratio < 4.5) {
        // Fails normal text AA
        if (worstCompliance !== 'FAIL') {
          violations.push({
            type: 'contrast',
            severity: 'high',
            message: `Contrast between ${colors[i]} and ${colors[j]} is ${ratio.toFixed(2)}:1 (AA for large text only)`,
            suggestion: 'Consider increasing contrast for better accessibility',
            affected: { contrast: ratio },
          });
          worstCompliance = 'AA';
        }
      } else if (ratio < 7.0) {
        // Passes AA but not AAA
        if (worstCompliance === 'AAA') {
          worstCompliance = 'AA';
        }
      }
      // >= 7.0 passes AAA
    }
  }

  return { violations, compliance: worstCompliance };
}

/**
 * Analyze text tone using Gemini
 */
async function analyzeTextTone(
  text: string,
  guideline: BrandGuideline,
  apiKey?: string
): Promise<{ toneMatch: number; violations: ComplianceViolation[]; notes: string }> {
  const violations: ComplianceViolation[] = [];

  if (!text || text.trim().length < 10) {
    return { toneMatch: 100, violations: [], notes: 'Text too short to analyze' };
  }

  const brandVoice = guideline.guidelines?.voice || '';
  const brandDos = guideline.guidelines?.dos || [];
  const brandDonts = guideline.guidelines?.donts || [];

  if (!brandVoice && brandDos.length === 0 && brandDonts.length === 0) {
    return { toneMatch: 100, violations: [], notes: 'No voice guidelines defined' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || '' });

    const prompt = `You are a brand compliance analyst. Analyze if the following text matches the brand voice guidelines.

Brand Voice: ${brandVoice || 'Not specified'}
Do's: ${brandDos.join(', ') || 'None specified'}
Don'ts: ${brandDonts.join(', ') || 'None specified'}

Text to analyze:
"${text.substring(0, 1000)}"

Respond with JSON only:
{
  "matchScore": 0-100,
  "isOnBrand": true/false,
  "issues": ["issue1", "issue2"],
  "notes": "brief explanation"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: prompt,
    });

    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const toneMatch = Math.min(100, Math.max(0, result.matchScore || 50));

      if (!result.isOnBrand && result.issues?.length > 0) {
        violations.push({
          type: 'tone',
          severity: toneMatch < 50 ? 'high' : 'medium',
          message: `Text tone may not match brand voice: ${result.issues[0]}`,
          suggestion: 'Review brand voice guidelines',
        });
      }

      return { toneMatch, violations, notes: result.notes || '' };
    }
  } catch (error) {
    console.error('Error analyzing text tone:', error);
  }

  return { toneMatch: 70, violations: [], notes: 'Analysis unavailable' };
}

/**
 * Analyze image using Gemini Vision
 */
async function analyzeImageCompliance(
  image: { base64?: string; url?: string; mimeType?: string },
  guideline: BrandGuideline,
  apiKey?: string
): Promise<{ isOnBrand: boolean; confidence: number; violations: ComplianceViolation[]; notes: string }> {
  const violations: ComplianceViolation[] = [];

  if (!image.base64 && !image.url) {
    return { isOnBrand: true, confidence: 100, violations: [], notes: 'No image provided' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || '' });
    const brandContext = buildBrandContext(guideline, { compact: true });

    const prompt = `You are a brand compliance analyst. Analyze if this image aligns with the brand guidelines.

${brandContext}

Check for:
1. Color usage - does it use brand colors?
2. Visual style - does it match brand aesthetic?
3. Typography (if visible) - does it use brand fonts?
4. Overall brand alignment

Respond with JSON only:
{
  "isOnBrand": true/false,
  "confidence": 0-100,
  "colorMatch": 0-100,
  "styleMatch": 0-100,
  "issues": ["issue1", "issue2"],
  "notes": "brief explanation"
}`;

    const parts: any[] = [{ text: prompt }];

    if (image.base64) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType || 'image/png',
          data: image.base64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    } else if (image.url) {
      // For URLs, include as text reference (Gemini can fetch some URLs)
      parts[0].text += `\n\nImage URL: ${image.url}`;
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{ role: 'user', parts }],
    });

    const responseText = response.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      if (!result.isOnBrand && result.issues?.length > 0) {
        for (const issue of result.issues.slice(0, 3)) {
          violations.push({
            type: 'imagery',
            severity: result.confidence < 50 ? 'high' : 'medium',
            message: issue,
            suggestion: 'Review brand visual guidelines',
          });
        }
      }

      return {
        isOnBrand: result.isOnBrand ?? true,
        confidence: Math.min(100, Math.max(0, result.confidence || 50)),
        violations,
        notes: result.notes || '',
      };
    }
  } catch (error) {
    console.error('Error analyzing image:', error);
  }

  return { isOnBrand: true, confidence: 50, violations: [], notes: 'Analysis unavailable' };
}

// --------------------------------------------------------------------------
// Main Compliance Check Function
// --------------------------------------------------------------------------

/**
 * Analyze content compliance against brand guidelines
 */
export async function checkBrandCompliance(
  input: ComplianceCheckInput,
  guideline: BrandGuideline,
  apiKey?: string
): Promise<ComplianceResult> {
  const violations: ComplianceViolation[] = [];
  let baseScore = 100;

  const summary = {
    onBrandColors: 100,
    contrastCompliance: 'N/A' as 'AAA' | 'AA' | 'FAIL' | 'N/A',
    toneMatch: 100,
  };

  let aiAnalysis: ComplianceResult['aiAnalysis'];

  // 1. Check colors
  if (input.checkColors !== false && input.colors?.length) {
    const brandColors = guideline.colors || [];

    if (brandColors.length > 0) {
      const colorResult = checkColorCompliance(input.colors, brandColors);
      violations.push(...colorResult.violations);
      summary.onBrandColors = colorResult.onBrandPercent;

      // Deduct points for color mismatches
      const colorDeduction = colorResult.violations.length * 8;
      baseScore -= Math.min(30, colorDeduction);
    }
  }

  // 2. Check contrast
  if (input.checkContrast !== false && input.colors && input.colors.length >= 2) {
    const contrastResult = checkContrastCompliance(input.colors);
    violations.push(...contrastResult.violations);
    summary.contrastCompliance = contrastResult.compliance;

    // Deduct points for contrast issues
    if (contrastResult.compliance === 'FAIL') {
      baseScore -= 15;
    } else if (contrastResult.compliance === 'AA') {
      baseScore -= 5;
    }
  }

  // 3. Check text tone (if text provided and tone check enabled)
  if (input.checkTone !== false && input.text) {
    const toneResult = await analyzeTextTone(input.text, guideline, apiKey);
    violations.push(...toneResult.violations);
    summary.toneMatch = toneResult.toneMatch;

    // Deduct points for tone mismatch
    if (toneResult.toneMatch < 70) {
      baseScore -= Math.round((100 - toneResult.toneMatch) / 5);
    }
  }

  // 4. Analyze image (if provided)
  if (input.image) {
    const imageResult = await analyzeImageCompliance(input.image, guideline, apiKey);
    violations.push(...imageResult.violations);

    aiAnalysis = {
      isOnBrand: imageResult.isOnBrand,
      confidence: imageResult.confidence,
      notes: imageResult.notes,
    };

    // Deduct points for image issues
    if (!imageResult.isOnBrand) {
      baseScore -= Math.round((100 - imageResult.confidence) / 4);
    }
  }

  // Ensure score is within bounds
  const complianceScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Sort violations by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  violations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    complianceScore,
    violations,
    summary,
    aiAnalysis,
  };
}
