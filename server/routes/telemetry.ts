import express from 'express';
import { rateLimit } from 'express-rate-limit';
import fs from 'fs/promises';
import path from 'path';

/**
 * Telemetry route — essentialist log of plugin output quality.
 *
 * Goal: close the feedback loop between LLM-generated operations and the
 * resulting Figma tree without screenshots-and-prompts. The plugin runs a
 * cheap static audit (HUG/FIXED, clipping, structural white frames,
 * overflow) on every batch and POSTs the report here. We append one
 * compact entry per generation to .agent/telemetry/YYYY-MM-DD.md so the
 * data can be read directly when refining smart-image-analyzer.ts /
 * operations.ts / brandApply.ts.
 *
 * No prose, no filler. Markdown chosen so a human (or an LLM later) can
 * grep, diff and aggregate.
 */

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60_000,
  max: 120, // generous: telemetry should never block a user
  standardHeaders: true,
  legacyHeaders: false,
});

const TELEMETRY_DIR = path.resolve(process.cwd(), '.agent', 'telemetry');

interface AuditViolation { node: string; rule: string; detail?: string }
interface AuditReport {
  rootCount: number;
  nodeCount: number;
  violations: AuditViolation[];
  stats: { fixed: number; hug: number; fill: number; whiteFrames: number; textNodes: number };
}

function todayFile(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.join(TELEMETRY_DIR, `${y}-${m}-${day}.md`);
}

function formatEntry(input: {
  kind: string;
  intent: string | null;
  opCount: number;
  telemetry: AuditReport & Record<string, any>;
}): string {
  const { kind, intent, opCount, telemetry } = input;
  const ts = new Date().toISOString().slice(11, 19);
  const s: any = telemetry.stats;
  const intentLine = (intent || '—').replace(/\s+/g, ' ').slice(0, 140);

  const lines: string[] = [];
  lines.push(`## ${ts} · [${kind}] ops=${opCount} · nodes=${telemetry.nodeCount} · roots=${telemetry.rootCount}`);
  lines.push(`> ${intentLine}`);
  if (kind === 'brand') {
    lines.push(`brand: fontsApplied=${s.fontsApplied ?? 0} failed=${s.fontsFailedCount ?? 0} | colors=${s.colorsApplied ?? 0} gradients=${s.gradientsApplied ?? 0} | text=${s.textNodes} skipped=${s.textNodesSkipped ?? 0}`);
    if (s.roleCounts) lines.push(`roles: ${Object.entries(s.roleCounts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  } else {
    lines.push(`sizing: fixed=${s.fixed} hug=${s.hug} fill=${s.fill} | text=${s.textNodes} | whiteFrames=${s.whiteFrames}`);
  }
  if (telemetry.violations.length === 0) {
    lines.push(`violations: none`);
  } else {
    // Aggregate by rule for compact output
    const byRule = new Map<string, string[]>();
    for (const v of telemetry.violations) {
      const arr = byRule.get(v.rule) || [];
      arr.push(v.detail ? `${v.node}→${v.detail}` : v.node);
      byRule.set(v.rule, arr);
    }
    lines.push(`violations:`);
    for (const [rule, nodes] of byRule) {
      lines.push(`- \`${rule}\` ×${nodes.length}: ${nodes.slice(0, 6).join(', ')}${nodes.length > 6 ? ' …' : ''}`);
    }
  }
  lines.push(''); // blank line separator
  return lines.join('\n') + '\n';
}

router.post('/operations', limiter, async (req, res) => {
  try {
    const { kind, intent, opCount, telemetry } = req.body || {};
    if (!telemetry || typeof telemetry !== 'object' || !Array.isArray(telemetry.violations)) {
      return res.status(400).json({ error: 'invalid telemetry payload' });
    }
    const safeKind = kind === 'brand' ? 'brand' : 'ops';

    await fs.mkdir(TELEMETRY_DIR, { recursive: true });
    const file = todayFile();

    // Init file with date header if new
    try {
      await fs.access(file);
    } catch {
      const header = `# Telemetry · ${path.basename(file, '.md')}\n\nStatic audit of plugin-generated trees. One entry per applyOperations() batch.\n\n`;
      await fs.writeFile(file, header, 'utf8');
    }

    await fs.appendFile(file, formatEntry({ kind: safeKind, intent: intent ?? null, opCount: Number(opCount) || 0, telemetry }), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    console.error('[telemetry] failed:', err);
    res.status(500).json({ error: 'telemetry write failed' });
  }
});

/**
 * GET /telemetry/summary?days=7
 * Aggregates the last N days into a single essentialist report:
 * top violations by frequency. Designed to be the *only* thing you read
 * before tweaking the prompt.
 */
router.get('/summary', limiter, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days || '7'), 10) || 7, 1), 30);
    await fs.mkdir(TELEMETRY_DIR, { recursive: true });
    const files = (await fs.readdir(TELEMETRY_DIR)).filter(f => f.endsWith('.md')).sort().slice(-days);

    const ruleCount = new Map<string, number>();
    let entries = 0;
    let totalNodes = 0;
    let totalFixed = 0, totalHug = 0, totalFill = 0, totalWhite = 0;

    for (const f of files) {
      const content = await fs.readFile(path.join(TELEMETRY_DIR, f), 'utf8');
      for (const line of content.split('\n')) {
        if (line.startsWith('## ')) {
          entries++;
          const m = line.match(/nodes=(\d+)/);
          if (m) totalNodes += parseInt(m[1], 10);
        } else if (line.startsWith('sizing:')) {
          const f1 = line.match(/fixed=(\d+)/); if (f1) totalFixed += +f1[1];
          const f2 = line.match(/hug=(\d+)/);   if (f2) totalHug += +f2[1];
          const f3 = line.match(/fill=(\d+)/);  if (f3) totalFill += +f3[1];
          const f4 = line.match(/whiteFrames=(\d+)/); if (f4) totalWhite += +f4[1];
        } else if (line.startsWith('- `')) {
          const m = line.match(/`([^`]+)`\s*×(\d+)/);
          if (m) ruleCount.set(m[1], (ruleCount.get(m[1]) || 0) + parseInt(m[2], 10));
        }
      }
    }

    const ranked = [...ruleCount.entries()].sort((a, b) => b[1] - a[1]);
    res.json({
      windowDays: days,
      filesScanned: files.length,
      entries,
      totalNodes,
      sizingMix: { fixed: totalFixed, hug: totalHug, fill: totalFill },
      whiteFrames: totalWhite,
      topViolations: ranked.map(([rule, count]) => ({ rule, count })),
    });
  } catch (err) {
    console.error('[telemetry] summary failed:', err);
    res.status(500).json({ error: 'summary failed' });
  }
});

export default router;
