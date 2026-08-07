---
id: T-014
phase: 3
depends_on: [T-011]
---

# T-014 — Edge Highlighting (Selection + Completion)

## Goal
Edges visually respond to node selection and completion status. Selecting a node highlights its direct parent and child edges; completed nodes show green edges from their prerequisites.

## System prerequisites
none

## Context links (implementer may read ONLY these)
- Contract(s): [[21 Contracts/C7 Design Tokens]]
- Architecture section(s): [[20 Architecture#Frontend state]]

## Files
**Create:** (none)
**Modify:** `src/tokens.css`, `src/graph/graph-view.tsx`

## Steps

1. **Add CSS custom properties to `src/tokens.css`.** Add three new properties to `:root`:
   - `--color-edge-highlight: #1565c0;`
   - `--color-edge-completed: #2e7d32;`
   - `--graph-edge-highlight-width: 2.5px;`

2. **Compute edge styles in `graph-view.tsx`.** In the `useEffect` that builds `newFlowEdges`, replace the static edge style with dynamic styling based on two conditions:

   **Selection highlighting:** When `selectedNodeId` is set, find all edges where `source === selectedNodeId` or `target === selectedNodeId`. These edges get:
   - `stroke: tokens.color.edgeHighlight`
   - `strokeWidth: tokens.graph.edgeHighlightWidth`

   **Completion colouring:** For edges where the `target` node (the parent, since edges go child→parent) has `unlockStatuses[target] === 'completed'`, set:
   - `stroke: tokens.color.edgeCompleted`

   **Precedence:** If an edge matches BOTH selection AND completion, selection wins (highlight colour + highlight width).

   **Default:** Edges matching neither condition keep `stroke: tokens.graph.edgeColor` and `strokeWidth: tokens.graph.edgeWidth`.

3. **Add `selectedNodeId` and `unlockStatuses` to the `useEffect` dependency array** if not already present. `selectedNodeId` is already destructured from `useGraphStore()`. `unlockStatuses` is already in the dependency array.

4. **Verify:**
   - `pnpm lint` exits 0.
   - `tests/T-014/edge-highlight.test.tsx` passes.
   - `tests/T-009/token-lint.test.ts` passes (no hardcoded colours — all new values in `tokens.css` only).

## Acceptance criteria
- [ ] `tests/T-014/edge-highlight.test.tsx` passes
- [ ] `tests/T-009/token-lint.test.ts` passes (no new hardcoded colours in `src/` outside `tokens.css`)
- [ ] `pnpm lint` exits 0
- [ ] Selecting a node visually thickens and colours its direct edges blue
- [ ] Completed node edges from children are green
- [ ] Selection highlighting takes precedence over completion colouring

## Out of scope — DO NOT
- Do not modify `arbor-node.tsx`, `arbor-node.module.css`, `graph-view.module.css`, `layout-engine.ts`, `use-graph-loader.ts`, or any store file.
- Do not add animated edges, edge labels, or hover effects on edges.
- Do not add error handling, config, abstractions, or dependencies beyond what Steps specify.
- Do not "improve" adjacent code encountered along the way.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content. To check an installed package version use `pnpm list <pkg>`; to read a version field use the `Read` tool on `package.json` or `node_modules/<pkg>/package.json`.
- **If anything is ambiguous: STOP. Write the question under Blocked in the state sidecar, set `status: blocked`, end the session. Never choose.**

## State sidecar
Mutable ticket state (status, Blocked, Implementation notes, Verification) lives in **`Arbor Spec/23 Tickets/state/T-014.md`**, NOT in this file. This ticket spec file is architect-only (protected by contract-shield). The sidecar is writable by all roles.
