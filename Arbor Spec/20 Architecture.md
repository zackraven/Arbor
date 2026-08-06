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
    state/                 # frontend state mgmt (zustand — one store per domain)
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

- [x] Frontend state management choice + patterns — closed: zustand, one store per domain. See [[12 Open Questions & Decisions Log#phase3-elk-and-zustand-2026-08-06]].
- [ ] FSRS: rs-fsrs in backend vs ts-fsrs in frontend (leaning backend — single owner of review state)
- [ ] Streaming transport for teach sessions (Tauri events vs channel)
- [ ] Orchestrator persistence details beyond `build_state` sketch
- [ ] Migration strategy/versioning policy for SQLite

## Environment notes (Windows/MINGW64)

Three Windows/MINGW64 quirks that have bitten Phase 0, collected here so they are findable in one place:

**1. MinGW64 GCC toolchain required for Tauri builds (surfaced T-001)**

Tauri v2 on Windows requires the MSYS2/MinGW64 GCC toolchain, not MSVC. Install via MSYS2 (`pacman -S mingw-w64-x86_64-gcc`). The MinGW64 `bin/` directory must be on the Windows user PATH before `cargo build` can link the Tauri backend. This is a system prerequisite — add it explicitly to any ticket that involves a first `cargo build` on a new machine.

**2. pnpm `allowBuilds` opt-in for postinstall packages (surfaced T-001/T-005)**

pnpm 11's security model blocks packages with `postinstall` scripts unless they are explicitly opted in. When a new dependency with a postinstall script is installed (e.g. `esbuild` as a transitive dep of Vite, `playwright`), pnpm auto-generates a placeholder entry in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: "set this to true or false"
```

This placeholder blocks all subsequent `pnpm` commands. Resolution: set the value to `true` for trusted build tools. Any ticket that adds a package with a postinstall script must name the required `allowBuilds` entry explicitly in its Steps so the implementer does not hit a Blocked condition.

**3. MSYS shell path conversion (surfaced T-005)**

On MINGW64 (MSYS2/Git Bash), the shell silently converts arguments that begin with `/` or a Windows drive letter into Unix-style paths before the target script receives them. For example, `--route /` becomes `--route C:/Program Files/Git/`, and `--out C:/tmp/foo` may be mangled depending on the shell configuration.

Affected: any CLI invocation (including `pnpm observe`) where path or URL-path arguments start with `/` or a drive letter.

Prevention: prefix the command with `MSYS_NO_PATHCONV=1`:

```
MSYS_NO_PATHCONV=1 pnpm observe --route / --out C:/tmp/arbor-obs
```

Phase 3+ UI ticket acceptance criteria must include this prefix (enforced in the `/write-ticket` skill's automated-observation clause).
