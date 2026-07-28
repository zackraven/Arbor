-- Arbor SQLite schema reference — C1
-- This file is a byte-identical copy of contracts/migrations/0001_init.sql.
-- It exists as a human-legible reference alongside the migration series.
-- When a new migration is added, this file becomes a concatenation of all
-- applied migrations (managed by the architect).
--
-- Source of truth: Arbor Spec/21 Contracts/C1 SQLite Schema.md

-- Migration bookkeeping (created by runner bootstrap, also here for
-- self-contained replay in tests).
-- test line
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL,
    PRIMARY KEY (version)
) STRICT;

-- ─── Core graph ─────────────────────────────────────────────────────────────

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
    outcomes_json    TEXT    NOT NULL,
    status           TEXT    NOT NULL   DEFAULT 'not_started'
                                        CHECK(status IN (
                                            'not_started',
                                            'in_progress',
                                            'completed'
                                        )),
    pack_path        TEXT,
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
