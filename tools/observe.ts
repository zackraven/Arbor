/**
 * T-005 — Dev observation harness
 * Launches the Vite dev server, screenshots the running app via Playwright,
 * and writes timestamped screenshots + an interaction trace to a session-log folder.
 *
 * Usage: tsx tools/observe.ts [--route <path>] [--actions <file>] [--out <dir>] [--ticket <id>]
 */

import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    route:   { type: 'string', default: '/' },
    actions: { type: 'string' },
    out:     { type: 'string' },
    ticket:  { type: 'string' },
  },
  strict: false,
});

const route       = values.route ?? '/';
const actionsFile = values.actions;
const isoDate     = new Date().toISOString().replace(/[:.]/g, '-');
const outDir      = values.out ?? `.claude/session-logs/observe-${isoDate}`;
const ticket      = values.ticket;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Arbor's pinned dev port — set in vite.config.ts with strictPort: true. */
const DEV_PORT = 1421;

// ---------------------------------------------------------------------------
// Dev-server lifecycle
// ---------------------------------------------------------------------------

let devServer: ChildProcess | null = null;
let devServerKilled = false;

function cleanup(): void {
  if (devServer && !devServerKilled) {
    devServerKilled = true;
    devServer.kill();
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  cleanup();
  process.exit(1);
});

async function pollServer(url: string, intervalMs: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      // server not ready yet
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceEntry {
  type: string;
  timestamp: string;
  selector?: string;
  ms?: number;
  screenshot?: string;
}

interface Action {
  type: string;
  selector?: string;
  timeout?: number;
  ms?: number;
  name?: string;
}

// ---------------------------------------------------------------------------
// Screenshot naming
// ---------------------------------------------------------------------------

function makeScreenshotFilename(counter: number, name: string): string {
  const nn = String(counter).padStart(2, '0');
  return ticket ? `${ticket}-${nn}-${name}.png` : `${nn}-${name}.png`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  // Start dev server
  devServer = spawn('pnpm', ['dev'], { stdio: 'pipe', shell: true });

  // Wait for server on DEV_PORT (Arbor's pinned dev port)
  const ready = await pollServer(`http://localhost:${DEV_PORT}`, 200, 30_000);
  if (!ready) {
    cleanup();
    console.error('dev server did not start within 30s');
    process.exit(1);
  }

  // Playwright — chromium, viewport 1280×800
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const trace: TraceEntry[] = [];
  let screenshotCounter = 0;

  try {
    // Navigate and take initial screenshot
    await page.goto(`http://localhost:${DEV_PORT}${route}`);
    await page.waitForLoadState('networkidle');

    const initialFilename = makeScreenshotFilename(screenshotCounter, 'initial');
    await page.screenshot({ path: `${outDir}/${initialFilename}` });
    trace.push({ type: 'navigation', timestamp: new Date().toISOString(), screenshot: initialFilename });
    screenshotCounter = 1;

    // Process actions.json if provided
    if (actionsFile) {
      const raw = readFileSync(actionsFile, 'utf8');
      const actions = JSON.parse(raw) as Action[];

      for (const action of actions) {
        const entry: TraceEntry = { type: action.type, timestamp: new Date().toISOString() };

        switch (action.type) {
          case 'waitFor':
            await page.waitForSelector(action.selector ?? '', { timeout: action.timeout ?? 5000 });
            entry.selector = action.selector;
            break;

          case 'click':
            await page.click(action.selector ?? '');
            entry.selector = action.selector;
            break;

          case 'wait':
            await page.waitForTimeout(action.ms ?? 0);
            entry.ms = action.ms;
            break;

          case 'screenshot': {
            const filename = makeScreenshotFilename(screenshotCounter, action.name ?? 'screenshot');
            await page.screenshot({ path: `${outDir}/${filename}` });
            entry.screenshot = filename;
            screenshotCounter += 1;
            break;
          }

          default:
            console.warn(`Unknown action type: ${action.type}, skipping`);
            continue;
        }

        trace.push(entry);
      }
    }

    writeFileSync(`${outDir}/trace.json`, JSON.stringify(trace, null, 2));
    await browser.close();
    process.exit(0);
  } catch (err) {
    try {
      writeFileSync(
        `${outDir}/trace.json`,
        JSON.stringify([{ type: 'error', timestamp: new Date().toISOString(), error: String(err) }], null, 2),
      );
    } catch { /* ignore write failure in error path */ }
    try { await browser.close(); } catch { /* ignore */ }
    cleanup();
    process.exit(1);
  }
}

main();
