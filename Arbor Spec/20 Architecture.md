---
tags: [spec, implementation, architecture]
---

# 20 Architecture

> Implementation layer, part 1 of 4. Everything decided here is a decision the implementer no longer gets to make. Sections marked `TODO(architect)` are filled by architect sessions before their phase begins — hardest-frozen first, warm areas later.

## Repository layout

```
arbor/
  Arbor Spec/              # this Obsidian vault (design 00–12 + implementation 20–23)
  src/                     # React + TS frontend
    graph/                 # graph view, layout adapters (React Flow + ELK)
    learn/                 # learning view, diagnostic UI, recall runner
    stats/                 # stats tab
    state/                 # frontend state mgmt (TODO(architect): choose — zustand favoured)
    api/                   # typed wrappers over Tauri commands (generated from contracts)
  src-tauri/               # Rust backend
    src/
      db/                  # SQLite access, migrations runner
      vault/               # markdown vault read/write
      unlock/              # live unlock computation
      fsrs/                # scheduling (wraps rs-fsrs or ts-fsrs via sidecar — TODO(architect))
      orchestrator/        # agent jobs: build, teach, repair (checkpointed)
      sympy_sidecar/       # process mgmt + request/response for the python judge
  sidecar/                 # python: sympy judge (thin, stateless)
  contracts/               # machine-readable mirrors of 21 Contracts (JSON Schema, .sql, .d.ts)
  tests/                   # acceptance tests, organised by ticket id (tests/T-002/…)
  .claude/                 # agents, skills, hooks — see [[24 Agent Tooling & Optimisation]]
```

Rule: `contracts/` files are generated/copied from `21 Contracts/` notes by an architect session. Code imports from `contracts/`; nothing re-types a contract by hand.

## Module boundaries

- Frontend ↔ backend ONLY via Tauri commands defined in [[21 Contracts/C3 Tauri Commands]]. No direct fs/db access from the webview.
- Orchestrator ↔ models ONLY via the job interface in [[21 Contracts/C5 Orchestrator Jobs]].
- Anything touching pack content goes through the pack loader (validates against [[21 Contracts/C2 Pack Schema]] on read; invalid pack = hard error, never a silent fallback).

## Error-handling policy

- Backend: `thiserror` typed errors per module; every Tauri command returns `Result<T, AppError>` where `AppError` serialises to `{ code, message, detail? }` (codes enumerated in C3). No `unwrap()` outside tests.
- Frontend: errors surface as a single toast component; unexpected codes render the raw code (no invented copy).
- Build jobs: any stage error writes a checkpoint + surfaces in build UI; never silently retried more than the retry count specified in C5.

## Naming conventions

- Files: kebab-case (TS), snake_case (Rust/py). Types: PascalCase. DB: snake_case tables/columns, singular table names as in [[21 Contracts/C1 SQLite Schema]].
- Ticket ids `T-###`; tests for a ticket live in `tests/T-###/`.

## TODO(architect) queue

- [ ] Frontend state management choice + patterns
- [ ] FSRS: rs-fsrs in backend vs ts-fsrs in frontend (leaning backend — single owner of review state)
- [ ] Streaming transport for teach sessions (Tauri events vs channel)
- [ ] Orchestrator persistence details beyond `build_state` sketch
- [ ] Migration strategy/versioning policy for SQLite
