---
tags: [spec, stack, architecture]
---

# 10 Stack & Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri** (Rust backend) | Explicit requirement: fast-loading, no lag, light. Dramatically lighter than Electron. |
| UI | **React + TypeScript** | Ecosystem for graph rendering; type safety for the pack schema. |
| Graph | **React Flow** + **ELK** (layered/Sugiyama layout; dagre acceptable fallback) | DAG layout is a solved problem only with real layout engines. |
| Maths rendering | **KaTeX** | Needed everywhere; fast. |
| Symbolic checking | **sympy** (Python sidecar invoked by backend) | Deterministic, zero-token judging of parameterized answers. |
| Recall | **FSRS** (ts-fsrs) | Don't hand-roll spaced repetition. |
| State | **SQLite** via Tauri | [[09 Storage]] |
| Models | **Claude Agent SDK** authenticated against the developer's **Claude Code subscription** | v1 requirement: no API spend. Consequence: usage windows can exhaust mid-build ⇒ resumability is mandatory ([[02 Build Pipeline]]). Commercial/API deployment deferred. |

## Model-tier assignments (build expensive, teach cheap)

| Job | Tier |
|---|---|
| Scoping, decomposition, pruning pass, authoring, verification pass, repair **adjudicator** | Strong (Opus-class) |
| Teaching runtime (segment delivery, answer classification, tangents-in-scope), repair **detection** | Cheap (Haiku-class; Sonnet acceptable if Haiku classification quality disappoints) |
| Escalation valve ("ask the big model") | Strong, explicit user action only |
| Parameterized question judging, template re-rolls | **No model** — sympy + code |

Open (see [[12 Open Questions & Decisions Log]]): whether a local model can eventually run the teaching loop given how heavily scripted it is. Not v1.

## Process architecture

- **UI process** (Tauri webview): graph view, learning view, stats.
- **Backend** (Rust): SQLite, filesystem vault, sympy sidecar, unlock computation, FSRS scheduling.
- **Agent orchestrator**: long-running build jobs (resumable, checkpointed), teaching sessions (streaming), repair jobs (queued, background). Build jobs must survive app restarts via `build_state`.

## Performance principles

- Graph layout cached per graph version; recompute only on mutation.
- Packs loaded lazily per node; trunk summaries kept small ([[04 Node Pack Schema]]).
- Everything user-facing must feel instant; model latency is masked by streaming and by the fact that most interactions (re-rolls, sympy judging, navigation) involve **no model at all**.
