import jwt from 'jsonwebtoken';

const KLING_API_BASE = 'https://api-singapore.klingai.com';
const POLL_INTERVAL_MS = 8000;
const MAX_POLL_MS = 300_000; // 5 minutes

// ── Auth ───────────────────────────────────────────────────────────────────────

function generateKlingToken(): string {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;

  if (!ak || !sk) {
    throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY must be set in environment variables.');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ak,
    exp: now + 1800, // 30 min validity
    nbf: now - 5,
  };

  return jwt.sign(payload, sk, { algorithm: 'HS256' });
}

function klingHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${generateKlingToken()}`,
    'Content-Type': 'application/json',
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed';

interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: KlingTaskStatus;
    task_status_msg?: string;
    task_result?: {
      videos?: Array<{ id: string; url: string; duration: string }>;
    };
  };
}

export interface KlingGenerateParams {
  model: string;
  prompt: string;
  negativePrompt?: string;
  mode?: string; // GenerationMode enum value
  aspectRatio?: string;
  duration?: string;
  // Kling quality tier
  klingMode?: 'std' | 'pro' | '4k';
  sound?: 'on' | 'off';
  cfgScale?: number;
  // Media inputs
  startFrame?: string; // base64 or URL
  endFrame?: string;
  referenceImages?: string[];
  inputVideo?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

async function createTextToVideoTask(params: KlingGenerateParams): Promise<string> {
  const body: Record<string, any> = {
    model_name: params.model,
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio ?? '16:9',
    duration: params.duration ?? '5',
    mode: params.klingMode ?? 'std',
  };

  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.sound) body.sound = params.sound;
  if (params.cfgScale !== undefined) body.cfg_scale = params.cfgScale;

  const resp = await fetch(`${KLING_API_BASE}/v1/videos/text2video`, {
    method: 'POST',
    headers: klingHeaders(),
    body: JSON.stringify(body),
  });

  const data: KlingTaskResponse = await resp.json();
  if (data.code !== 0) throw new Error(`Kling API error: ${data.message}`);
  return data.data.task_id;
}

async function createImageToVideoTask(params: KlingGenerateParams): Promise<string> {
  const body: Record<string, any> = {
    model_name: params.model,
    prompt: params.prompt ?? '',
    aspect_ratio: params.aspectRatio ?? '16:9',
    duration: params.duration ?? '5',
    mode: params.klingMode ?? 'std',
  };

  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.cfgScale !== undefined) body.cfg_scale = params.cfgScale;
  if (params.sound) body.sound = params.sound;

  // Start frame (required for image-to-video)
  if (params.startFrame) {
    body.image = toKlingImageInput(params.startFrame);
  } else if (params.referenceImages?.[0]) {
    body.image = toKlingImageInput(params.referenceImages[0]);
  }

  // End frame
  if (params.endFrame) {
    body.image_tail = toKlingImageInput(params.endFrame);
  }

  const resp = await fetch(`${KLING_API_BASE}/v1/videos/image2video`, {
    method: 'POST',
    headers: klingHeaders(),
    body: JSON.stringify(body),
  });

  const data: KlingTaskResponse = await resp.json();
  if (data.code !== 0) throw new Error(`Kling API error: ${data.message}`);
  return data.data.task_id;
}

/** Resolve base64 or URL to what Kling expects (URL preferred, base64 as fallback) */
function toKlingImageInput(input: string): string {
  // Kling accepts plain URL or base64 string without data: prefix
  if (input.startsWith('http')) return input;
  if (input.startsWith('data:')) {
    const match = input.match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : input;
  }
  return input;
}

// ── Polling ────────────────────────────────────────────────────────────────────

async function pollTask(taskId: string, isImageToVideo: boolean): Promise<string> {
  const endpoint = isImageToVideo
    ? `${KLING_API_BASE}/v1/videos/image2video/${taskId}`
    : `${KLING_API_BASE}/v1/videos/text2video/${taskId}`;

  const deadline = Date.now() + MAX_POLL_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const resp = await fetch(endpoint, { headers: klingHeaders() });
    const data: KlingTaskResponse = await resp.json();

    if (data.code !== 0) throw new Error(`Kling poll error: ${data.message}`);

    const status = data.data.task_status;

    if (status === 'succeed') {
      const videoUrl = data.data.task_result?.videos?.[0]?.url;
      if (!videoUrl) throw new Error('Kling task succeeded but no video URL returned.');
      return videoUrl;
    }

    if (status === 'failed') {
      throw new Error(`Kling task failed: ${data.data.task_status_msg ?? 'unknown reason'}`);
    }

    // submitted | processing — keep polling
  }

  throw new Error('Kling video generation timed out after 5 minutes.');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Public entry point ─────────────────────────────────────────────────────────

/**
 * Generate a video with Kling API.
 * Returns the public video URL.
 */
export async function generateKlingVideo(params: KlingGenerateParams): Promise<string> {
  const needsImage = !!(params.startFrame || params.endFrame || params.referenceImages?.length);

  // image2video modes: frames_to_video, image_to_video, references
  const useImageEndpoint =
    needsImage ||
    params.mode === 'frames_to_video' ||
    params.mode === 'image_to_video' ||
    params.mode === 'references';

  const taskId = useImageEndpoint
    ? await createImageToVideoTask(params)
    : await createTextToVideoTask(params);

  return pollTask(taskId, useImageEndpoint);
}
