---
id: T-005
phase: 0
status: queued
depends_on: [T-001, T-004]
---

# T-005 — Dev observation harness (Playwright screenshot loop)

## Goal
A `pnpm observe` script launches the Vite dev server, drives the running app with Playwright at 1280×800, and writes timestamped screenshots and an interaction trace into a session-log folder. Implementer and verifier sessions can see the app without a human at the keyboard.

## Context links (implementer may read ONLY these)
- Architecture: [[20 Architecture#Repository layout]]
- Tooling rationale: [[24 Agent Tooling & Optimisation#Observation harness (closing the visual loop)]]

## Files
**Create:**
- `tools/observe.ts` — CLI entrypoint
- `tests/T-005/observe.test.ts` (already provided — do not modify)

**Modify:**
- `package.json` — add `playwright` (pinned exact version), `tsx` (pinned exact version if not present), and `observe` script: `tsx tools/observe.ts`

## Steps

### 1. Dev-server lifecycle

Use Node.js `child_process.spawn` to start the Vite dev server (`pnpm dev`) as a subprocess. Wait for the server to be ready by polling `http://localhost:1420` (the default Tauri dev port) every 200 ms, timing out after 30 s. If the timeout is reached, kill the child process and exit with code 1 and message `"dev server did not start within 30s"`.

On any signal (SIGINT, SIGTERM) or unhandled rejection: kill the child process before the Node process exits. Use a single cleanup function registered with `process.on('exit', …)` and `process.on('SIGINT', …)` / `process.on('SIGTERM', …)`.

### 2. CLI interface

```
pnpm observe [--route <path>] [--actions <file>] [--out <dir>] [--ticket <id>]
```

| Flag | Default | Meaning |
|---|---|---|
| `--route` | `/` | URL path to navigate to after launch |
| `--actions` | (none) | Path to an actions.json file (see §3) |
| `--out` | `.claude/session-logs/observe-<ISO-date>` | Directory for output artefacts |
| `--ticket` | (none) | Ticket ID prefix for screenshot names (e.g., `T-001`) |

Parse with `parseArgs` from Node.js `node:util`.

### 3. Playwright setup

- `chromium` browser (bundled with Playwright); no external browser required.
- Viewport: 1280×800 (exact).
- Navigate to `http://localhost:1420<route>`.
- Take an initial screenshot immediately after navigation settles (`waitForLoadState('networkidle')`).

### 4. actions.json format

Optional file defining a sequence of interactions to perform after the initial screenshot. Each entry is an object:

```json
[
  { "type": "waitFor",     "selector": "text=Arbor",   "timeout": 5000 },
  { "type": "screenshot",  "name": "after-wait" },
  { "type": "click",       "selector": "#some-button" },
  { "type": "wait",        "ms": 500 },
  { "type": "screenshot",  "name": "after-click" }
]
```

Supported action types:
- `waitFor` — `page.waitForSelector(selector, {timeout})`. If omitted, timeout defaults to 5000 ms.
- `click` — `page.click(selector)`.
- `wait` — `page.waitForTimeout(ms)`.
- `screenshot` — `page.screenshot()` saved to the output directory (see §5).

Unknown action types: log a warning and skip (do not throw).

### 5. Screenshot naming

All screenshots are saved to the `--out` directory. Naming:
- Initial screenshot (taken after navigation): `<ticket>-00-initial.png` (or `00-initial.png` if no `--ticket` given).
- Named screenshots from actions.json: `<ticket>-<NN>-<name>.png` where `NN` is a zero-padded counter incrementing with each screenshot action.

### 6. Trace and exit

After all actions: save a `trace.json` file to the output directory. The trace is a JSON array of `{type, timestamp, selector?, ms?, screenshot?}` entries mirroring the executed actions plus the initial navigation.

Exit code 0 on success. On any Playwright error: kill the dev server, write error details to `trace.json`, and exit with code 1.

## Acceptance criteria
- [ ] `tests/T-005/observe.test.ts` passes: harness produces `00-initial.png` in the output dir; the image is a valid PNG (non-zero size); trace.json is a valid JSON array
- [ ] Running `pnpm observe --route / --out /tmp/arbor-obs-test` against the T-001 placeholder produces a screenshot where the pixel at the image centre is not black (i.e., "Arbor" text is visible) [manual check — annotate Implementation notes with the screenshot path]
- [ ] Sending SIGINT during `pnpm observe` cleanly kills the dev server within 3 s (manual check)
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not add visual-regression diffing, CI integration, or Playwright component tests.
- Do not add a `--headful` flag or any browser other than Chromium.
- Do not modify the app itself (src/, src-tauri/).
- Do not add a screenshot at the end of every action — only when action type is `screenshot`.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
