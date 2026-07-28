/**
 * T-004 Acceptance tests — .claude/ tooling structure
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * Run: pnpm test (vitest run)
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLAUDE = join(ROOT, '.claude');

describe('T-004 .claude/ structure', () => {
  describe('required files exist', () => {
    const files = [
      '.claude/settings.json',
      '.claude/agents/implementer.md',
      '.claude/agents/verifier.md',
      '.claude/agents/architect.md',
      '.claude/skills/write-ticket/SKILL.md',
      '.claude/hooks/contract-shield.sh',
      '.claude/hooks/spec-shield.sh',
      '.claude/hooks/post-edit-lint.sh',
      '.claude/hooks/commit-gate.sh',
      '.claude/hooks/session-log.sh',
    ];

    for (const file of files) {
      test(`${file} exists`, () => {
        expect(existsSync(join(ROOT, file))).toBe(true);
      });
    }
  });

  describe('settings.json structure', () => {
    test('is valid JSON', () => {
      const raw = readFileSync(join(CLAUDE, 'settings.json'), 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    test('has PostToolUse hooks', () => {
      const settings = JSON.parse(readFileSync(join(CLAUDE, 'settings.json'), 'utf8')) as Record<string, unknown>;
      const hooks = settings['hooks'] as Record<string, unknown> | undefined;
      expect(Array.isArray(hooks?.['PostToolUse'])).toBe(true);
    });

    test('has PreToolUse hooks', () => {
      const settings = JSON.parse(readFileSync(join(CLAUDE, 'settings.json'), 'utf8')) as Record<string, unknown>;
      const hooks = settings['hooks'] as Record<string, unknown> | undefined;
      expect(Array.isArray(hooks?.['PreToolUse'])).toBe(true);
    });

    test('has SessionStart hooks', () => {
      const settings = JSON.parse(readFileSync(join(CLAUDE, 'settings.json'), 'utf8')) as Record<string, unknown>;
      const hooks = settings['hooks'] as Record<string, unknown> | undefined;
      expect(Array.isArray(hooks?.['SessionStart'])).toBe(true);
    });
  });

  describe('agent frontmatter fields', () => {
    function parseFrontmatter(filePath: string): Record<string, unknown> {
      const content = readFileSync(filePath, 'utf8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match?.[1]) return {};
      // Very basic YAML line-by-line key extraction (not full YAML parse)
      const result: Record<string, unknown> = {};
      for (const line of match[1].split('\n')) {
        const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
        if (kv?.[1] && kv?.[2]) {
          result[kv[1]] = kv[2].trim();
        }
      }
      return result;
    }

    test('implementer.md has name: implementer', () => {
      const fm = parseFrontmatter(join(CLAUDE, 'agents', 'implementer.md'));
      expect(fm['name']).toBe('implementer');
    });

    test('implementer.md has model: sonnet', () => {
      const fm = parseFrontmatter(join(CLAUDE, 'agents', 'implementer.md'));
      expect(String(fm['model'] ?? '').toLowerCase()).toContain('sonnet');
    });

    test('verifier.md has name: verifier', () => {
      const fm = parseFrontmatter(join(CLAUDE, 'agents', 'verifier.md'));
      expect(fm['name']).toBe('verifier');
    });

    test('verifier.md has disallowedTools containing Write', () => {
      const content = readFileSync(join(CLAUDE, 'agents', 'verifier.md'), 'utf8');
      expect(content).toContain('Write');
      expect(content).toContain('disallowedTools');
    });

    test('architect.md has name: architect', () => {
      const fm = parseFrontmatter(join(CLAUDE, 'agents', 'architect.md'));
      expect(fm['name']).toBe('architect');
    });

    test('architect.md has model: opus', () => {
      const fm = parseFrontmatter(join(CLAUDE, 'agents', 'architect.md'));
      expect(String(fm['model'] ?? '').toLowerCase()).toContain('opus');
    });
  });

  describe('write-ticket skill', () => {
    test('SKILL.md has disable-model-invocation: true', () => {
      const content = readFileSync(
        join(CLAUDE, 'skills', 'write-ticket', 'SKILL.md'),
        'utf8'
      );
      expect(content).toContain('disable-model-invocation: true');
    });

    test('SKILL.md body mentions the six style rules', () => {
      const content = readFileSync(
        join(CLAUDE, 'skills', 'write-ticket', 'SKILL.md'),
        'utf8'
      );
      // Rule numbers 1–6 should all appear
      for (let i = 1; i <= 6; i++) {
        expect(content).toContain(`Rule ${i}`);
      }
    });
  });

  describe('contract-shield hook', () => {
    test('script references permissionDecision', () => {
      const content = readFileSync(
        join(CLAUDE, 'hooks', 'contract-shield.sh'),
        'utf8'
      );
      expect(content).toContain('permissionDecision');
      expect(content).toContain('deny');
    });

    test('script checks contracts/ path', () => {
      const content = readFileSync(
        join(CLAUDE, 'hooks', 'contract-shield.sh'),
        'utf8'
      );
      expect(content).toContain('contracts/');
    });
  });
});
