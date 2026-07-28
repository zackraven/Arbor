/**
 * T-003 Acceptance tests — pack.json schema validator
 * Pre-written by architect. Do NOT modify this file — make it pass.
 *
 * The implementer creates:
 *   - src/api/pack-loader.ts
 *   - tests/T-003/fixtures/valid-pack/pack.json
 *   - tests/T-003/fixtures/invalid-pack/pack.json
 *
 * Run: pnpm test (vitest run)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const VALID_PACK_PATH = join(__dirname, 'fixtures', 'valid-pack', 'pack.json');
const INVALID_PACK_PATH = join(__dirname, 'fixtures', 'invalid-pack', 'pack.json');
// Relative path from tests/T-003/ to src/api/pack-loader.ts
const PACK_LOADER_REL = '../../src/api/pack-loader';
const PACK_LOADER_SRC = join(ROOT, 'src', 'api', 'pack-loader.ts');

// Inject-able readFile for testing — returns file contents as a string
const readFile = (path: string): Promise<string> =>
  Promise.resolve(readFileSync(path, 'utf8'));

// ─── No @tauri-apps imports ──────────────────────────────────────────────────

test('pack-loader.ts has zero @tauri-apps imports', () => {
  const source = readFileSync(PACK_LOADER_SRC, 'utf8');
  expect(source).not.toMatch(/@tauri-apps/);
});

// ─── Valid fixture ───────────────────────────────────────────────────────────

describe('loadPack with valid fixture', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loadPack: (readFile: (path: string) => Promise<string>, path: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let PackValidationError: new (...args: any[]) => Error & { errors: unknown[] };

  beforeAll(async () => {
    const mod = await import(PACK_LOADER_REL);
    loadPack = mod.loadPack as typeof loadPack;
    PackValidationError = mod.PackValidationError as typeof PackValidationError;
  });

  test('loads without throwing', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    expect(pack).toBeDefined();
  });

  test('schema_version is 1', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    expect(pack.schema_version).toBe(1);
  });

  test('node_id is "chain-rule-basics"', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    expect(pack.node_id).toBe('chain-rule-basics');
  });

  test('has exactly 2 segments', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    expect(pack.segments).toHaveLength(2);
  });

  test('each segment has at least 2 expected_paths', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    for (const seg of pack.segments as { expected_paths: unknown[] }[]) {
      expect(seg.expected_paths.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('each segment has at least one misconception expected_path', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    for (const seg of pack.segments as { expected_paths: { is_misconception: boolean }[] }[]) {
      const hasMisconception = seg.expected_paths.some((p) => p.is_misconception === true);
      expect(hasMisconception).toBe(true);
    }
  });

  test('each segment hint_ladder ends with level "tell"', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    for (const seg of pack.segments as { hint_ladder: { level: string }[] }[]) {
      const last = seg.hint_ladder[seg.hint_ladder.length - 1];
      expect(last?.level).toBe('tell');
    }
  });

  test('each segment has at least 1 quick_check', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    for (const seg of pack.segments as { quick_checks: unknown[] }[]) {
      expect(seg.quick_checks.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('has 3 templates, one per difficulty', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    const difficulties = (pack.templates as { difficulty: string }[]).map((t) => t.difficulty);
    expect(difficulties).toContain('easy');
    expect(difficulties).toContain('medium');
    expect(difficulties).toContain('hard');
  });

  test('each template has a sympy-parseable answer_expr (non-empty string)', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    for (const tmpl of pack.templates as { answer_expr: unknown }[]) {
      expect(typeof tmpl.answer_expr).toBe('string');
      expect((tmpl.answer_expr as string).length).toBeGreaterThan(0);
    }
  });

  test('diagnostic bank has at least 10 items', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    expect((pack.diagnostic as unknown[]).length).toBeGreaterThanOrEqual(10);
  });

  test('summary_for_context is under 800 chars (C2 cap)', async () => {
    const pack = await loadPack(readFile, VALID_PACK_PATH);
    expect((pack.summary_for_context as string).length).toBeLessThanOrEqual(800);
  });
});

// ─── Invalid fixture ─────────────────────────────────────────────────────────
//
// The invalid fixture introduces exactly these four violations:
//   1. templates[0].difficulty = "extreme"  → /templates/0/difficulty (enum)
//   2. segments[0] missing "resolution"     → /segments/0 (required)
//   3. summary_for_context > 800 chars      → /summary_for_context (maxLength)
//   4. diagnostic has 9 items (not 10)      → /diagnostic (minItems)

describe('loadPack with invalid fixture', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let loadPack: (readFile: (path: string) => Promise<string>, path: string) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let PackValidationError: new (...args: any[]) => Error & { errors: { instancePath: string }[] };

  beforeAll(async () => {
    const mod = await import(PACK_LOADER_REL);
    loadPack = mod.loadPack as typeof loadPack;
    PackValidationError = mod.PackValidationError as typeof PackValidationError;
  });

  test('throws PackValidationError', async () => {
    await expect(loadPack(readFile, INVALID_PACK_PATH)).rejects.toBeInstanceOf(PackValidationError);
  });

  test('error.errors array is non-empty', async () => {
    try {
      await loadPack(readFile, INVALID_PACK_PATH);
      throw new Error('should have thrown PackValidationError');
    } catch (e) {
      expect(e).toBeInstanceOf(PackValidationError);
      const pve = e as { errors: unknown[] };
      expect(Array.isArray(pve.errors)).toBe(true);
      expect(pve.errors.length).toBeGreaterThan(0);
    }
  });

  test('errors contain /templates/0/difficulty violation', async () => {
    try {
      await loadPack(readFile, INVALID_PACK_PATH);
    } catch (e) {
      const pve = e as { errors: { instancePath: string }[] };
      const paths = pve.errors.map((err) => err.instancePath);
      expect(paths).toContain('/templates/0/difficulty');
    }
  });

  test('errors contain /segments/0 required-field violation', async () => {
    try {
      await loadPack(readFile, INVALID_PACK_PATH);
    } catch (e) {
      const pve = e as { errors: { instancePath: string }[] };
      const paths = pve.errors.map((err) => err.instancePath);
      // AJV reports missing required property at the parent object path
      expect(paths).toContain('/segments/0');
    }
  });

  test('errors contain /summary_for_context maxLength violation', async () => {
    try {
      await loadPack(readFile, INVALID_PACK_PATH);
    } catch (e) {
      const pve = e as { errors: { instancePath: string }[] };
      const paths = pve.errors.map((err) => err.instancePath);
      expect(paths).toContain('/summary_for_context');
    }
  });

  test('errors contain /diagnostic minItems violation', async () => {
    try {
      await loadPack(readFile, INVALID_PACK_PATH);
    } catch (e) {
      const pve = e as { errors: { instancePath: string }[] };
      const paths = pve.errors.map((err) => err.instancePath);
      expect(paths).toContain('/diagnostic');
    }
  });
});
