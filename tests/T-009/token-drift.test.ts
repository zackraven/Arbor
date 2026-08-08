/**
 * T-009 — Contract drift guard: C7 note ↔ contracts/tokens.ts
 *
 * The C7 contract note (Arbor Spec/21 Contracts/C7 Design Tokens.md) contains
 * a fenced code block that must exactly match contracts/tokens.ts. This test
 * extracts the code block from the note and compares it line-by-line to the
 * mirror file. Any drift is a test failure.
 *
 * Rationale: "defined-twice-drifts is this project's most repeated failure"
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const NOTE_PATH = join(ROOT, 'Arbor Spec', '21 Contracts', 'C7 Design Tokens.md');
const MIRROR_PATH = join(ROOT, 'contracts', 'tokens.ts');

/** Extract the first ```typescript ... ``` fenced block from a markdown file. */
function extractCodeBlock(markdown: string): string {
  const startMarker = '```typescript';
  const endMarker = '```';
  const startIdx = markdown.indexOf(startMarker);
  if (startIdx === -1) throw new Error('No ```typescript block found in C7 note');
  const codeStart = startIdx + startMarker.length;
  const endIdx = markdown.indexOf(endMarker, codeStart);
  if (endIdx === -1) throw new Error('Unterminated code block in C7 note');
  return markdown.slice(codeStart, endIdx).trim();
}

describe('C7 contract drift guard', () => {
  test('C7 note code block matches contracts/tokens.ts exactly', () => {
    const noteContent = readFileSync(NOTE_PATH, 'utf8');
    const mirrorContent = readFileSync(MIRROR_PATH, 'utf8').trim();
    const noteCodeBlock = extractCodeBlock(noteContent);

    if (noteCodeBlock !== mirrorContent) {
      // Find first differing line for a helpful error message
      const noteLines = noteCodeBlock.split('\n');
      const mirrorLines = mirrorContent.split('\n');
      const maxLines = Math.max(noteLines.length, mirrorLines.length);
      const diffs: string[] = [];

      for (let i = 0; i < maxLines; i++) {
        const noteLine = noteLines[i] ?? '<missing>';
        const mirrorLine = mirrorLines[i] ?? '<missing>';
        if (noteLine !== mirrorLine) {
          diffs.push(`  Line ${i + 1}:`);
          diffs.push(`    note:   ${noteLine}`);
          diffs.push(`    mirror: ${mirrorLine}`);
          if (diffs.length > 15) {
            diffs.push(`  ... and more (${maxLines - i - 1} lines remaining)`);
            break;
          }
        }
      }

      expect.fail(
        `C7 note code block has drifted from contracts/tokens.ts.\n` +
        `Note line count: ${noteLines.length}, Mirror line count: ${mirrorLines.length}\n` +
        `First differences:\n${diffs.join('\n')}\n\n` +
        `Fix: update the code block in "${NOTE_PATH}" to match "${MIRROR_PATH}" exactly.`
      );
    }
  });
});
