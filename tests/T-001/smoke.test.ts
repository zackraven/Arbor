/**
 * T-001 Acceptance tests — Bootstrap smoke
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

describe('T-001 Bootstrap', () => {
  describe('tsconfig.json', () => {
    test('exists', () => {
      expect(existsSync(join(ROOT, 'tsconfig.json'))).toBe(true);
    });

    test('has strict: true', () => {
      const raw = readFileSync(join(ROOT, 'tsconfig.json'), 'utf8');
      // Strip JS-style comments before parsing (tsc allows them)
      const stripped = raw.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const tsconfig = JSON.parse(stripped) as Record<string, unknown>;
      const opts = tsconfig['compilerOptions'] as Record<string, unknown> | undefined;
      expect(opts?.['strict']).toBe(true);
    });

    test('has noUncheckedIndexedAccess: true', () => {
      const raw = readFileSync(join(ROOT, 'tsconfig.json'), 'utf8');
      const stripped = raw.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const tsconfig = JSON.parse(stripped) as Record<string, unknown>;
      const opts = tsconfig['compilerOptions'] as Record<string, unknown> | undefined;
      expect(opts?.['noUncheckedIndexedAccess']).toBe(true);
    });
  });

  describe('package.json', () => {
    test('exists', () => {
      expect(existsSync(join(ROOT, 'package.json'))).toBe(true);
    });

    test('has dev script', () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
      const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
      expect(typeof scripts?.['dev']).toBe('string');
    });

    test('has build script', () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
      const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
      expect(typeof scripts?.['build']).toBe('string');
    });

    test('has test script', () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
      const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
      expect(typeof scripts?.['test']).toBe('string');
    });

    test('has lint script', () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>;
      const scripts = pkg['scripts'] as Record<string, unknown> | undefined;
      expect(typeof scripts?.['lint']).toBe('string');
    });
  });

  describe('App.tsx', () => {
    test('exists at src/App.tsx', () => {
      expect(existsSync(join(ROOT, 'src', 'App.tsx'))).toBe(true);
    });

    test('contains "Arbor" text', () => {
      const content = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
      expect(content).toContain('Arbor');
    });

    test('does not import any CSS framework or router', () => {
      const content = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
      // No Tailwind, react-router, zustand, etc.
      expect(content).not.toMatch(/tailwind/i);
      expect(content).not.toMatch(/react-router/);
      expect(content).not.toMatch(/react-flow/);
    });
  });

  describe('Repository layout', () => {
    const expectedDirs = [
      'src',
      'src-tauri',
      'sidecar',
      'contracts',
      'tests',
      '.claude',
    ];

    for (const dir of expectedDirs) {
      test(`directory ${dir}/ exists`, () => {
        expect(existsSync(join(ROOT, dir))).toBe(true);
      });
    }
  });

  describe('.gitignore', () => {
    test('exists', () => {
      expect(existsSync(join(ROOT, '.gitignore'))).toBe(true);
    });

    test('ignores node_modules', () => {
      const content = readFileSync(join(ROOT, '.gitignore'), 'utf8');
      expect(content).toContain('node_modules');
    });

    test('ignores dist or build output', () => {
      const content = readFileSync(join(ROOT, '.gitignore'), 'utf8');
      expect(content.includes('dist') || content.includes('build') || content.includes('target')).toBe(true);
    });
  });

  describe('rust-toolchain.toml', () => {
    test('exists', () => {
      expect(existsSync(join(ROOT, 'rust-toolchain.toml'))).toBe(true);
    });

    test('pins stable channel', () => {
      const content = readFileSync(join(ROOT, 'rust-toolchain.toml'), 'utf8');
      expect(content).toContain('stable');
    });
  });
});
