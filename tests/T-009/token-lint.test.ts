/**
 * T-009 Acceptance tests — Token lint
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Scans all .ts, .tsx, .css, and .module.css files under src/ for hardcoded
 * colour values. Only src/tokens.css may contain literal colours — all other
 * files must use CSS custom properties (var(--xxx)) or token imports.
 *
 * Run: pnpm test
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', '..', 'src');

/** Recursively collect files matching extensions under a directory. */
function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Matches hardcoded colour values:
 * - Hex: #xxx, #xxxx, #xxxxxx, #xxxxxxxx (3, 4, 6, or 8 hex digits)
 * - rgb()/rgba()/hsl()/hsla() function calls
 *
 * Does NOT match:
 * - CSS keywords: transparent, currentColor, inherit, none
 * - var(--xxx) references
 * - Hex in non-colour contexts (rare; accepted as false positive risk)
 */
const COLOUR_PATTERN = /(?:#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\s*\()/;

/** Lines that are comments or import statements are skipped. */
function isSkippableLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('import ') ||
    trimmed.startsWith('import{') ||
    trimmed === ''
  );
}

describe('T-009 Token lint', () => {
  test('no hardcoded colours in src/ (except src/tokens.css)', () => {
    const files = collectFiles(SRC_DIR, ['.ts', '.tsx', '.css']);
    const violations: string[] = [];

    for (const filePath of files) {
      const relPath = relative(SRC_DIR, filePath);

      // tokens.css is the only file allowed to contain literal colour values
      if (relPath === 'tokens.css') continue;

      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (isSkippableLine(line)) continue;
        if (COLOUR_PATTERN.test(line)) {
          violations.push(`src/${relPath}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    if (violations.length > 0) {
      const message = [
        'Hardcoded colour values found in src/ files (use CSS custom properties from tokens.css instead):',
        '',
        ...violations,
      ].join('\n');
      expect.fail(message);
    }
  });

  test('src/tokens.css exists', () => {
    const exists = statSync(join(SRC_DIR, 'tokens.css'), { throwIfNoEntry: false });
    expect(exists).toBeTruthy();
  });
});
