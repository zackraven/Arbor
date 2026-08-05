---
tags: [spec, storage, data]
---

# 09 Storage

Two stores with a clean split: **content is markdown, state is SQLite.**

## 1. Content vault (markdown, Obsidian-compatible)

The app's data folder is literally an Obsidian vault — human-readable, inspectable, portable, and independently useful as a Karpathy brain.

```
vault/
  trunk/
    <concept-slug>.md          # compact summary + provenance frontmatter
  trees/
    <tree-slug>/
      tree.md                  # tree overview: scope, categories, paper digest
      papers/                  # scraped paper digests + technical-terms dictionary
      nodes/
        <node-slug>/
          pack.md              # human-readable pack (outline, segments, resolutions)
          pack.json            # machine-exact pack (templates, expected paths, answer_exprs)
          addenda/             # repair addenda, numbered + dated
```

- `pack.md` and `pack.json` are generated together at authoring; `.json` is authoritative for the runtime, `.md` is the readable mirror.
- Trunk notes use wikilinks to related trunk concepts ⇒ the global knowledge graph is browsable in Obsidian for free.
- All content files are append/regenerate — never hand-edited by the app outside authoring/repair jobs.

## 2. State (SQLite, via Tauri backend)

Tables — the authoritative schema is [[21 Contracts/C1 SQLite Schema]] (hardened from this sketch during Phase 1). Key differences from the original sketch: singular table names (`tree` not `trees`); `id` is the slug (no separate `slug` column); `node.status` is `not_started|in_progress|completed` (never `locked`/`unlocked`/`pack_pending`/`pack_ready`); all tables use STRICT mode; all datetimes are ISO 8601 UTC TEXT; JSON columns are `_json`-suffixed TEXT validated by the Rust layer. See C1 for the full DDL.

```
tree         (id, title, scope_json, version, created_at, updated_at)
node         (id, tree_id, title, one_liner, category, outcomes_json, status, pack_path, provenance_json, created_at, updated_at)
edge         (id, tree_id, parent_id, child_id, justification, created_at)
graph_log    (id, tree_id, tree_version, change_type, entity_id, payload_json, actor, created_at)
progress     (id, node_id, session_id, started_at, completed_at, segments_done_json, diagnostic_result_json)
card         (id, node_id, question_type, template_ref, param_seed, fsrs_state_json, due_at, created_at, updated_at)
review       (id, card_id, reviewed_at, rating, answer_json, source)
repair_report (id, tree_id, node_id, session_id, category, payload_json, status, resolution_json, created_at, reviewed_at)
test         (id, tree_id, scope_json, count, difficulty, started_at, completed_at, score, out_of, result_json)
build_state  (tree_id, stage, status, checkpoint_json, started_at, updated_at)
setting      (key, value_json, updated_at)
```

- **Unlock status is never a table** — computed live from `edges` + `progress` ([[03 Graph Model]]).
- `build_state` checkpoints make every pipeline stage resumable ([[02 Build Pipeline]]).

## Sync/backup

v1: local only. The vault being plain files + one SQLite file makes backup trivial (user's own sync tooling). Cloud sync is out of scope.
