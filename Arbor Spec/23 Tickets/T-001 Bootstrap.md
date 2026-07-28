---
id: T-001
phase: 0
status: queued
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

## Verification
