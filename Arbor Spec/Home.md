---
tags: [spec, index]
---

# Arbor — Spec Vault

> Working title: **Arbor**. Rename freely; the spec never depends on the name.

A software + method for getting from a baseline level of knowledge to expert-level understanding of any area (physics/maths first), via a prerequisite DAG of small learnable nodes, taught Socratically by a cheap model executing packs authored by a strong model.

## Reading order

1. [[00 Vision]]
2. [[01 Concepts & Glossary]]
3. [[02 Build Pipeline]]
4. [[03 Graph Model]]
5. [[04 Node Pack Schema]]
6. [[05 Teaching Runtime]]
7. [[06 Repair System]]
8. [[07 Memory & Recall]]
9. [[08 Custom Tests]]
10. [[09 Storage]]
11. [[10 Stack & Architecture]]
12. [[11 UI Spec]]
13. [[12 Open Questions & Decisions Log]]

## Rules for the maintaining agent

- This vault is the single source of truth for the software. Code follows spec; if code must diverge, the spec is updated **first** or in the same change.
- Never silently rewrite history. Material changes to any note get a dated entry in the decisions log in [[12 Open Questions & Decisions Log]].
- Definitions live in [[01 Concepts & Glossary]] only. Other notes link to terms rather than redefining them.
- Keep v1 scope discipline: anything outside v1 goes to the *Non-goals / deferred* list in [[00 Vision]], not into feature notes.
