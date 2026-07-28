---
tags: [spec, implementation, contracts, C1]
freeze: hard
mirrors:
  - contracts/schema.sql
  - contracts/migrations/0001_init.sql
---

# C1 — SQLite Schema

> **Freeze level: HARD.** No change without an architect session + a dated entry in [[12 Open Questions & Decisions Log]]. Implementers may not edit the mirror files.

## Purpose

Defines every SQLite table, column, constraint, and index that the Arbor backend may read or write. Also specifies the per-connection pragma contract that all code must apply before any query. All other storage (vault markdown, in-memory unlock computation) is out of scope for this contract.

## Full definition

The authoritative DDL lives in the mirror files. Embed here for human review:

```sql
-- Per-connection setup (applied by db::open_or_init before any query):
--   PRAGMA foreign_keys = ON;
--   PRAGMA journal_mode = WAL;   -- sticky; set once on DB creation
--
-- Naming conventions:
--   Singular table names (node, not nodes); snake_case columns.
--   All datetimes: ISO 8601 UTC as TEXT ("2026-07-23T10:00:00Z").
--   JSON columns: TEXT; validity enforced at the application layer.
--   IDs: TEXT (slug, kebab-case) for domain entities; INTEGER for log/event rows.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL,
    PRIMARY KEY (version)
) STRICT;

CREATE TABLE tree (
    id          TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    scope_json  TEXT    NOT NULL,   -- {top_bubble: string, categories: string[]}
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE node (
    id               TEXT    NOT NULL,
    tree_id          TEXT    NOT NULL REFERENCES tree(id),
    title            TEXT    NOT NULL,
    one_liner        TEXT    NOT NULL,
    category         TEXT    NOT NULL,
    outcomes_json    TEXT    NOT NULL,  -- string[] of outcome descriptions
    status           TEXT    NOT NULL   DEFAULT 'not_started'
                                        CHECK(status IN (
                                            'not_started',
                                            'in_progress',
                                            'completed'
                                        )),
    pack_path        TEXT,              -- vault-relative path; NULL until authored
    provenance_json  TEXT    NOT NULL   DEFAULT '{}',
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE edge (
    id            INTEGER NOT NULL,
    tree_id       TEXT    NOT NULL REFERENCES tree(id),
    parent_id     TEXT    NOT NULL REFERENCES node(id),
    child_id      TEXT    NOT NULL REFERENCES node(id),
    justification TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (parent_id, child_id),
    CHECK (parent_id != child_id)
) STRICT;

CREATE TABLE graph_log (
    id           INTEGER NOT NULL,
    tree_id      TEXT    NOT NULL REFERENCES tree(id),
    tree_version INTEGER NOT NULL,
    change_type  TEXT    NOT NULL CHECK(change_type IN (
                                      'node_added', 'node_removed',
                                      'edge_added', 'edge_removed',
                                      'node_updated'
                                  )),
    entity_id    TEXT    NOT NULL,
    payload_json TEXT    NOT NULL,
    actor        TEXT    NOT NULL CHECK(actor IN (
                                      'build_pipeline', 'repair', 'user'
                                  )),
    created_at   TEXT    NOT NULL,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE progress (
    id                     INTEGER NOT NULL,
    node_id                TEXT    NOT NULL REFERENCES node(id),
    session_id             TEXT    NOT NULL,
    started_at             TEXT    NOT NULL,
    completed_at           TEXT,
    segments_done_json     TEXT    NOT NULL DEFAULT '[]',
    diagnostic_result_json TEXT,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE card (
    id              TEXT    NOT NULL,
    node_id         TEXT    NOT NULL REFERENCES node(id),
    question_type   TEXT    NOT NULL CHECK(question_type IN (
                                        'diagnostic', 'quick_check', 'template'
                                    )),
    template_ref    TEXT    NOT NULL,
    param_seed      INTEGER,
    fsrs_state_json TEXT    NOT NULL DEFAULT '{}',
    due_at          TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE review (
    id          INTEGER NOT NULL,
    card_id     TEXT    NOT NULL REFERENCES card(id),
    reviewed_at TEXT    NOT NULL,
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 4),
    answer_json TEXT,
    source      TEXT    NOT NULL CHECK(source IN (
                                    'teaching', 'diagnostic', 'test', 'recall'
                                )),
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE repair_report (
    id              INTEGER NOT NULL,
    tree_id         TEXT    NOT NULL REFERENCES tree(id),
    node_id         TEXT    NOT NULL REFERENCES node(id),
    session_id      TEXT    NOT NULL,
    category        TEXT    NOT NULL CHECK(category IN (
                                        'off_layer_confusion',
                                        'repeated_hint_failure',
                                        'unexpected_tangent'
                                    )),
    payload_json    TEXT    NOT NULL,
    status          TEXT    NOT NULL   DEFAULT 'pending'
                                       CHECK(status IN (
                                           'pending', 'no_change',
                                           'addendum', 'insertion'
                                       )),
    resolution_json TEXT,
    created_at      TEXT    NOT NULL,
    reviewed_at     TEXT,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE test (
    id               TEXT    NOT NULL,
    tree_id          TEXT    NOT NULL REFERENCES tree(id),
    scope_json       TEXT    NOT NULL,
    count            INTEGER NOT NULL,
    difficulty       TEXT    CHECK(difficulty IN ('easy', 'medium', 'hard')),
    started_at       TEXT    NOT NULL,
    completed_at     TEXT,
    score            INTEGER,
    out_of           INTEGER,
    result_json      TEXT,
    PRIMARY KEY (id)
) STRICT;

CREATE TABLE build_state (
    tree_id         TEXT    NOT NULL REFERENCES tree(id),
    stage           INTEGER NOT NULL CHECK(stage BETWEEN 0 AND 5),
    status          TEXT    NOT NULL CHECK(status IN (
                                        'pending', 'running', 'done', 'failed'
                                    )),
    checkpoint_json TEXT    NOT NULL DEFAULT '{}',
    started_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (tree_id, stage)
) STRICT;

CREATE TABLE setting (
    key        TEXT NOT NULL,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (key)
) STRICT;

-- Indexes
CREATE INDEX idx_node_tree      ON node(tree_id);
CREATE INDEX idx_edge_tree      ON edge(tree_id);
CREATE INDEX idx_edge_parent    ON edge(parent_id);
CREATE INDEX idx_edge_child     ON edge(child_id);
CREATE INDEX idx_graph_log_tree ON graph_log(tree_id);
CREATE INDEX idx_progress_node  ON progress(node_id);
CREATE INDEX idx_card_node      ON card(node_id);
CREATE INDEX idx_card_due       ON card(due_at);
CREATE INDEX idx_review_card    ON review(card_id);
CREATE INDEX idx_repair_tree    ON repair_report(tree_id);
CREATE INDEX idx_repair_node    ON repair_report(node_id);
CREATE INDEX idx_test_tree      ON test(tree_id);
```

## Invariants

1. **Pragmas required on every connection** — `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` must be executed by `db::open_or_init` before any query. WAL is sticky (survives reconnects) but must be set on DB creation.
2. **`node.status` is never 'locked' or 'unlocked'** — unlock is computed live from the graph and never persisted. The three stored states are `not_started`, `in_progress`, `completed`.
3. **`edge.justification` is NOT NULL** — every edge must survive the justification test ("state the specific step in the parent that fails without this child"). Blank justifications are a build-pipeline failure, not a schema concern.
4. **`graph_log` is append-only** — rows are never updated or deleted. `tree.version` is bumped on every graph mutation; `graph_log` records the full change.
5. **`schema_migrations` is the runner's responsibility** — the runner creates this table with `IF NOT EXISTS` before reading it. The migration file (`0001_init.sql`) also creates it with `IF NOT EXISTS` so the file is self-contained for replay in tests.
6. **Datetime format** — all `*_at` and `due_at` columns store ISO 8601 UTC strings (e.g., `"2026-07-23T10:00:00Z"`). No Unix timestamps, no local time.
7. **JSON columns** — `TEXT` columns with `_json` suffix contain valid JSON. Validation is enforced by the Rust layer, not SQLite. The schema defines TEXT only.
8. **Migration files are byte-identical to the contract mirror** — `src-tauri/migrations/0001_init.sql` must be a verbatim copy of `contracts/migrations/0001_init.sql`. The `contract_sync` acceptance test asserts this.
9. **`schema_migrations.version` is INTEGER** — sorts numerically; version 10 > version 9. The runner tracks applied versions as integers, not strings.

## Changelog

| Date       | Change                              | Decisions-log ref                          |
|------------|-------------------------------------|--------------------------------------------|
| 2026-07-23 | Initial schema — 11 tables + indexes | [[12 Open Questions & Decisions Log#C1-initial-2026-07-23]] |
