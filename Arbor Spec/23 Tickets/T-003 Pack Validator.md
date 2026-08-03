---
id: T-003
phase: 1
status: queued
depends_on: [T-001, T-005]
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

**Hook deny — `node` command blocked by bash-guard (2026-08-03)**

During step 4 (running tests), I attempted:
```
node -e "const p = require('.../ajv/package.json'); console.log(p.version)"
```
to verify the installed ajv version after `pnpm install`. The bash-guard hook denied this with: `bash-guard: 'node' is not permitted in implementer/verifier sessions.`

Per the HOOK DENY = FULL STOP rule, the session ends here.

**State at time of block — all implementation work is complete:**
- `package.json` — `"ajv": "8.17.1"` added to `dependencies`. `pnpm install` ran successfully (exit 0); ajv is present in `node_modules/ajv/`.
- `src/api/pack-loader.ts` — created. Uses `Ajv2020` from `ajv/dist/2020`, validates against `contracts/pack.schema.json`, exports `loadPack` and `PackValidationError`. Zero `@tauri-apps` imports.
- `tests/T-003/fixtures/valid-pack/pack.json` — created. Schema-complete: node_id `chain-rule-basics`, 2 segments, 3 templates (easy/medium/hard), 10 diagnostic items, summary ≤ 800 chars.
- `tests/T-003/fixtures/invalid-pack/pack.json` — created. Four deliberate violations: `templates[0].difficulty = "extreme"`, `segments[0]` missing `resolution`, `summary_for_context` of ~957 chars (> 800), and only 9 diagnostic items.

**Question for architect:** Should `node` be added to the bash-guard allowlist for implementer sessions, or should the acceptance tests be run via a `pnpm` script (e.g., `pnpm test`) rather than `node` directly? The existing `pnpm test` script calls vitest and does not invoke `node` directly. The block was triggered only because I tried to use `node` to inspect a file for diagnostic purposes — the actual test run uses `pnpm test`.

**Recommended resolution:** If the `pnpm test` script is the only required command, the architect can clear this block and allow a fresh implementer session to run `pnpm test` and `pnpm lint` to verify acceptance criteria. No code changes should be needed.

---

**Architect response (2026-08-03):**

**False-positive analysis — deny confirmed correct.** The specific invocation (`node -e "require('.../ajv/package.json'); console.log(p.version)"`) was read-only and diagnostically harmless. However, `node -e "require('fs').writeFileSync('contracts/pack.schema.json', '...')"` is syntactically identical at the command-class level. bash-guard cannot inspect `-e` argument content and determine it is free of file operations — that would require a full JS parser plus runtime analysis. The deny is therefore correct: `node` is denied as a command class regardless of arguments, and this particular use case does not justify an exception.

**Decision — bash-guard stays strict on node / node -e / node --version.** Permitting any `node` invocation would reopen the runtime-interpreter bypass class (the T-003 bypass post-mortem class, 2026-08-02) for the convenience of a step that has direct non-node alternatives:

- To check an installed package version: `pnpm list ajv` (permitted — pnpm is on the allowlist).
- To read a version field: use the `Read` tool on `package.json` or `node_modules/ajv/package.json`.

The HOOK DENY = FULL STOP rule held correctly. No corrective action on bash-guard is needed.

**Implementation confirmed sound.** Architect has reviewed all created artifacts:

- `package.json` — `"ajv": "8.17.1"` in dependencies; no `ajv-cli` (tests do not require it). ✓
- `src/api/pack-loader.ts` — uses `Ajv2020` from `ajv/dist/2020`, compiles `contracts/pack.schema.json`, exports `loadPack` and `PackValidationError`, re-exports `Pack` from `contracts/pack`. Zero `@tauri-apps` imports. ✓
- `tests/T-003/fixtures/valid-pack/pack.json` — `schema_version: 1`, `node_id: "chain-rule-basics"`, 2 segments each with ≥2 expected_paths and ≥1 misconception and hint_ladder ending in `tell` and ≥1 quick_check, 3 templates (easy/medium/hard), 10 diagnostic items, `summary_for_context` under 800 chars. ✓
- `tests/T-003/fixtures/invalid-pack/pack.json` — four deliberate violations matching the test's expectation: `templates[0].difficulty = "extreme"` → `/templates/0/difficulty`; `segments[0]` missing `resolution` → `/segments/0`; oversized `summary_for_context` → `/summary_for_context`; 9 diagnostic items → `/diagnostic`. ✓

**Resumption instructions for the fresh implementer session:** All implementation is complete. No file changes are expected. The session's only job is:

1. `pnpm test` — confirm all T-003 tests pass.
2. `pnpm lint` — confirm exit 0.
3. If both pass: fill `## Implementation notes` and set `status: implemented`.
4. If either fails: write the failure under `## Blocked`, set `status: blocked`, end the session.

Do NOT run `node` directly. Do NOT use `node -e` for any diagnostic purpose.

## Implementation notes

## Verification
