---
id: T-016
phase: 4
depends_on: [T-015]
---

# T-016 — Pipeline eval harness: rubric engine and infrastructure

## Goal
Build the eval harness infrastructure that evaluates pipeline decomposition output against assertion-based rubrics. The harness takes a decomposition (SeedTree JSON) and a rubric (JSON assertion file), evaluates every assertion, and produces a violation report. Rubric files are authored by the architect (user), not by the implementer — this ticket builds the engine, not the test data.

## System prerequisites
None beyond existing prerequisites.

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C2 Pack Schema]] (for pack structure awareness)
- Architecture section: [[20 Architecture#Repository layout]]
- Spec notes: [[03 Graph Model]] (node/edge structure), [[04 Node Pack Schema]] (pack contents), [[01 Concepts & Glossary]] (justification test, node contract)

## Files
**Create:** `tests/eval/README.md`, `tests/eval/rubric-schema.ts`, `tests/eval/eval-engine.ts`, `tests/eval/eval-report.ts`, `tests/eval/eval.test.ts`, `tests/eval/rubrics/.gitkeep`
**Modify:** `tsconfig.json` (ensure `tests/eval` is not excluded), `package.json` (add `eval` script)

## Steps

1. **Create `tests/eval/README.md`** — document the eval harness purpose and usage:
   - What: a rubric-based evaluation engine for pipeline decomposition output.
   - Why: decomposition quality cannot be acceptance-tested with unit tests. Rubrics encode domain-expert assertions about what a good decomposition should contain.
   - How: `pnpm eval <decomposition.json> <rubric.json>` runs assertions and reports violations.
   - Rubric files are authored by the architect/user, NOT by the implementer. They live in `tests/eval/rubrics/` and are committed alongside the harness.

2. **Create `tests/eval/rubric-schema.ts`** — TypeScript types for rubric files and decomposition input:

   ```typescript
   /** A rubric is a set of assertions about a decomposition. */
   export interface Rubric {
     subject: string;              // human name of the subject being evaluated
     author: string;               // who wrote this rubric
     date: string;                 // ISO date
     notes?: string;               // rationale for the assertion choices
     assertions: Assertion[];
   }

   export type Assertion =
     | MustContainAssertion
     | MustNotContainAssertion
     | NodeCountAssertion
     | DepthRangeAssertion
     | OrderingAssertion
     | MaxFanInAssertion
     | OutcomeCountAssertion
     | JustificationPresentAssertion
     | DagAssertion;

   /** A concept with this title (or close match) must appear as a node. */
   interface MustContainAssertion {
     type: 'must_contain';
     concept: string;              // expected node title (fuzzy matched)
     reason?: string;              // why this concept must appear
   }

   /** A concept with this title must NOT appear (over-decomposition guard). */
   interface MustNotContainAssertion {
     type: 'must_not_contain';
     concept: string;
     reason?: string;
   }

   /** Total node count must be within [min, max]. */
   interface NodeCountAssertion {
     type: 'node_count';
     min: number;
     max: number;
   }

   /** DAG depth (longest path from root to leaf) must be within [min, max]. */
   interface DepthRangeAssertion {
     type: 'depth_range';
     min: number;
     max: number;
   }

   /** Concept A must appear before (be an ancestor of) concept B. */
   interface OrderingAssertion {
     type: 'ordering';
     ancestor: string;             // fuzzy matched node title
     descendant: string;           // fuzzy matched node title
     reason?: string;
   }

   /** No node may have more than `max` parents (incoming edges). */
   interface MaxFanInAssertion {
     type: 'max_fan_in';
     max: number;
   }

   /** Every node must have between min and max outcomes (node contract). */
   interface OutcomeCountAssertion {
     type: 'outcome_count';
     min: number;                  // typically 3
     max: number;                  // typically 7
   }

   /** Every edge must have a non-empty justification string. */
   interface JustificationPresentAssertion {
     type: 'justification_present';
   }

   /** The graph must be a valid DAG (no cycles). */
   interface DagAssertion {
     type: 'dag';
   }

   /** The decomposition format — matches SeedTree from C3. */
   export interface Decomposition {
     id: string;
     title: string;
     nodes: DecompNode[];
     edges: DecompEdge[];
   }

   export interface DecompNode {
     id: string;
     title: string;
     outcomes?: string[];
   }

   export interface DecompEdge {
     parent_id: string;
     child_id: string;
     justification?: string;
   }

   /** Result of evaluating one assertion. */
   export interface AssertionResult {
     assertion: Assertion;
     passed: boolean;
     message: string;              // human-readable explanation
   }

   /** Full evaluation report. */
   export interface EvalReport {
     subject: string;
     rubric_assertion_count: number;
     passed: number;
     failed: number;
     results: AssertionResult[];
   }
   ```

3. **Create `tests/eval/eval-engine.ts`** — the evaluation engine. Takes a `Decomposition` and a `Rubric`, evaluates each assertion, returns an `EvalReport`:

   - **`must_contain`**: fuzzy-match `concept` against all node titles. Pass if any node matches with ≥0.6 token-overlap similarity. Report the best-match score even on failure.
   - **`must_not_contain`**: inverse — fail if any node matches ≥0.6.
   - **`node_count`**: count nodes, check range.
   - **`depth_range`**: compute longest path (topological sort), check range.
   - **`ordering`**: fuzzy-match both concepts to nodes, then check that `ancestor` is reachable from root before `descendant` (i.e. `ancestor` is an ancestor of `descendant` in the DAG). If either concept can't be matched, the assertion fails with "concept not found".
   - **`max_fan_in`**: count incoming edges per node, fail if any exceeds max.
   - **`outcome_count`**: check every node's outcomes array length against [min, max].
   - **`justification_present`**: check every edge has a non-empty justification string.
   - **`dag`**: topological sort; fail if cycle detected. Report the cycle nodes.

   **Fuzzy matching**: implement a simple token-overlap similarity (split on whitespace and punctuation, count shared tokens / total unique tokens). No external dependency. Threshold ≥0.6 = match.

   Export: `evaluate(decomposition: Decomposition, rubric: Rubric): EvalReport`

4. **Create `tests/eval/eval-report.ts`** — CLI entry point. Reads a decomposition JSON file and a rubric JSON file from command-line arguments, runs `evaluate()`, and prints a human-readable markdown report to stdout. Exit code 0 if all assertions pass, 1 if any fail. Sections:
   - Summary: X/Y assertions passed
   - Failures table: assertion type, details, message
   - Passes table (optional, controlled by `--verbose` flag)

5. **Create `tests/eval/eval.test.ts`** — vitest tests for the eval engine itself:
   - `must_contain` passes when concept is present, fails when absent.
   - `must_not_contain` passes when concept is absent, fails when present.
   - `node_count` passes within range, fails outside.
   - `depth_range` computes correct depth on a known DAG.
   - `ordering` detects ancestor/descendant relationship correctly.
   - `max_fan_in` detects violation when a node has too many parents.
   - `outcome_count` detects nodes with too few or too many outcomes.
   - `justification_present` detects missing justifications.
   - `dag` detects cycles.
   - Token-overlap similarity: "Newton's Second Law" matches "Newton's 2nd Law" (≥0.6), does not match "Thermodynamic Equilibrium" (<0.6).
   - Full integration: construct a small decomposition + rubric, run `evaluate()`, check report counts.

6. **Create `tests/eval/rubrics/.gitkeep`** — placeholder for rubric files. The architect will author rubric files after the harness is built.

7. **Modify `package.json`** — add script:
   ```json
   "eval": "tsx tests/eval/eval-report.ts"
   ```

8. **Modify `tsconfig.json`** — ensure `tests/eval` is not in the `exclude` array.

## Acceptance criteria
- [ ] `tests/eval/eval.test.ts` passes — all assertion types tested, fuzzy matching works
- [ ] `pnpm eval` with a test decomposition and test rubric produces a readable report (the test can construct inline JSON for this)
- [ ] `pnpm lint` exits 0
- [ ] No rubric content is authored by the implementer — only the engine and test fixtures for engine testing (small synthetic decompositions, not domain-correct subjects)

## Out of scope — DO NOT
- Do not author subject-matter rubrics (classical mechanics, thermodynamics, etc.) — that is the architect's job after the harness ships.
- Do not implement any pipeline stages — this is eval infrastructure only.
- Do not add dependencies beyond what's already in the project (implement token-overlap similarity inline).
- Do not connect this to the Tauri backend or any database.
- Do not create pack content (segments, templates, diagnostics) — only evaluate graph structure.
- Do not use golden-file comparison or hand-authored reference decompositions. The harness is assertion-based, not diff-based.
- Do not modify any contract file, any existing test file, or any spec note.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners.
- **If anything is ambiguous: STOP. Write the question under Blocked in the state sidecar, set `status: blocked`, end the session. Never choose.**

## State sidecar
Mutable ticket state (status, Blocked, Implementation notes, Verification) lives in **`Arbor Spec/23 Tickets/state/T-016.md`**, NOT in this file. This ticket spec file is architect-only (protected by contract-shield). The sidecar is writable by all roles.
