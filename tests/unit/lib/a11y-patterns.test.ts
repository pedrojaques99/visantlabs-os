/**
 * Accessibility pattern regression tests
 *
 * These tests scan component source files for known anti-patterns that
 * cause accessibility failures. They serve as a lightweight alternative
 * to running a full headless browser + axe-core suite.
 *
 * Add new patterns here whenever an a11y bug is found in a PR review.
 * Each test documents WHY the pattern is dangerous.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_ROOT = join(process.cwd(), 'src');

function getAllTsx(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...getAllTsx(full));
    } else if (['.tsx', '.ts'].includes(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

function readFile(path: string) {
  return readFileSync(path, 'utf-8');
}

// Files explicitly excluded from specific checks (documented reason)
const EXCLUDE_ICON_ARIA: string[] = [];

describe('Accessibility anti-pattern scanner', () => {
  const allFiles = getAllTsx(SRC_ROOT);

  it('no <img> without alt attribute in brand/page components', () => {
    // Only TSX files contain JSX with <img> tags
    const targetFiles = allFiles.filter((f) => f.endsWith('.tsx'));
    const violations: string[] = [];

    for (const file of targetFiles) {
      const content = readFile(file);
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (!line.includes('<img')) return;
        // Skip <img> inside JS template strings (e.g. window.open write)
        if (line.includes('`') || line.includes("'<img") || line.includes('"<img')) return;
        // Check the img tag and next 10 lines (multi-attribute tags span many lines)
        const context = lines.slice(i, i + 11).join(' ');
        if (
          !context.includes('alt=') &&
          !context.includes('role="presentation"') &&
          !context.includes('aria-hidden')
        ) {
          violations.push(`${file}:${i + 1} — <img> missing alt`);
        }
      });
    }

    if (violations.length > 0) {
      console.error('Missing alt attributes:\n' + violations.join('\n'));
    }
    expect(violations).toHaveLength(0);
  });

  it('no icon-only <Button> without aria-label in brand guidelines components', () => {
    const targetFiles = allFiles.filter(
      (f) => !EXCLUDE_ICON_ARIA.some((ex) => f.includes(ex))
    );
    const violations: string[] = [];

    for (const file of targetFiles) {
      const content = readFile(file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('size="icon"') || !line.includes('<Button')) continue;

        // Scan up to 6 lines of context for the button tag
        const context = lines.slice(i, i + 6).join(' ');
        if (!context.includes('aria-label')) {
          violations.push(`${file}:${i + 1} — icon Button missing aria-label`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('Icon buttons missing aria-label:\n' + violations.join('\n'));
    }
    expect(violations).toHaveLength(0);
  });

  it('no hardcoded text-black on dynamic accent background in brand components', () => {
    // text-black on bg-[var(--accent)] fails for dark accent brands (navy, forest, black)
    const targetFiles = allFiles.filter(
      (f) => f.includes('brand') || f.includes('BrandReadOnly') || f.includes('PublicBrand')
    );
    const violations: string[] = [];

    for (const file of targetFiles) {
      const content = readFile(file);
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (
          line.includes('bg-[var(--accent)]') &&
          line.includes('text-black') &&
          !line.includes('text-[var(--accent-text)]')
        ) {
          violations.push(`${file}:${i + 1} — text-black hardcoded on dynamic accent background`);
        }
      });
    }

    if (violations.length > 0) {
      console.error('Dynamic contrast violations:\n' + violations.join('\n'));
    }
    expect(violations).toHaveLength(0);
  });

  it('no onClick on <div> or <motion.div> in brand/page interactive elements', () => {
    const targetFiles = allFiles.filter((f) => !f.includes('.test.'));
    const violations: string[] = [];

    for (const file of targetFiles) {
      const content = readFile(file);
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // Match motion.div or plain div with onClick but no role
        if (
          (line.includes('<motion.div') || (line.includes('<div') && !line.includes('<divider'))) &&
          line.includes('onClick') &&
          !line.includes('role=') &&
          !line.includes('tabIndex')
        ) {
          // Exclude pure event-propagation stoppers (no real action, just wrapping children)
          if (line.includes('e.stopPropagation()') && !line.includes('=>') ||
              /onClick=\{[^}]*e\.stopPropagation\(\)[^}]*\}/.test(line) && !/onClick=\{[^}]*\(\) =>/.test(line)) {
            return;
          }
          // Exclude modal backdrops (click-to-close on overlay — Escape key is the accessible alternative)
          if (line.includes('e.target === e.currentTarget') || line.includes('inset-0') && line.includes('backdrop')) {
            return;
          }
          violations.push(
            `${file}:${i + 1} — div with onClick is not keyboard accessible (use <button> or add role+tabIndex)`
          );
        }
      });
    }

    if (violations.length > 0) {
      console.error('Non-keyboard-accessible click handlers:\n' + violations.join('\n'));
    }
    expect(violations).toHaveLength(0);
  });

  it('no inline position:fixed styles (use Tailwind fixed/z-* utilities)', () => {
    // Inline styles bypass the design token system and are harder to audit
    // Exclude ui/ primitives that legitimately use inline positioning for portals/dropdowns.
    // Exclude contextmenu/ components: Radix DropdownMenu.Trigger uses position:fixed with
    // dynamic mouse coords (left: x, top: y) — impossible to express with Tailwind classes.
    const targetFiles = allFiles.filter(
      (f) =>
        (f.includes('pages') || f.includes('components')) &&
        !f.includes('components\\ui\\') &&
        !f.includes('components/ui/') &&
        !f.includes('contextmenu')
    );
    const violations: string[] = [];

    for (const file of targetFiles) {
      const content = readFile(file);
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (
          line.includes("position: 'fixed'") ||
          line.includes('position:"fixed"') ||
          line.includes("position: \"fixed\"")
        ) {
          violations.push(`${file}:${i + 1} — inline position:fixed, use Tailwind "fixed" class instead`);
        }
      });
    }

    if (violations.length > 0) {
      console.error('Inline fixed positioning:\n' + violations.join('\n'));
    }
    expect(violations).toHaveLength(0);
  });
});
