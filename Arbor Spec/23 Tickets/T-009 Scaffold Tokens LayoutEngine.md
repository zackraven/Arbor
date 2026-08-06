---
id: T-009
phase: 3
status: done
depends_on: [T-006]
---

# T-009 — Scaffold design tokens, layout engine adapter, and graph store

## Goal
Design-token CSS custom properties, typed Tauri command wrappers, a zustand graph store, and an ELK layout adapter exist and pass unit tests. No visual output — this ticket wires infrastructure for T-010+.

## System prerequisites
The user must install these before dispatching:
- `pnpm add @xyflow/react elkjs zustand`
- `pnpm add -D happy-dom`

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C7 Design Tokens]] (mirror: `contracts/tokens.ts`)
- Contract: [[21 Contracts/C3 Tauri Commands]] (mirror: `contracts/commands.d.ts`)
- Skill: `.claude/skills/frontend-design/SKILL.md`
- Architecture: [[20 Architecture#Repository layout]], [[20 Architecture#Naming conventions]], [[20 Architecture#Module boundaries]]

## Files
**Create:** `src/tokens.css`, `src/vite-env.d.ts`, `src/graph/layout-engine.ts`, `src/state/graph-store.ts`, `src/api/tauri-commands.ts`
**Modify:** `src/main.tsx` (import `tokens.css`), `src/App.tsx` (remove hardcoded `backgroundColor: '#111'` — the body reset in `tokens.css` handles this now), `vitest.config.ts` (add happy-dom environment for graph tests), `tsconfig.json` (remove `tests/T-009` from the `exclude` array)

## Steps

1. **Create `src/tokens.css`** — generate CSS custom properties from the C7 contract. Map every token to a `--`-prefixed custom property on `:root`. The file must contain ALL token values from `contracts/tokens.ts` as CSS custom properties. Naming convention: flatten the token path with hyphens. Examples:
   - `tokens.color.base` → `--color-base: #0e0e10;`
   - `tokens.color.completed` → `--color-completed: #4caf50;`
   - `tokens.color.glowColor` → `--color-glow-color: rgba(66, 165, 245, 0.35);`
   - `tokens.color.glowRadius` → `--color-glow-radius: 12px;`
   - `tokens.spacing.unit` → `--spacing-unit: 4px;`
   - `tokens.spacing.xs` → `--spacing-xs: 4px;`
   - `tokens.motion.durationFast` → `--motion-duration-fast: 120ms;`
   - `tokens.motion.easing` → `--motion-easing: cubic-bezier(0.4, 0, 0.2, 1);`
   - `tokens.typography.fontFamily` → `--typography-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;`
   - `tokens.typography.fontSize.base` → `--typography-font-size-base: 14px;`
   - `tokens.typography.fontWeight.normal` → `--typography-font-weight-normal: 400;`
   - `tokens.typography.lineHeight.normal` → `--typography-line-height-normal: 1.5;`
   - `tokens.node.width` → `--node-width: 180px;`
   - `tokens.node.borderRadius` → `--node-border-radius: 8px;`
   - `tokens.graph.edgeColor` → `--graph-edge-color: #3a3a42;`
   - `tokens.graph.edgeWidth` → `--graph-edge-width: 1.5px;`
   - `tokens.progressRing.size` → `--progress-ring-size: 40px;`
   - `tokens.progressRing.strokeWidth` → `--progress-ring-stroke-width: 3px;`
   - `tokens.progressRing.trackColor` → `--progress-ring-track-color: #2e2e35;`
   - `tokens.progressRing.fillColor` → `--progress-ring-fill-color: #4caf50;`

   For numeric values that represent pixel measurements (`spacing.*`, `node.width`, `node.minHeight`, `graph.edgeWidth`, `progressRing.size`, `progressRing.strokeWidth`), append `px`. For values that are already strings with units (e.g. `'12px'`, `'120ms'`), use them verbatim. For plain numbers that are not pixel measurements (`typography.fontWeight.*`, `typography.lineHeight.*`), use them as raw numbers (no unit). For boolean values (`graph.edgeAnimated`, `graph.minimap`), omit them from CSS — they are only consumed in TypeScript.

   Also add a body reset at the end (after the `:root` block):
   ```css
   body {
     margin: 0;
     background-color: var(--color-base);
     color: var(--color-text-primary);
     font-family: var(--typography-font-family);
     font-size: var(--typography-font-size-base);
     line-height: var(--typography-line-height-normal);
     -webkit-font-smoothing: antialiased;
     -moz-osx-font-smoothing: grayscale;
   }
   ```

2. **Create `src/vite-env.d.ts`** — a single line: `/// <reference types="vite/client" />`. This provides ambient type declarations for CSS imports, JSON imports, and other Vite-handled asset types. Standard Vite convention.

3. **Modify `src/main.tsx`** — add `import './tokens.css';` as the first import (before React imports), so the CSS custom properties are available globally.

4. **Create `src/graph/layout-engine.ts`** — define the `LayoutEngine` interface and `ElkLayoutEngine` implementation:

   ```typescript
   // Types for layout input/output
   export interface LayoutNode {
     id: string;
     width: number;
     height: number;
   }

   export interface LayoutEdge {
     id: string;
     source: string;
     target: string;
   }

   export interface LayoutResult {
     nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
     edges: Array<{ id: string }>;
   }

   // Adapter interface — swap layout algorithm without touching graph-view
   export interface LayoutEngine {
     layout(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<LayoutResult>;
   }
   ```

   `ElkLayoutEngine` class implements `LayoutEngine`:
   - Constructor takes no arguments.
   - `layout()` method: creates an ELK graph from the input nodes/edges, runs `elk.layout()`, and maps the resulting positions back to `LayoutResult`.
   - ELK configuration (set as `layoutOptions` on the root graph):
     - `'elk.algorithm': 'layered'`
     - `'elk.direction': 'UP'`
     - `'elk.spacing.nodeNode': '40'`
     - `'elk.layered.spacing.nodeNodeBetweenLayers': '80'`
     - `'elk.edgeRouting': 'SPLINES'`
     - `'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP'`
   - Import ELK as: `import ELK from 'elkjs/lib/elk.bundled.js';`
   - ELK is instantiated once in the constructor: `this.elk = new ELK();`
   - The ELK graph maps edges using `sources` and `targets` arrays (ELK's API), NOT `source`/`target` strings.

5. **Create `src/state/graph-store.ts`** — zustand store for graph state:

   ```typescript
   import { create } from 'zustand';
   import type { GraphNode, GraphEdge, UnlockStatus } from '../../contracts/commands';

   interface GraphState {
     nodes: GraphNode[];
     edges: GraphEdge[];
     unlockStatuses: Record<string, UnlockStatus>;
     selectedNodeId: string | null;
     treeId: string | null;

     setGraph: (treeId: string, nodes: GraphNode[], edges: GraphEdge[]) => void;
     setUnlockStatuses: (statuses: Record<string, UnlockStatus>) => void;
     selectNode: (id: string | null) => void;
     clear: () => void;
   }

   export const useGraphStore = create<GraphState>((set) => ({
     nodes: [],
     edges: [],
     unlockStatuses: {},
     selectedNodeId: null,
     treeId: null,

     setGraph: (treeId, nodes, edges) => set({ treeId, nodes, edges }),
     setUnlockStatuses: (unlockStatuses) => set({ unlockStatuses }),
     selectNode: (selectedNodeId) => set({ selectedNodeId }),
     clear: () => set({ nodes: [], edges: [], unlockStatuses: {}, selectedNodeId: null, treeId: null }),
   }));
   ```

6. **Create `src/api/tauri-commands.ts`** — typed async wrappers over Tauri's `invoke()`. Each function calls `invoke()` from `@tauri-apps/api/core` with the correct command name and parameter object. Functions to implement:
   - `listTrees(): Promise<TreeSummary[]>`
   - `getTree(treeId: string): Promise<Tree>`
   - `getGraph(treeId: string): Promise<Graph>`
   - `getNode(nodeId: string): Promise<NodeDetail>`
   - `computeUnlock(treeId: string): Promise<Record<string, UnlockStatus>>`
   - `getGraphLog(treeId: string, limit?: number): Promise<GraphLogEntry[]>`
   - `seedGraph(tree: SeedTree): Promise<void>`
   - `updateNodeStatus(nodeId: string, status: 'not_started' | 'in_progress' | 'completed'): Promise<void>`

   Import types from `../../contracts/commands`. Import `invoke` from `@tauri-apps/api/core`. Use C3's exact parameter names in the invoke calls (e.g. `invoke('get_graph', { treeId })` — Tauri uses camelCase in JS, snake_case in Rust; the `#[tauri::command]` macro handles the conversion. Pass params as `{ treeId }` not `{ tree_id }`).

7. **Modify `tsconfig.json`** — remove `"tests/T-009"` from the `exclude` array. This allows tsc to type-check the T-009 test files. (The architect pre-committed test files for T-009–T-012 and excluded them from tsc until each ticket's modules are created.)

8. **Modify `vitest.config.ts`** — two changes:
   - Change `environment: 'node'` to `environment: 'happy-dom'` so DOM-dependent tests (React component tests in T-010+) work. This is safe for existing node-only tests (happy-dom provides a superset of the node environment for test purposes).
   - Change `include: ['tests/**/*.test.ts']` to `include: ['tests/**/*.test.{ts,tsx}']` so JSX test files (`.test.tsx`) are picked up by vitest. Future tickets (T-010+) use `.test.tsx` for component tests.

9. **Delete `src/graph/.gitkeep` and `src/state/.gitkeep`** — these placeholder files are replaced by real modules. Remove them if they exist (the `.gitkeep` files were created in T-001 to hold the empty directories in git).

## Acceptance criteria
- [ ] `tests/T-009/layout-engine.test.ts` passes — ELK produces valid coordinates for a 5-node graph; all positions are finite numbers; no nodes overlap at the same coordinates
- [ ] `tests/T-009/graph-store.test.ts` passes — store state transitions: setGraph populates nodes/edges, selectNode updates selectedNodeId, clear resets to initial state
- [ ] `tests/T-009/token-lint.test.ts` passes — no hardcoded colour values (`#xxx`, `#xxxxxx`, `rgb()`, `rgba()`, `hsl()`) in any `.ts`, `.tsx`, `.css`, or `.module.css` file under `src/`, excluding `src/tokens.css`
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not create any React components (no `.tsx` files in `src/graph/`). Graph view rendering is T-010.
- Do not add `react-router`, any animation library, or any dependency not listed in System prerequisites.
- Do not edit `contracts/tokens.ts` or `contracts/commands.d.ts`.
- Do not edit files under `Arbor Spec/` or `.claude/`.
- Do not write CSS beyond `src/tokens.css` (no component stylesheets).
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content. To check an installed package version use `pnpm list <pkg>`; to read a version field use the `Read` tool on `package.json` or `node_modules/<pkg>/package.json`.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked
Resolved: architect added `src/vite-env.d.ts` to Files → Create and added Step 2.

Resolved: architect added `src/App.tsx` to Files → Modify — remove the hardcoded `backgroundColor: '#111'` since the body reset in `tokens.css` handles it.

## Implementation notes

**Files created:**
- `src/tokens.css` — already existed and was correct; all C7 design tokens mapped to CSS custom properties on `:root`, plus a body reset block.
- `src/vite-env.d.ts` — single line `/// <reference types="vite/client" />` for ambient CSS import types.
- `src/graph/layout-engine.ts` — `LayoutEngine` interface, `LayoutNode`/`LayoutEdge`/`LayoutResult` types, and `ElkLayoutEngine` class wrapping `elkjs/lib/elk.bundled.js` with the specified ELK layout options (`layered`, `UP`, spline routing, layer sweep crossing minimisation).
- `src/state/graph-store.ts` — zustand `useGraphStore` with `nodes`, `edges`, `unlockStatuses`, `selectedNodeId`, `treeId` state and `setGraph`, `setUnlockStatuses`, `selectNode`, `clear` actions.
- `src/api/tauri-commands.ts` — typed async wrappers over `invoke()` for all eight C3 commands.

**Files modified:**
- `src/main.tsx` — `import './tokens.css';` added as the first import.
- `src/App.tsx` — removed hardcoded `backgroundColor: '#111'` inline style; body background is now handled by the CSS reset in `tokens.css`.
- `tsconfig.json` — removed `"tests/T-009"` from the `exclude` array.
- `vitest.config.ts` — changed `environment` to `'happy-dom'` and `include` pattern to `'tests/**/*.test.{ts,tsx}'`.

**Files deleted:**
- `src/graph/.gitkeep` and `src/state/.gitkeep` — placeholder files removed now that real modules occupy those directories.

**Nits not acted on:** none.

## Verification
Verification: pass — 2026-08-06
- Integrity check: no protected paths in diff
- 12/12 tests pass (layout-engine, graph-store, token-lint)
- `pnpm lint` exits 0
- Note: verifier flagged `@testing-library/react` in package.json as out-of-scope, but this is a false positive — the dependency was pre-installed by the user before session start (git status showed `M package.json` at conversation start). Implementer did not add it.
