---
tags: [spec, implementation, contracts, C2]
freeze: hard
mirrors:
  - contracts/pack.schema.json
  - contracts/pack.d.ts
---

# C2 — Pack Schema

> **Freeze level: HARD.** No change without an architect session + a dated entry in [[12 Open Questions & Decisions Log]]. Implementers may not edit the mirror files.

## Purpose

Defines the JSON structure of `pack.json` — the authoritative runtime artifact for a single node. Packs are produced once at Stage 5 of the build pipeline and read repeatedly by the teaching runtime. The schema is the boundary: anything the teaching runtime reads must be here; anything here the runtime must handle.

## Full definition

The authoritative schema lives in `contracts/pack.schema.json`. The TypeScript types live in `contracts/pack.d.ts`. Embed the type hierarchy here for human review:

```typescript
interface Pack {
  schema_version: 1;
  node_id: string;           // kebab-case, matches node.id in SQLite
  overview: Overview;
  segments: Segment[];       // ≥1; in topological order
  templates: QuestionTemplate[];  // ≥1; invariant: ≥1 per difficulty level
  diagnostic: DiagnosticItem[];   // bank ≥10; runtime draws exactly 10 per attempt across outcome_refs
  summary_for_context: string;    // max 800 chars; injected into cheap-model context
  addenda?: Addendum[];      // empty on authoring; grows via repair
}

interface Overview {
  summary_for_learner: string;
  outline: string[];         // ≥1 bullet points
  assumed_children: string[]; // node_id values of prerequisite children
}

interface Segment {
  id: string;                // kebab-case, unique within pack
  intent: string;
  question: string;          // KaTeX-renderable
  expected_paths: ExpectedPath[];   // ≥1; invariant: ≥1 with is_misconception: true
  hint_ladder: HintStep[];          // ≥4; invariant: last step.level === 'tell'
  resolution: string;
  quick_checks: QuickCheck[];       // ≥1
}

interface ExpectedPath {
  label: string;
  classifier_hint: string;
  response: string;
  is_misconception: boolean;
}

interface HintStep {
  level: 'probe' | 'nudge' | 'near-answer' | 'tell';
  text: string;
}

interface QuickCheck {
  question: string;
  expected_answer: string;
}

interface QuestionTemplate {
  id: string;
  stem: string;              // KaTeX-renderable; {param_name} placeholders
  parameters?: Record<string, ParamSpec>;
  answer_expr: string;       // sympy-parseable; may reference param names
  marking_notes: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ParamSpec {
  type: 'integer' | 'float';
  min?: number;
  max?: number;
  exclude_zero?: boolean;
}

interface DiagnosticItem {
  id: string;
  question: string;
  expected_answer: string;
  is_parameterized?: boolean;
  param_seed?: number;       // only when is_parameterized: true
  answer_expr?: string;      // sympy; only when is_parameterized: true
  outcome_refs: string[];    // ≥1; references node outcome identifiers
}

interface Addendum {
  id: string;                // pattern: add-NNN (e.g., add-001)
  date: string;              // ISO 8601 date
  reason: string;
  content: string;
}
```

## Invariants

The following invariants cannot be expressed in JSON Schema draft 2020-12 and are enforced by the pack loader (`src/api/pack-loader.ts`) after schema validation passes:

1. **At least one misconception path per segment** — every `segment.expected_paths` array must contain at least one entry with `is_misconception: true`. The floor guarantee requires the runtime to address misconceptions, not just confirm correctness.

2. **Terminal `tell` in every hint ladder** — `segment.hint_ladder[last].level` must be `'tell'`. Ladders that end in `probe`, `nudge`, or `near-answer` are authorisation errors; the learner would be permanently stuck.

3. **One template per difficulty** — `templates` must contain at least one entry for each of `'easy'`, `'medium'`, and `'hard'`. Custom tests sample from all difficulties; a missing difficulty makes some test configs impossible.

4. **`outcome_refs` reference real outcomes** — `diagnostic[i].outcome_refs` values must match identifiers within the node's `outcomes_json`. Cross-document validation; enforced at authoring time by the build pipeline's verification pass, not at load time.

5. **`schema_version` = 1** — a pack loader encountering any other value must throw `PackValidationError` immediately, before reading any other field.

6. **`answer_expr` is sympy-parseable** — enforced at authoring time by the sympy sidecar (C4); the pack loader does not re-run sympy.

7. **`diagnostic` is a bank of ≥10 items** — encoded in the JSON Schema (`minItems: 10`; no `maxItems`). The runtime draws exactly 10 per attempt, sampling across `outcome_refs` so all outcomes are represented. Bank size > 10 is encouraged so test-out and retakes use fresh samples without verbatim repeats. This is a runtime invariant, not a schema constraint.

8. **All-errors validation** — the pack loader must report ALL schema violations in a single pass, not short-circuit after the first failure. In AJV terms: `allErrors: true`. Packs are authored once and validated at build time; a loader that reports one error per run forces an edit-revalidate-repeat loop that is unacceptable for authoring diagnostics. `PackValidationError.errors` must contain the complete set of AJV `ErrorObject` instances for every failing keyword.

## Changelog

| Date       | Change                              | Decisions-log ref                          |
|------------|-------------------------------------|--------------------------------------------|
| 2026-07-23 | Initial schema v1                   | [[12 Open Questions & Decisions Log#C2-initial-2026-07-23]] |
| 2026-07-23 | diagnostic: exactly-10 → bank ≥10  | [[12 Open Questions & Decisions Log#C2-diagnostic-bank-2026-07-23]] |
| 2026-08-03 | allErrors validation invariant added | [[12 Open Questions & Decisions Log#C2-allErrors-2026-08-03]] |
