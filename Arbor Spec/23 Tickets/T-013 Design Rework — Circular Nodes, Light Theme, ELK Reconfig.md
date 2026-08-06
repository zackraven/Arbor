---
id: T-013
phase: 3
depends_on: [T-010]
---

# T-013 — Design rework: circular nodes, light theme, ELK reconfig

## Goal
The graph view renders with the updated design language from the human aesthetic checkpoint: circular nodes with labels inside, light theme, top-to-bottom (basics at bottom, advanced at top), POLYLINE edges, tighter spacing, and explicit y-coordinate flip. This is a visual overhaul of T-010's output with no new features.

## System prerequisites
None beyond T-010 prerequisites (already installed).

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C7 Design Tokens]] (mirror: `contracts/tokens.ts`) — updated with semantic tokens, light theme, circular node dims, ELK config
- Skill: `.claude/skills/frontend-design/SKILL.md` — updated aesthetic constitution
- Architecture: [[20 Architecture#Repository layout]]

## Files
**Create:** none
**Modify:** `src/tokens.css`, `src/graph/layout-engine.ts`, `src/graph/arbor-node.tsx`, `src/graph/arbor-node.module.css`, `src/graph/graph-view.tsx`, `src/graph/graph-view.module.css`

## Steps

1. **Modify `src/tokens.css`** — regenerate ALL CSS custom properties from the updated `contracts/tokens.ts`. The light theme values replace the old dark theme values. Key changes:
   - `--color-base: #f5f5f5` (was `#0e0e10`)
   - `--color-surface: #ffffff` (was `#1a1a1f`)
   - `--color-surface-alt: #ebebeb` (was `#242429`)
   - `--color-border: #c0c0c0` (was `#2e2e35`)
   - `--color-text-primary: #1a1a1a` (was `#e8e6e3`)
   - `--color-text-secondary: #555555` (was `#9a9a9a`)
   - `--color-text-dim: #888888` (was `#6a6a6a`)
   - `--color-completed: #2e7d32` (was `#4caf50`)
   - `--color-unlocked: #1565c0` (was `#42a5f5`)
   - `--color-in-progress: #e65100` (was `#ffa726`)
   - `--color-locked: #9e9e9e` (was `#555555`)
   - `--color-glow-color: rgba(21, 101, 192, 0.25)` (was `rgba(66, 165, 245, 0.35)`)
   - `--color-glow-radius: 10px` (was `12px`)
   - `--color-selected-ring: #1565c0` (was `#42a5f5`)
   - `--color-hover-overlay: rgba(0, 0, 0, 0.04)` (was `rgba(255, 255, 255, 0.04)`)
   - Add new: `--color-node-outline: #333333`
   - `--graph-edge-color: #a0a0a0` (was `#3a3a42`)
   - `--graph-background: #f5f5f5` (was `#0e0e10`)
   - `--progress-ring-track-color: #d0d0d0` (was `#2e2e35`)
   - `--progress-ring-fill-color: #2e7d32` (was `#4caf50`)
   - Node dimensions change:
     - Replace `--node-width: 180px` with `--node-diameter: 80px`
     - Remove `--node-min-height: 50px`
     - Remove `--node-border-radius: 8px` (circles use `border-radius: 50%`)
     - Keep `--node-border-width: 2px`
     - Add `--node-label-font-size: 10px`
     - Add `--node-label-line-height: 1.3`

2. **Modify `src/graph/layout-engine.ts`** — update `ElkLayoutEngine` to read ELK options from `contracts/tokens.ts` and apply the y-coordinate flip:
   - Import `tokens` from `../../contracts/tokens`.
   - Replace hardcoded ELK `layoutOptions` with values from `tokens.elk`:
     ```typescript
     layoutOptions: {
       'elk.algorithm': tokens.elk.algorithm,
       'elk.direction': tokens.elk.direction,
       'elk.spacing.nodeNode': String(tokens.elk.nodeSpacing),
       'elk.layered.spacing.nodeNodeBetweenLayers': String(tokens.elk.layerSpacing),
       'elk.edgeRouting': tokens.elk.edgeRouting,
       'elk.layered.crossingMinimization.strategy': tokens.elk.crossingMinimization,
       'elk.layered.crossingMinimization.thoroughness': tokens.elk.crossingMinimizationThoroughness,
     },
     ```
   - After `elk.layout()` returns, apply y-flip if `tokens.elk.yFlip` is true:
     ```typescript
     // ELK's y increases downward. With direction: 'UP', layer order is
     // reversed but y still grows down. Flip y so root is at screen-bottom.
     const maxY = Math.max(...(result.children ?? []).map(c => (c.y ?? 0) + (c.height ?? 0)));
     const resultNodes = (result.children ?? []).map((child) => ({
       id: child.id,
       x: child.x ?? 0,
       y: tokens.elk.yFlip ? maxY - (child.y ?? 0) - (child.height ?? 0) : (child.y ?? 0),
       width: child.width ?? 0,
       height: child.height ?? 0,
     }));
     ```

3. **Modify `src/graph/arbor-node.tsx`** — convert from rounded rectangle to circle with label inside:
   - Remove the one-liner text rendering. Only display the module name (`data.label`).
   - The outer container becomes a circle: the CSS module class will handle `border-radius: 50%`.
   - The label is rendered as a `<span>` or `<div>` inside the circle, centered with flexbox, with CSS line-clamping to 3 lines.
   - Keep the React Flow `<Handle>` elements at top (target) and bottom (source).
   - The `ArborNodeData` interface keeps `oneLiner` and `status` fields (used by T-011/T-012), but `oneLiner` is NOT displayed on the node itself (summary panel shows it later).

4. **Modify `src/graph/arbor-node.module.css`** — restyle for circular nodes:
   - `.node` class:
     - `width: var(--node-diameter)` (was `var(--node-width)`)
     - `height: var(--node-diameter)` (circle, equal width/height)
     - `border-radius: 50%` (was `var(--node-border-radius)`)
     - `display: flex; align-items: center; justify-content: center`
     - `text-align: center`
     - `overflow: hidden`
     - Background: `var(--color-surface)`
     - Border: `var(--node-border-width) solid var(--color-locked)` (default; T-011 overrides per state)
     - Padding: `var(--spacing-xs)` all around (to keep text within the circle's inscribed area)
   - `.label` class (new):
     - `font-size: var(--node-label-font-size)`
     - `line-height: var(--node-label-line-height)`
     - `color: var(--color-text-secondary)` (default locked state; T-011 overrides)
     - `word-wrap: break-word`
     - `overflow: hidden`
     - `display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical`
     - `max-width: 100%`
   - Remove the old `.title` and `.oneLiner` classes if they exist.

5. **Modify `src/graph/graph-view.tsx`** — update node dimension references:
   - Change `tokens.node.width` → `tokens.node.elkWidth` (line ~29)
   - Change `tokens.node.minHeight` → `tokens.node.elkHeight` (line ~30)
   - Change edge `type: 'smoothstep'` → `type: 'straight'` (POLYLINE = straight lines)
   - Update the edge `style` to use `tokens.graph.edgeColor` (already correct, but verify)

6. **Modify `src/graph/graph-view.module.css`** — update background:
   - `background: var(--color-base)` (should already be correct, but the value behind it changed from dark to light)

## Acceptance criteria
- [ ] `tests/T-010/graph-render.test.tsx` still passes — graph renders, fixture loads, unlock statuses populated
- [ ] `tests/T-009/token-lint.test.ts` still passes — no hardcoded colours
- [ ] `pnpm lint` exits 0
- [ ] `MSYS_NO_PATHCONV=1 pnpm observe --route / --ticket T-013 --out .claude/session-logs/T-013-observe` produces a non-empty screenshot PNG

## Human checkpoint
After verifier pass, the user reviews the `pnpm observe` screenshot. This is the **repeat aesthetic checkpoint** for the eight design change requests. Expected: light background, circular nodes with labels inside, straight diagonal edges, basics at bottom / advanced at top, tight vertical layout.

## Out of scope — DO NOT
- Do not implement node state colours or glow — that is T-011 (will be amended separately to match new node shape).
- Do not implement click-to-select or summary panel — that is T-011/T-012.
- Do not add any new components or files.
- Do not modify `contracts/tokens.ts` or `contracts/commands.d.ts`.
- Do not modify any test file or any file in `Arbor Spec/`.
- Do not modify `src/state/graph-store.ts` or `src/graph/use-graph-loader.ts`.
- Do not build a dark theme or theme toggle.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content. To check an installed package version use `pnpm list <pkg>`; to read a version field use the `Read` tool on `package.json` or `node_modules/<pkg>/package.json`.
- **If anything is ambiguous: STOP. Write the question under Blocked in the state sidecar, set `status: blocked`, end the session. Never choose.**

## State sidecar
Mutable ticket state lives in `Arbor Spec/23 Tickets/state/T-013.md`.
