---
id: T-010
phase: 3
status: queued
depends_on: [T-009]
---

# T-010 — Graph view with 60-node fixture render

## Goal
The app renders the 60-node classical mechanics fixture as a pan/zoom DAG with readable labels. This is the layout quality risk ticket — if the graph looks bad, we learn that now before building the pipeline.

## System prerequisites
The user must install these before dispatching:
- `pnpm add -D @testing-library/react`

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C7 Design Tokens]] (mirror: `contracts/tokens.ts`)
- Contract: [[21 Contracts/C3 Tauri Commands]] (mirror: `contracts/commands.d.ts`)
- Skill: `.claude/skills/frontend-design/SKILL.md`
- Architecture: [[20 Architecture#Repository layout]], [[20 Architecture#Module boundaries]]

## Files
**Create:** `src/graph/graph-view.tsx`, `src/graph/graph-view.module.css`, `src/graph/arbor-node.tsx`, `src/graph/arbor-node.module.css`, `src/graph/use-graph-loader.ts`
**Modify:** `src/App.tsx`, `tsconfig.json` (remove `tests/T-010` from the `exclude` array)

## Steps

1. **Create `src/graph/use-graph-loader.ts`** — a custom hook that loads graph data into the zustand graph store. Detection logic:
   - Check if `window.__TAURI_INTERNALS__` exists (cast `window` as `{ __TAURI_INTERNALS__?: unknown }`).
   - If present: call `getGraph(treeId)` and `computeUnlock(treeId)` from `src/api/tauri-commands.ts`, then `setGraph()` and `setUnlockStatuses()` on the graph store.
   - If absent (browser / test / observe mode): import `tests/fixtures/large-tree.json` statically (`import fixtureData from '../../tests/fixtures/large-tree.json'`), convert it to the `Graph` shape (map fixture nodes to `GraphNode` with `pack_path: null`, map fixture edges to `GraphEdge` with sequential integer `id`s), populate the store with `setGraph()`, and set all unlock statuses to `'locked'` (default for the fixture — T-011 will add mixed statuses).
   - The hook takes an optional `treeId: string` parameter. In non-Tauri mode, `treeId` is ignored (the fixture is always loaded).
   - The hook runs its loading logic in a `useEffect` on mount (dependency: `treeId`).
   - Export: `export function useGraphLoader(treeId?: string): { loading: boolean; error: string | null }`.
   - Track loading/error state with `useState`.

2. **Create `src/graph/arbor-node.tsx`** — a custom React Flow node component:
   - Receives `data` prop typed as `{ label: string; oneLiner: string; status: UnlockStatus }`.
   - Renders: a rounded box (using CSS module styles) with the node title and one-liner text.
   - For this ticket, all nodes use the `locked` visual style (gray border, secondary text). T-011 adds state-dependent visuals.
   - Uses CSS custom properties from `tokens.css` for all visual properties (colours, spacing, border radius, font sizes).
   - Includes a React Flow `<Handle>` at top (target) and bottom (source) for edge connections. Handle type: `type="target"` on top, `type="source"` on bottom. Handles should be visually subtle (small, matching the border colour).
   - Export: `export default function ArborNode(props: NodeProps<ArborNodeData>)` (where `NodeProps` is from `@xyflow/react`).
   - Also export the data type: `export interface ArborNodeData { label: string; oneLiner: string; status: UnlockStatus }`.

3. **Create `src/graph/arbor-node.module.css`** — styles for the node component. All colours via `var(--color-xxx)`, all spacing via `var(--spacing-xxx)`, all typography via `var(--typography-xxx)`. No hardcoded values. The node should have:
   - `width` from `var(--node-width)`
   - `min-height` from `var(--node-min-height)`
   - `border-radius` from `var(--node-border-radius)`
   - `border` using `var(--node-border-width)` and `var(--color-locked)` (default state for T-010)
   - Background: `var(--color-surface)`
   - Padding: `var(--spacing-sm)` vertical, `var(--spacing-md)` horizontal (or similar token-based values)
   - Title text: `var(--typography-font-size-sm)` or `var(--typography-font-size-base)`, `var(--color-text-secondary)` (locked default)
   - One-liner text: `var(--typography-font-size-xs)`, `var(--color-text-dim)`
   - Overflow: hidden / ellipsis for long text

4. **Create `src/graph/graph-view.tsx`** — the main graph view component:
   - Uses `useGraphLoader(treeId)` to load data on mount.
   - Reads `nodes`, `edges`, `unlockStatuses` from the graph store.
   - On data load, runs `ElkLayoutEngine.layout()` to compute positions, then maps the results to React Flow nodes (with `position: { x, y }` and `data: { label, oneLiner, status }` where status comes from `unlockStatuses`).
   - Renders `<ReactFlow>` with:
     - `nodeTypes={{ arbor: ArborNode }}` — register the custom node type
     - All nodes use `type: 'arbor'`
     - Edges: map `GraphEdge[]` to React Flow edges with `type: 'smoothstep'`, `style: { stroke: var(--graph-edge-color) }` (use the token value from `contracts/tokens.ts` for the inline style, since React Flow edge styles are JS objects)
     - `fitView` enabled
     - `minZoom={0.1}` `maxZoom={2}`
     - `nodesDraggable={false}` (layout is authoritative)
     - `nodesConnectable={false}` (no user-created edges)
     - `proOptions={{ hideAttribution: true }}`
   - Import React Flow's required CSS: `import '@xyflow/react/dist/style.css'`
   - Layout computation should run in a `useEffect` or `useMemo` that depends on the store's `nodes` and `edges`. Store the laid-out React Flow nodes/edges in component state (`useState`).
   - Show a simple loading indicator while `useGraphLoader` reports `loading: true`.
   - Export: `export default function GraphView({ treeId }: { treeId?: string })`.

5. **Create `src/graph/graph-view.module.css`** — styles for the graph view container. The container must fill its parent (`width: 100%; height: 100%`). Background: `var(--color-base)`. No hardcoded colours.

6. **Modify `tsconfig.json`** — remove `"tests/T-010"` from the `exclude` array. This allows tsc to type-check the T-010 test file.

7. **Modify `src/App.tsx`** — replace the placeholder content with `<GraphView />`. Import `GraphView` from `./graph/graph-view`. The App component should render a full-viewport container with `GraphView` inside. No `treeId` prop needed (the graph loader falls back to fixture data in non-Tauri mode). Keep the text "Arbor" somewhere visible (T-001 smoke test checks for it) — add it as a small label in the top-left corner or as a document title via `useEffect(() => { document.title = 'Arbor'; }, [])`. Remove the old inline styles.

## Acceptance criteria
- [ ] `tests/T-010/graph-render.test.tsx` passes — graph view renders without errors, fixture data loads in non-Tauri mode, nodes are present in the DOM
- [ ] `tests/T-009/token-lint.test.ts` still passes — no hardcoded colours introduced
- [ ] `MSYS_NO_PATHCONV=1 pnpm observe --route / --ticket T-010 --out .claude/session-logs/T-010-observe` produces a non-empty screenshot PNG
- [ ] `pnpm lint` exits 0

## Human checkpoint
After verifier pass, the user reviews the `pnpm observe` screenshot for layout quality. The architect adjusts ELK config in T-009's `layout-engine.ts` if needed (via a follow-up ticket). This is the primary layout risk gate for Phase 3.

## Out of scope — DO NOT
- Do not implement node state colours or glow effects — that is T-011.
- Do not implement click-to-select or summary panel — that is T-011/T-012.
- Do not add react-router or any navigation.
- Do not edit `contracts/tokens.ts`, `contracts/commands.d.ts`, or any file in `Arbor Spec/`.
- Do not edit any test file.
- Do not modify `src/graph/layout-engine.ts` or `src/state/graph-store.ts` (created by T-009).
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content. To check an installed package version use `pnpm list <pkg>`; to read a version field use the `Read` tool on `package.json` or `node_modules/<pkg>/package.json`.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
