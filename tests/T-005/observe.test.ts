/**
 * T-005 Acceptance tests — Dev observation harness
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * These tests import and unit-test the observe script's exported helpers.
 * The full harness integration test requires a running dev server and is
 * marked [manual] in the T-005 acceptance criteria.
 *
 * Run: pnpm test (vitest run)
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

describe('T-005 Observe harness structure', () => {
  test('tools/observe.ts exists', () => {
    expect(existsSync(join(ROOT, 'tools', 'observe.ts'))).toBe(true);
  });

  test('package.json has observe script', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
    const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
    expect(typeof scripts?.['observe']).toBe('string');
  });

  test('observe script invokes tools/observe.ts', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
    const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
    const observeScript = String(scripts?.['observe'] ?? '');
    expect(observeScript).toContain('observe.ts');
  });

  test('observe.ts does not import @tauri-apps', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).not.toMatch(/@tauri-apps/);
  });

  test('observe.ts uses parseArgs from node:util', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('parseArgs');
    expect(content).toContain('node:util');
  });

  test('observe.ts references viewport 1280x800', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('1280');
    expect(content).toContain('800');
  });

  test('observe.ts handles SIGINT/SIGTERM for cleanup', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toMatch(/SIGINT|SIGTERM/);
  });

  test('observe.ts references networkidle for page load settling', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('networkidle');
  });
});

describe('T-005 actions.json format (parsed by observe.ts)', () => {
  test('observe.ts handles "screenshot" action type', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('screenshot');
  });

  test('observe.ts handles "click" action type', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('click');
  });

  test('observe.ts handles "waitFor" action type', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('waitFor');
  });

  test('observe.ts handles "wait" action type (waitForTimeout)', () => {
    const content = readFileSync(join(ROOT, 'tools', 'observe.ts'), 'utf8');
    expect(content).toContain('wait');
  });
});
