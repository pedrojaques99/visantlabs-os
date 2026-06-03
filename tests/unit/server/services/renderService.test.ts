import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readdir, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import {
  createRenderJob,
  saveFrames,
  cleanupJob,
  validateDimensions,
  validateFormat,
  validateFps,
  parseFrameBuffer,
  getJobDiskUsage,
} from '../../../../server/services/renderService';

describe('renderService', () => {
  let testDir: string;

  afterEach(async () => {
    if (testDir) await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('validateDimensions', () => {
    it('accepts valid dimensions', () => {
      expect(validateDimensions(1920, 1080)).toBeNull();
    });

    it('rejects zero dimensions', () => {
      expect(validateDimensions(0, 100)).toBe('Dimensions too small');
    });

    it('rejects negative dimensions', () => {
      expect(validateDimensions(-1, 100)).toBe('Dimensions too small');
    });

    it('rejects dimensions exceeding max', () => {
      expect(validateDimensions(5000, 1080)).toContain('Max dimension');
    });

    it('rejects NaN', () => {
      expect(validateDimensions(NaN, 100)).toBe('Invalid dimensions');
    });

    it('rejects Infinity', () => {
      expect(validateDimensions(Infinity, 100)).toBe('Invalid dimensions');
    });

    it('accepts edge case min dimensions', () => {
      expect(validateDimensions(2, 2)).toBeNull();
    });

    it('accepts edge case max dimensions', () => {
      expect(validateDimensions(3840, 3840)).toBeNull();
    });
  });

  describe('validateFormat', () => {
    it('accepts mp4', () => {
      expect(validateFormat('mp4')).toBe(true);
    });
    it('accepts gif', () => {
      expect(validateFormat('gif')).toBe(true);
    });
    it('accepts webm', () => {
      expect(validateFormat('webm')).toBe(true);
    });
    it('rejects avi', () => {
      expect(validateFormat('avi')).toBe(false);
    });
    it('rejects empty', () => {
      expect(validateFormat('')).toBe(false);
    });
    it('rejects arbitrary string', () => {
      expect(validateFormat('mov')).toBe(false);
    });
  });

  describe('validateFps', () => {
    it('accepts valid fps', () => {
      expect(validateFps(30)).toBeNull();
    });
    it('accepts 1 fps', () => {
      expect(validateFps(1)).toBeNull();
    });
    it('accepts 60 fps', () => {
      expect(validateFps(60)).toBeNull();
    });
    it('rejects 0 fps', () => {
      expect(validateFps(0)).toBeTruthy();
    });
    it('rejects negative fps', () => {
      expect(validateFps(-1)).toBeTruthy();
    });
    it('rejects fps > 60', () => {
      expect(validateFps(120)).toBeTruthy();
    });
    it('rejects NaN', () => {
      expect(validateFps(NaN)).toBeTruthy();
    });
  });

  describe('createRenderJob', () => {
    it('creates job with unique id and work directory', async () => {
      const job = await createRenderJob();
      testDir = job.workDir;

      expect(job.jobId).toMatch(/^[0-9a-f-]{36}$/);
      expect(job.workDir).toContain('visant-render');
      expect(job.frameCount).toBe(0);

      const files = await readdir(job.workDir);
      expect(files).toHaveLength(0);
    });

    it('creates unique jobs', async () => {
      const job1 = await createRenderJob();
      const job2 = await createRenderJob();

      expect(job1.jobId).not.toBe(job2.jobId);
      expect(job1.workDir).not.toBe(job2.workDir);

      await cleanupJob(job1.workDir);
      await cleanupJob(job2.workDir);
    });
  });

  describe('saveFrames', () => {
    beforeEach(async () => {
      testDir = join(tmpdir(), 'visant-render-test', Date.now().toString());
      await mkdir(testDir, { recursive: true });
    });

    it('saves frames with correct naming', async () => {
      const frames = [Buffer.from('frame0'), Buffer.from('frame1')];
      const count = await saveFrames(testDir, frames, 0);

      expect(count).toBe(2);

      const files = await readdir(testDir);
      expect(files).toContain('frame_000000.jpg');
      expect(files).toContain('frame_000001.jpg');

      const content = await readFile(join(testDir, 'frame_000000.jpg'));
      expect(content.toString()).toBe('frame0');
    });

    it('respects start index', async () => {
      const frames = [Buffer.from('x')];
      await saveFrames(testDir, frames, 5);

      const files = await readdir(testDir);
      expect(files).toContain('frame_000005.jpg');
    });

    it('rejects frames exceeding max limit', async () => {
      const frames = [Buffer.from('x')];
      await expect(saveFrames(testDir, frames, 1800)).rejects.toThrow('Max');
    });
  });

  describe('parseFrameBuffer', () => {
    it('parses valid frame buffer', () => {
      const frame1 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header-like
      const frame2 = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);

      const buf = Buffer.alloc(4 + frame1.length + 4 + frame2.length);
      buf.writeUInt32LE(frame1.length, 0);
      frame1.copy(buf, 4);
      buf.writeUInt32LE(frame2.length, 4 + frame1.length);
      frame2.copy(buf, 4 + frame1.length + 4);

      const frames = parseFrameBuffer(buf);
      expect(frames).toHaveLength(2);
      expect(Buffer.compare(frames[0], frame1)).toBe(0);
      expect(Buffer.compare(frames[1], frame2)).toBe(0);
    });

    it('handles empty buffer', () => {
      const frames = parseFrameBuffer(Buffer.alloc(0));
      expect(frames).toHaveLength(0);
    });

    it('handles truncated buffer', () => {
      const buf = Buffer.alloc(6);
      buf.writeUInt32LE(100, 0); // claims 100 bytes but only 2 available
      const frames = parseFrameBuffer(buf);
      expect(frames).toHaveLength(0);
    });

    it('rejects frames larger than 10MB', () => {
      const buf = Buffer.alloc(8);
      buf.writeUInt32LE(11 * 1024 * 1024, 0); // 11MB
      const frames = parseFrameBuffer(buf);
      expect(frames).toHaveLength(0);
    });

    it('rejects zero-length frames', () => {
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(0, 0);
      const frames = parseFrameBuffer(buf);
      expect(frames).toHaveLength(0);
    });

    it('handles buffer with only header bytes', () => {
      const buf = Buffer.alloc(3); // not enough for uint32
      const frames = parseFrameBuffer(buf);
      expect(frames).toHaveLength(0);
    });
  });

  describe('getJobDiskUsage', () => {
    beforeEach(async () => {
      testDir = join(tmpdir(), 'visant-render-test', Date.now().toString());
      await mkdir(testDir, { recursive: true });
    });

    it('calculates total size of files', async () => {
      await writeFile(join(testDir, 'a.txt'), 'hello'); // 5 bytes
      await writeFile(join(testDir, 'b.txt'), 'world!'); // 6 bytes
      const usage = await getJobDiskUsage(testDir);
      expect(usage).toBe(11);
    });

    it('returns 0 for empty directory', async () => {
      const usage = await getJobDiskUsage(testDir);
      expect(usage).toBe(0);
    });

    it('returns 0 for non-existent directory', async () => {
      const usage = await getJobDiskUsage('/nonexistent/path');
      expect(usage).toBe(0);
    });
  });

  describe('cleanupJob', () => {
    it('removes directory and contents', async () => {
      testDir = join(tmpdir(), 'visant-render-test', Date.now().toString());
      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, 'test.txt'), 'data');

      await cleanupJob(testDir);

      await expect(readdir(testDir)).rejects.toThrow();
    });

    it('does not throw for non-existent directory', async () => {
      await expect(cleanupJob('/nonexistent/path')).resolves.toBeUndefined();
    });
  });
});
