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

Tables (sketch):

```
trees        (id, slug, title, status, graph_version, created_at)
nodes        (id, tree_id, slug, title, one_liner, category, status, provenance)
edges        (parent_id, child_id, justification, provenance)
graph_log    (tree_id, version, mutation, rationale, ts)      -- changelog incl. repair
progress     (node_id, state, started_at, completed_at, diagnostic_record)
cards        (id, node_id, template_id, fsrs_state...)         -- one global deck
reviews      (card_id, ts, grade, source: review|diagnostic|test)
repair_reports (id, node_id, suspected_concept, evidence, ts, adjudicated, verdict)
tests        (id, tree_id, config, score, ts)
build_state  (tree_id, stage, artifact_checkpoints...)         -- resumability
settings     (key, value)                                      -- toggles, baseline choice
```

- **Unlock status is never a table** — computed live from `edges` + `progress` ([[03 Graph Model]]).
- `build_state` checkpoints make every pipeline stage resumable ([[02 Build Pipeline]]).

## Sync/backup

v1: local only. The vault being plain files + one SQLite file makes backup trivial (user's own sync tooling). Cloud sync is out of scope.
