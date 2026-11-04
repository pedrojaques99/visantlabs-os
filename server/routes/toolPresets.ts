import express, { type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const COLLECTION = 'tool_presets';
const MAX_NAME = 80;
const MAX_DATA_BYTES = 256 * 1024;
const MAX_PER_TOOL = 100;
const TOOL_ID = /^[a-z0-9-]{1,40}$/;

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Express 4 does not catch a rejected async handler: without this the request hangs.
const safe =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response) => {
    handler(req, res).catch((error) => {
      console.error('[tool-presets]', error);
      if (!res.headersSent) res.status(500).json({ error: 'Could not reach presets' });
    });
  };

export interface ToolPresetInput {
  tool: string;
  name: string;
  data: Record<string, unknown>;
}

/** What a tool may save. Settings only: a preset never carries a file. */
export function validateToolPreset(body: unknown): { value?: ToolPresetInput; error?: string } {
  const { tool, name, data } = (body ?? {}) as Record<string, unknown>;
  if (typeof tool !== 'string' || !TOOL_ID.test(tool)) return { error: 'Invalid tool' };
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME) {
    return { error: 'Invalid name' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Invalid data' };
  if (JSON.stringify(data).length > MAX_DATA_BYTES) return { error: 'Preset too large' };
  return { value: { tool, name: name.trim(), data: data as Record<string, unknown> } };
}

router.get(
  '/',
  limiter,
  authenticate,
  safe(async (req, res) => {
    const tool = req.query.tool;
    if (typeof tool !== 'string' || !TOOL_ID.test(tool)) {
      return res.status(400).json({ error: 'Invalid tool' });
    }
    await connectToMongoDB();
    const rows = await getDb()
      .collection(COLLECTION)
      .find({ userId: new ObjectId(req.userId!), tool })
      .sort({ createdAt: -1 })
      .limit(MAX_PER_TOOL)
      .toArray();
    res.json({ presets: rows.map((r) => ({ id: String(r._id), name: r.name, data: r.data })) });
  })
);

router.post(
  '/',
  limiter,
  authenticate,
  safe(async (req, res) => {
    const { value, error } = validateToolPreset(req.body);
    if (!value) return res.status(400).json({ error });
    await connectToMongoDB();
    const collection = getDb().collection(COLLECTION);
    const userId = new ObjectId(req.userId!);
    const count = await collection.countDocuments({ userId, tool: value.tool });
    if (count >= MAX_PER_TOOL) return res.status(409).json({ error: 'Too many presets' });
    const { insertedId } = await collection.insertOne({ ...value, userId, createdAt: new Date() });
    res
      .status(201)
      .json({ preset: { id: String(insertedId), name: value.name, data: value.data } });
  })
);

router.delete(
  '/:id',
  limiter,
  authenticate,
  safe(async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    await connectToMongoDB();
    const { deletedCount } = await getDb()
      .collection(COLLECTION)
      .deleteOne({ _id: new ObjectId(req.params.id), userId: new ObjectId(req.userId!) });
    if (!deletedCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  })
);

export default router;
