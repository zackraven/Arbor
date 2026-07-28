---
id: T-003
phase: 1
status: queued
depends_on: [T-001]
---

# T-003 — pack.json schema validator + fixture packs

## Goal
A validation module that loads a `pack.json`, validates it against the C2 JSON Schema, and returns typed pack objects or a hard error. Two fixture packs (one valid, one systematically invalid) exercise it.

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C2 Pack Schema]] (mirror: `contracts/pack.schema.json` and generated `contracts/pack.d.ts` — ALREADY WRITTEN by architect)
- Architecture: [[20 Architecture#Module boundaries]] (pack loader paragraph), [[20 Architecture#Error-handling policy]]

## Files
**Create:** `src/api/pack-loader.ts` (pure TS, no Tauri dependency — fs access is injected as a read function so it is unit-testable), `tests/T-003/fixtures/valid-pack/pack.json`, `tests/T-003/fixtures/invalid-pack/pack.json`
**Modify:** `package.json` (add `ajv` pinned, devDep `ajv-cli` if the provided tests require it — they state so)

## Steps
1. Implement `loadPack(readFile, path): Pack` using ajv compiled against `contracts/pack.schema.json`. Validation failure throws `PackValidationError` carrying ajv's error array untouched. **No silent fallback, no partial pack, no defaulting of missing fields.**
2. Author the valid fixture: a small but complete pack for a fictional node "Chain Rule Basics" — 2 segments (each with question, ≥2 expected_paths including one misconception, hint ladder ending in `tell`, resolution, 1 quick_check), 3 templates (one per difficulty; `answer_expr` syntactically sympy-parseable strings), a 10-slot diagnostic mapping to outcomes, `summary_for_context` under the C2 length cap. Content quality does not matter; schema-completeness does.
3. Author the invalid fixture by taking the valid one and introducing exactly the violations the provided test enumerates (missing terminal `tell`, difficulty `"extreme"`, diagnostic slot referencing unknown outcome, oversized summary).
4. Export `Pack` types by re-exporting from `contracts/pack.d.ts` — do not re-declare types.

## Acceptance criteria
- [ ] `tests/T-003/pack-loader.test.ts` passes (valid loads with exact expected object shape; invalid throws with the four specific ajv error paths)
- [ ] `pnpm lint` exits 0
- [ ] Zero imports from `@tauri-apps/*` in `pack-loader.ts`

## Out of scope — DO NOT
- Do not edit `contracts/pack.schema.json` or `pack.d.ts`. Schema seems wrong → Blocked.
- Do not implement pack *writing*, vault paths, or any rendering.
- Do not add zod/other validators; ajv only.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
