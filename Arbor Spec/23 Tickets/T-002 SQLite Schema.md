---
id: T-002
phase: 1
status: done
depends_on: [T-001, T-005]
---

# T-002 — SQLite schema, migrations runner, C1 conformance

## Goal
The C1 schema exists as numbered migrations applied by a Rust migrations runner, with the DB file living in the app data dir. The schema in code is byte-identical to the contract mirror.

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C1 SQLite Schema]] (mirror: `contracts/schema.sql`, `contracts/migrations/*.sql` — ALREADY WRITTEN by architect; you copy/apply, you do not author DDL)
- Architecture: [[20 Architecture#Error-handling policy]], [[20 Architecture#Repository layout]]

## Files
**Create:** `src-tauri/src/db/mod.rs`, `src-tauri/src/db/migrations.rs`, `src-tauri/src/lib.rs` (re-exports `db` module as `pub`), `src-tauri/migrations/0001_init.sql` (copied verbatim from `contracts/migrations/0001_init.sql`)
**Modify:** `src-tauri/src/main.rs` (register db module + init on startup only), `src-tauri/Cargo.toml` (add `rusqlite` bundled + `thiserror` only; add `[[test]]` entries pointing to the two pre-written test files)

## Steps
1. Copy `contracts/migrations/0001_init.sql` into `src-tauri/migrations/` verbatim. The provided test diffs the two files; they must be byte-identical.
2. Implement `migrations.rs`: creates `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT)` with `IF NOT EXISTS` before checking it (bootstrap step); applies `migrations/*.sql` files in filename order, each inside its own transaction; records applied version in `schema_migrations` after each successful apply. Re-running on an already-initialised DB is a no-op (checks applied versions before applying).
3. Implement `db/mod.rs`: `pub fn open_or_init(path: &std::path::Path) -> Result<rusqlite::Connection, DbError>`; sets `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` on every connection before calling the migrations runner.
4. Create `src-tauri/src/lib.rs` that does `pub mod db;` — required for Rust integration tests in `tests/T-002/` to call `arbor::db::open_or_init`.
5. Errors: `thiserror` enum `DbError` per the error policy; `no unwrap()` outside `#[cfg(test)]` blocks.
6. In `src-tauri/Cargo.toml`: add to `[dependencies]`: `rusqlite = { version = "…", features = ["bundled"] }` and `thiserror = "…"` (pinned exact versions). Add:
   ```toml
   [[test]]
   name = "t002-migrations"
   path = "../tests/T-002/migrations.rs"

   [[test]]
   name = "t002-contract-sync"
   path = "../tests/T-002/contract_sync.rs"
   ```
7. Wire `db::open_or_init` into app startup in `main.rs`; failure to migrate = `eprintln!` + `std::process::exit(1)` (no custom copy).

## Acceptance criteria
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --test t002-migrations` passes (pre-written at `tests/T-002/migrations.rs`): applying `0001_init.sql` to a fresh in-memory DB succeeds; all 12 expected tables are present with STRICT mode; `schema_migrations` has a row with `version = 1` after apply
- [ ] Unit tests inside `src-tauri/src/db/migrations.rs` (written by implementer, run via `cargo test --manifest-path src-tauri/Cargo.toml`) pass: re-running `open_or_init` on an already-initialised DB is a no-op (no error, no duplicate migration rows); calling `open_or_init` on a DB that has `schema_migrations` recording version 1 applied but is missing a required table returns `Err` (not panic)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml --test t002-contract-sync` passes (pre-written at `tests/T-002/contract_sync.rs`): `src-tauri/migrations/0001_init.sql` is byte-identical to `contracts/migrations/0001_init.sql`
- [ ] `pnpm lint` exits 0 (tsc + clippy)

## Out of scope — DO NOT
- Do not author or "fix" any DDL. If the contract DDL seems wrong → Blocked.
- Do not add query helpers, ORMs, seed data, or any table not in C1.
- Do not implement any Tauri commands (that is C3 territory, later tickets).
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

### B-001 — RESOLVED (2026-08-05)

Acceptance test `strict_mode_rejects_type_violations` assumed integer→TEXT coercion would be rejected by STRICT mode. SQLite actually coerces integers to text via `applyAffinity` before the STRICT check, so the insert succeeds by design. Test rewritten by architect to insert TEXT `'not_a_number'` into `edge.id` (`INTEGER NOT NULL`), which STRICT correctly rejects. See decisions log entry {#strict-text-affinity-2026-08-05}.

Implementation state from the blocking session is intact — only the test needed fixing.

### B-002 — RESOLVED (2026-08-05)

**`cargo test --manifest-path src-tauri/Cargo.toml --lib` was failing with `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) on Windows.**

Resolution: Guarded the `use tauri::Manager;` import and the `run()` function in `src-tauri/src/lib.rs` with `#[cfg(not(test))]`. The test binary no longer links against Tauri or `WebView2Loader.dll`, so the unit tests compile and run successfully using only `rusqlite`. The non-test binary path (`main.rs` calling `arbor_lib::run()`) is unaffected because `#[cfg(not(test))]` is false only during `cargo test --lib`.

## Implementation notes

**Files created:**
- `src-tauri/src/db/mod.rs` — `open_or_init(path)` opens/creates a SQLite DB, sets `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`, then calls the migrations runner. Returns `DbError` on failure.
- `src-tauri/src/db/migrations.rs` — bootstraps `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT)` with `IF NOT EXISTS`, then applies `src-tauri/migrations/*.sql` files in filename order (each in its own transaction), skipping already-applied versions. Includes two unit tests: `rerun_is_noop` and `missing_table_after_recorded_version_is_err`.
- `src-tauri/migrations/0001_init.sql` — verbatim copy of `contracts/migrations/0001_init.sql`.
- `src-tauri/src/lib.rs` — `pub mod db;` plus Tauri-gated `run()` function.

**Files modified:**
- `src-tauri/src/main.rs` — calls `arbor_lib::run()`.
- `src-tauri/Cargo.toml` — added `rusqlite` (bundled) and `thiserror` dependencies; added `[[test]]` entries for `t002-migrations` and `t002-contract-sync`.
- `src-tauri/src/lib.rs` — `use tauri::Manager` and `pub fn run()` gated with `#[cfg(not(test))]` to prevent WebView2Loader.dll linkage in test builds on Windows (B-002 fix).

**Test results:**
- `cargo test --test t002-migrations` — 6/6 pass
- `cargo test --test t002-contract-sync` — 1/1 pass
- `cargo test --lib` — 2/2 pass
- `pnpm lint` — exits 0 (tsc + clippy clean)

## Verification

Verification: pass — 2026-08-05
- tests/T-002/migrations.rs (t002-migrations): 6/6 passed
- tests/T-002/contract_sync.rs (t002-contract-sync): 1/1 passed
- cargo test --lib (db::migrations::tests): 2/2 passed
- pnpm lint: exits 0
- src-tauri/migrations/0001_init.sql byte-identical to contracts/migrations/0001_init.sql: confirmed
- Out-of-scope: no violations (no query helpers, ORMs, seed data, Tauri commands, or extra tables)
- Protected paths in diff: none

