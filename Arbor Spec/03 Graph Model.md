---
tags: [spec, graph, data-model]
---

# 03 Graph Model

## Structure

A tree is a **DAG** ([[01 Concepts & Glossary]]): nodes + directed edges parent → child ("parent requires child").

- **No duplicate concepts.** A shared prerequisite is one node with multiple parents (enforced by the concept registry at build time).
- **Acyclicity is validated** at build time and after every repair mutation. A repair that would create a cycle is rejected.
- Leaves connect (conceptually) to the **trunk/baseline**; top-level nodes belong to the selected primary categories of the top bubble.

## Node record (graph-level; pack content lives separately, see [[04 Node Pack Schema]] and [[09 Storage]])

```
id            stable slug (also the pack folder name); TEXT primary key
title         short concept name ("Basic Partial Differentiation")
one_liner     one-sentence definition (used by the concept registry)
category      which top-bubble primary category it descends from (single TEXT)
outcomes_json 3–7 learning outcome strings (JSON array in TEXT column)
status        not_started | in_progress | completed  (C1 — never locked/unlocked/pack_*)
pack_path     vault-relative path to pack; NULL until authored
provenance_json  {} default; repair insertions carry date + rationale
```

Edges are stored in the `edge` table with `tree_id`, `parent_id`, `child_id`, `justification`. Provenance on edges was dropped during C1 hardening; graph_log records the actor (`build_pipeline|repair|user`) for each mutation instead.

## Node states & unlock rule

The stored `node.status` column has three values (C1 contract):

- **`not_started`** — no teaching begun (default).
- **`in_progress`** — teaching started, diagnostic not yet passed.
- **`completed`** — diagnostic passed; compact summary written to the trunk; FSRS cards live.

Locked/unlocked is **computed live**, never stored:

- **Locked** — some child not completed.
- **Unlocked** — all children completed (for baseline-adjacent leaves: unlocked from the start). Available for teaching *or* [[01 Concepts & Glossary|test-out]]. No skipping past locked nodes, ever.

**Invariant: unlock status is computed live from the current graph, never stored as a static list.** Rationale: the graph can change under a learner (repair insertions/removals — [[06 Repair System]]). A node inserted below something already "unlocked" simply re-locks it by computation; completed nodes are never revoked.

## Layout

DAG layout is a solved-but-nontrivial problem: use layered (Sugiyama-style) layout via **ELK** (or dagre), rendered with **React Flow** ([[10 Stack & Architecture]]). Layout is computed, cached per graph version, and recomputed on repair mutations. Aesthetic requirements in [[11 UI Spec]].

## Graph versioning

Every mutation (build completion, review edits, repair changes) bumps a graph version and is appended to a per-tree changelog (who/what/why — repair entries carry the adjudicator rationale). The UI surfaces repair-driven changes to the user ("added *Contour Integration* below *Propagators* — here's why").
