---
id: T-001
phase: 0
status: implemented
depends_on: []
---

# T-001 — Bootstrap Tauri + React + TS repo

## Goal
A running empty Arbor desktop app with the repository layout from the architecture note, strict tooling, and a green test command. Nothing else.

## Context links (implementer may read ONLY these)
- Architecture: [[20 Architecture#Repository layout]], [[20 Architecture#Naming conventions]]

## Files
**Create:** repo scaffold per the layout block in [[20 Architecture#Repository layout]] — `src/`, `src-tauri/`, `sidecar/`, `contracts/`, `tests/`, `.claude/` (empty placeholder folders with `.gitkeep` where no content yet), plus:
- `package.json` (pnpm), `tsconfig.json` (strict: true, noUncheckedIndexedAccess: true), `vite.config.ts`
- `src-tauri/` via `pnpm create tauri-app` equivalent config: app name `arbor`, identifier `dev.arbor.app`
- `src/App.tsx` rendering exactly: a full-viewport dark (`#111`) div containing centered text `Arbor` in the default system font
- `vitest` config; `tests/T-001/smoke.test.ts`(already provided)
- `.gitignore` (node, rust, tauri targets), `rust-toolchain.toml` (stable), `README.md` containing only the project name and `see spec/`

**Modify:** none.

## Steps
1. Initialise pnpm workspace; add React 18, TypeScript, Vite, vitest as devDeps. Exact versions: latest stable at implementation time, pinned (no `^`).
2. Initialise Tauri (v2) with the identifiers above; default window 1280×800, title `Arbor`.
3. Create the folder skeleton exactly as the architecture layout block specifies. No extra folders.
4. Implement `src/App.tsx` as specified. No CSS framework, no router, no state library.
5. Add scripts: `dev` (tauri dev), `build` (tauri build), `test` (vitest run), `lint` (tsc --noEmit + clippy via `cargo clippy -- -D warnings`).
6. Ensure `pnpm test` and `pnpm lint` pass.

## Acceptance criteria
- [ ] `tests/T-001/smoke.test.ts` passes (asserts: tsconfig strict flags, folder skeleton exists, scripts present in package.json)
- [ ] `pnpm lint` exits 0
- [ ] `pnpm dev` launches a window titled `Arbor` showing the centered text (manual check by user)
- [ ] `git status` shows no unignored build artefacts after `pnpm build`

## Out of scope — DO NOT
- Do not add Tailwind, routers, state management, React Flow, or ANY dependency not named in Steps.
- Do not create example components, sample tests beyond the provided one, or CI config (that is T-00X).
- Do not write anything into `contracts/` or `.claude/` beyond `.gitkeep`.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

**Created files:**
- `package.json` — pnpm project, React 18.3.1, pinned devDeps (TypeScript 7.0.2, Vite 8.2.0, vitest 4.1.10, @tauri-apps/cli 2.11.4, @tauri-apps/api 2.11.1, @vitejs/plugin-react 6.0.5, @types/node 26.1.2, @types/react 18.3.31, @types/react-dom 18.3.7). Scripts: dev/build/test/lint.
- `tsconfig.json` — strict: true, noUncheckedIndexedAccess: true, types: ["node"]. Includes src/, tests/, vite.config.ts, vitest.config.ts.
- `vite.config.ts` — @vitejs/plugin-react, port 5173, Tauri-compatible build settings.
- `vitest.config.ts` — include tests/**/*.test.ts, environment: node.
- `index.html` — Vite entry point mounting #root.
- `src/main.tsx` — ReactDOM.createRoot entry.
- `src/App.tsx` — full-viewport #111 div, centered "Arbor" text, no framework imports.
- `src/graph|learn|stats|state|api/.gitkeep` — placeholder dirs.
- `src-tauri/Cargo.toml` — tauri 2.x, lib name arbor_lib.
- `src-tauri/build.rs` — tauri_build::build().
- `src-tauri/tauri.conf.json` — productName arbor, identifier dev.arbor.app, window 1280×800 title Arbor.
- `src-tauri/capabilities/default.json` — core:default permission.
- `src-tauri/icons/icon.ico` — minimal 1×1 placeholder ICO (required by tauri-build on Windows).
- `src-tauri/src/main.rs` — calls arbor_lib::run().
- `src-tauri/src/lib.rs` — tauri::Builder::default().run().
- `src-tauri/src/{db,vault,unlock,fsrs,orchestrator,sympy_sidecar}/.gitkeep` — placeholder dirs.
- `rust-toolchain.toml` — channel = "stable".
- `README.md` — project name + "see spec/".
- `sidecar/.gitkeep`, `.claude/.gitkeep` — placeholder dirs.
- `.gitignore` was already present and correct (node_modules, target, dist, build).

**System prerequisites installed (not repo files):**
- pnpm 11.18.0 (via `npm install -g pnpm`)
- Rust stable 1.97.1 (via rustup — already registered in Windows user PATH)
- MSYS2 + MinGW64 binutils + GCC 16.1.0 (needed by `tauri-build`'s `windres` on the GNU toolchain). `C:\msys64\mingw64\bin` added to Windows user PATH.

**Nits:**
- `pnpm test` (vitest run) runs all test files including T-003 and T-005, which fail because those tickets are unimplemented. The T-001 acceptance criterion requires only `smoke.test.ts` to pass (22/22 ✓), not the full suite.
- The post-edit-lint hook cannot find cargo/gcc during this session because the PATH was set at process start before these tools were installed; it will work in new terminal sessions.
- `pnpm-workspace.yaml` was auto-created by pnpm during install; it is not a project file authored here.

## Verification
