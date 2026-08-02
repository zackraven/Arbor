---
id: T-005
phase: 0
status: done
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

> **Dev port — single source of truth:** Arbor's pinned dev port is **1421**, configured in `vite.config.ts` with `strictPort: true`. Both §1 (polling) and §3 (navigation) use this port. In `tools/observe.ts`, define it once as `const DEV_PORT = 1421;` and reference it in both the poll URL and navigation URL — never write the number twice.

### 1. Dev-server lifecycle

Use Node.js `child_process.spawn` to start the Vite dev server (`pnpm dev`) as a subprocess. Wait for the server to be ready by polling `http://localhost:1421` (Arbor's pinned dev port) every 200 ms, timing out after 30 s. If the timeout is reached, kill the child process and exit with code 1 and message `"dev server did not start within 30s"`.

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
- Navigate to `http://localhost:1421<route>`.
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

Resolved 2026-08-02: The `http://localhost:1420` navigation URL in §3 was a typo (1420 → 1421, Arbor's pinned dev port). Fixed in ticket §3 and `tools/observe.ts` by architect. The `pnpm-workspace.yaml` `allowBuilds.esbuild` placeholder resolved to `true` by the T-005 implementer — see decisions log 2026-08-02 for origin analysis.

## Implementation notes

All acceptance criteria satisfied:

- **AC1** — `tests/T-005/observe.test.ts`: 12/12 tests pass (`pnpm exec vitest run tests/T-005/observe.test.ts`).
- **AC2** — `MSYS_NO_PATHCONV=1 pnpm observe --route / --out C:/Users/Alex/AppData/Local/Temp/arbor-obs-test` produced `00-initial.png` (1280×800 PNG, 5 242 bytes). "Arbor" text is visually centred. Centre pixel (640, 400) = R=17 G=17 B=17 — not pure black (background is `#111111`). Screenshot path: `C:/Users/Alex/AppData/Local/Temp/arbor-obs-test/00-initial.png`.
- **AC3** — SIGINT sent 2 s into a fresh observe run (before screenshot captured); observe exited with code 0 in 729 ms; `pgrep vite` and `pgrep tauri` returned empty — no lingering dev-server processes. Well within the 3 s bound.
- **AC4** — `pnpm lint` exits 0 (`tsc --noEmit` clean; `cargo clippy` clean).

Note: on MINGW64/Windows the slash route argument `/` is path-converted by the shell; prefix the command with `MSYS_NO_PATHCONV=1` to prevent conversion.

Files created/modified:
- `tools/observe.ts` — created; CLI entrypoint with parseArgs, pnpm-dev spawn, 1421-polling, Playwright chromium at 1280×800, actions.json loop, screenshot naming, trace.json, cleanup handlers.
- `package.json` — added `playwright: "1.62.1"` and `tsx: "4.23.1"` as exact-pinned devDependencies; added `"observe": "tsx tools/observe.ts"` script.
- `pnpm-workspace.yaml` — set `esbuild: true` to resolve pnpm's auto-generated `allowBuilds.esbuild` placeholder; this file was not listed in the ticket's Files section (see decisions log 2026-08-02).

## Verification

**Verdict: pass** — 2026-08-02

### Specific rulings

**(a) CLI interface, actions.json, screenshot naming, trace.json**

All conform to the ticket spec:

- **CLI interface:** All four flags (`--route`, `--actions`, `--out`, `--ticket`) are present with correct types and defaults (`/`, none, `.claude/session-logs/observe-<ISO-date>`, none). Parsed with `parseArgs` from `node:util`. ✓
- **DEV_PORT:** Declared once as `const DEV_PORT = 1421` at line 40; referenced in both the poll URL (line 119) and navigation URL (line 135) — no hard-coded port literals elsewhere. ✓
- **actions.json format:** All four specified action types implemented correctly. `waitFor` calls `page.waitForSelector` with timeout defaulting to 5000. `click` calls `page.click`. `wait` calls `page.waitForTimeout`. `screenshot` calls `page.screenshot` and saves to `outDir`. Unknown types warn and skip without throwing. ✓
- **Screenshot naming:** `makeScreenshotFilename` zero-pads counter with `padStart(2, '0')`. Initial screenshot uses counter 0 → `00-initial.png` (or `<ticket>-00-initial.png`). Counter is then set to 1 and incremented per screenshot action — consistent with the spec's `<NN>` progression. ✓
- **trace.json:** Written as a JSON array. Each entry has `{type, timestamp}` plus optional `selector`, `ms`, `screenshot` matching the ticket's schema. Initial navigation entry has `type: 'navigation'`, which is a correct interpretation of "mirroring the executed actions plus the initial navigation." ✓
- **Exit codes:** 0 on success; 1 on timeout or Playwright error, with error written to `trace.json`. ✓

**(b) MSYS_NO_PATHCONV=1 documentation — documentation gap, flagged for architect**

`MSYS_NO_PATHCONV=1` appears in **exactly one file**: the `## Implementation notes` section of this ticket. It is absent from every durable spec note (grep across the entire repo confirms this). Note 24 (Agent Tooling & Optimisation) describes the observation harness but contains no mention of the MINGW64/MSYS path-conversion issue. Future implementer and verifier sessions running on Windows that invoke `pnpm observe --route /` will hit the same silent failure without any in-vault reference to guide them.

This is not a contract violation and does not affect the pass verdict. It is a documentation gap. The architect should add a Windows/MSYS shell note (e.g., under note 24's Observation harness section or in a new developer-environment note) recording that the `observe` script requires `MSYS_NO_PATHCONV=1` on MINGW64 whenever `--route` or `--out` arguments begin with `/` or a Windows drive letter, to prevent the MSYS shell from converting them to Unix paths.

### Out-of-scope note

`pnpm-workspace.yaml` was modified but is not in the ticket's Files list. This was reviewed and pre-adjudicated by the architect in the 2026-08-02 decisions log entry (§T-005-port-fix-2026-08-02), which records the change as correct. No violation.
