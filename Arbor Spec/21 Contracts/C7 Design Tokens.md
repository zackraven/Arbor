---
tags: [spec, implementation, contracts, C7]
freeze: firm
mirrors:
  - contracts/tokens.ts
---

# C7 — Design Tokens

> **Freeze level: FIRM.** New tokens may be added by an architect without a decisions-log entry. Changing or removing an existing token requires an architect session + a dated entry in [[12 Open Questions & Decisions Log]].

## Purpose

Defines the visual design language for Arbor's frontend: colours, spacing, motion, typography, and component dimensions. Every visual property in `src/` must reference these tokens — no hardcoded colour values, font sizes, or spacing literals. The token-lint test enforces this mechanically.

## Semantic token architecture

Tokens are structured in two layers:

1. **Semantic tokens** (`tokens.color.*`, `tokens.node.*`, etc.) — named by purpose, not by value. Components reference these. Example: `--surface` means "the background of a card", not "this particular shade of gray".
2. **Theme layer** (`lightTheme`, `darkTheme`) — supplies concrete values to semantic tokens. Both themes have the same shape (`Theme` type). Dark theme is active via `data-theme="dark"` attribute or system preference.

This separation ensures a theme change is a CSS custom-property swap, not a codebase-wide colour hunt.

## Full definition

```typescript
// C7 — Design Tokens
// Mirror of: Arbor Spec/21 Contracts/C7 Design Tokens.md
// Do not edit by hand — architect updates this file when the contract changes.

// ── Theme layer ────────────────────────────────────────────────────────
// Light theme is the default. Dark theme deferred; when added, it will
// be a second object with the same shape, selected at runtime.
// Semantic token names are stable across themes.

export const lightTheme = {
  base:          '#FAFAF9',   // app background — warm off-white
  surface:       '#ffffff',   // card / panel / node fill
  surfaceAlt:    '#ebebeb',   // subtle elevation (hover, active panel)
  border:        '#c0c0c0',   // dividers and outlines
  textPrimary:   '#1a1a1a',   // primary text — near-black
  textSecondary: '#555555',   // secondary / muted text
  textDim:       '#888888',   // disabled or hint text

  // Node state accents — same across themes (brand colours)
  completed:     '#2e7d32',   // green — slightly darker for light bg
  unlocked:      '#1565c0',   // blue — deeper for light bg contrast
  inProgress:    '#e65100',   // amber/orange — darker for light bg
  locked:        '#9e9e9e',   // muted gray

  glowColor:     'rgba(21, 101, 192, 0.25)',   // unlocked blue at 25%
  glowRadius:    '10px',

  selectedRing:  '#1565c0',   // matches unlocked blue
  hoverOverlay:  'rgba(0, 0, 0, 0.04)',        // subtle hover darken on light bg

  edge:          '#a0a0a0',   // edge stroke — base colour (opacity applied separately)
  edgeHighlight: '#1565c0',   // edge stroke when connected to selected node
  edgeCompleted: '#2e7d32',   // edge stroke from completed child to parent
  edgeHalo:      '#FAFAF9',   // edge halo — matches graph background for crossing legibility
  graphBg:       '#FAFAF9',   // graph canvas — warm off-white
  nodeOutline:   '#333333',   // dark node outline for contrast

  minimapMask:   'rgba(0, 0, 0, 0.08)',   // minimap overlay — subtle darken
  shadowLight:   'rgba(0, 0, 0, 0.06)',   // card hover shadow

  progressTrack: '#d0d0d0',
  progressFill:  '#2e7d32',   // matches completed green
} as const;

export type Theme = { [K in keyof typeof lightTheme]: string };

export const darkTheme: Theme = {
  base:          '#1a1a1e',   // app background — near-black warm
  surface:       '#252529',   // card / panel / node fill
  surfaceAlt:    '#2e2e33',   // subtle elevation (hover, active panel)
  border:        '#3a3a40',   // dividers and outlines
  textPrimary:   '#e8e8e8',   // primary text — near-white
  textSecondary: '#a0a0a0',   // secondary / muted text
  textDim:       '#666666',   // disabled or hint text

  // Node state accents — brighter for dark bg
  completed:     '#4caf50',   // green — brighter for dark bg
  unlocked:      '#42a5f5',   // blue — brighter for dark bg
  inProgress:    '#ff9800',   // amber/orange — brighter for dark bg
  locked:        '#616161',   // muted gray

  glowColor:     'rgba(66, 165, 245, 0.3)',   // unlocked blue at 30%
  glowRadius:    '10px',

  selectedRing:  '#42a5f5',   // matches unlocked blue
  hoverOverlay:  'rgba(255, 255, 255, 0.06)',  // subtle hover lighten on dark bg

  edge:          '#ffffff',   // edge stroke — white for visibility on dark bg
  edgeHighlight: '#42a5f5',   // edge stroke when connected to selected node
  edgeCompleted: '#4caf50',   // edge stroke from completed child to parent
  edgeHalo:      '#1a1a1e',   // edge halo — matches dark background
  graphBg:       '#1a1a1e',   // graph canvas — dark
  nodeOutline:   '#e0e0e0',   // light node outline for contrast on dark

  minimapMask:   'rgba(0, 0, 0, 0.15)',   // minimap overlay — stronger on dark bg
  shadowLight:   'rgba(0, 0, 0, 0.2)',    // card hover shadow — deeper on dark bg

  progressTrack: '#3a3a40',
  progressFill:  '#4caf50',   // matches completed green
} as const;

export const tokens = {
  // ── Semantic colour tokens — values come from the active theme ────
  color: {
    base:          lightTheme.base,
    surface:       lightTheme.surface,
    surfaceAlt:    lightTheme.surfaceAlt,
    border:        lightTheme.border,
    textPrimary:   lightTheme.textPrimary,
    textSecondary: lightTheme.textSecondary,
    textDim:       lightTheme.textDim,

    completed:     lightTheme.completed,
    unlocked:      lightTheme.unlocked,
    inProgress:    lightTheme.inProgress,
    locked:        lightTheme.locked,

    glowColor:     lightTheme.glowColor,
    glowRadius:    lightTheme.glowRadius,

    selectedRing:  lightTheme.selectedRing,
    hoverOverlay:  lightTheme.hoverOverlay,

    nodeOutline:   lightTheme.nodeOutline,

    edgeHighlight: lightTheme.edgeHighlight,
    edgeCompleted: lightTheme.edgeCompleted,
    edgeHalo:      lightTheme.edgeHalo,

    minimapMask:   lightTheme.minimapMask,
    shadowLight:   lightTheme.shadowLight,

    focusDimOpacity: 0.12,        // opacity for nodes/edges outside focus set
  },

  spacing: {
    unit: 4,     // base unit in px; all spacing is a multiple of this
    xs:   4,     // 1 unit
    sm:   8,     // 2 units
    md:   16,    // 4 units
    lg:   24,    // 6 units
    xl:   32,    // 8 units
    xxl:  48,    // 12 units
  },

  motion: {
    durationFast:   '120ms',
    durationNormal: '200ms',
    durationSlow:   '350ms',
    durationFocus:  '200ms',     // focus dim fade in/out
    durationHover:  '150ms',     // hover scale transition
    durationEdgeHighlight: '200ms', // edge highlight fade in
    // ── Staggered rise on load ───────────────────────────────────
    riseStagger:    20,          // ms delay per layer
    riseDuration:   '400ms',     // total animation duration per node
    riseEasing:     'cubic-bezier(0.0, 0, 0.2, 1)', // decelerate
    // ── Hover ────────────────────────────────────────────────────
    hoverScale:     1.04,
    hoverEasing:    'ease-out',
    easing:         'cubic-bezier(0.4, 0, 0.2, 1)',  // material standard
  },

  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: {
      xs:   '11px',
      sm:   '13px',
      base: '14px',
      lg:   '16px',
      xl:   '20px',
      xxl:  '28px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      bold:   600,
    },
    lineHeight: {
      tight:  1.2,
      normal: 1.5,
    },
  },

  // ── Node dimensions — circular nodes ─────────────────────────────
  // Nodes are circles with the module name INSIDE the circle.
  // Text wraps to 2–3 lines; overflow is ellipsis-truncated.
  // Diameter must be large enough for readable text at small font size.
  node: {
    diameter:       65,     // px — circle diameter (fits ~3 lines of 9px text)
    borderWidth:    '1.5px',
    borderWidthNum: 1.5,    // numeric for SVG stroke calculations
    // Label placement: INSIDE the circle, centered
    labelFontSize:  '9px',  // readable inside circle
    labelLineHeight: 1.2,   // unitless — tight for circles
    labelMaxLines:  3,      // max lines before ellipsis
    // ELK layout dimensions: circle bounding box + inter-node padding.
    // Nodes are circles so ELK width = ELK height = diameter.
    elkWidth:       65,     // px — fed to ELK as node width
    elkHeight:      65,     // px — fed to ELK as node height
    // ── Progress arc (completed status) ─────────────────────────
    progressArcWidth: 2.5,  // px — stroke width for completion ring
    progressArcGap:   3,    // px — gap between node border and progress arc
    // ── Glow rings (unlocked status) ────────────────────────────
    glowRingInnerSize:    4,    // px beyond circle radius
    glowRingOuterSize:    10,   // px beyond circle radius
    glowRingInnerOpacity: 0.2,
    glowRingOuterOpacity: 0.08,
    glowRingWidth:        1.5,  // px — stroke width of glow rings
    // ── Pulse animation (unlocked status) ───────────────────────
    pulseDuration:    '3s',
    pulseMinOpacity:  0.4,
    pulseMaxOpacity:  0.7,
  },

  graph: {
    edgeColor:     lightTheme.edge,
    // ── Edge width taper — trunk-to-crown metaphor ───────────────
    edgeWidthBase:   2,        // px — thick at base (root) layer
    edgeWidthCrown:  0.75,     // px — thin at crown (top) layer
    edgeHighlightWidth: 2.5,   // px — thicker for selected-node edges
    edgeHaloExtra: 3,          // px — extra width on each side for halo stroke
    // ── Edge opacity by node state ───────────────────────────────
    edgeOpacityCompleted: 0.6, // edges between completed nodes — high
    edgeOpacityDefault:   0.4, // edges at the frontier
    edgeOpacityLocked:    0.2, // edges into locked territory — dim
    edgeAnimated:  false,      // no animated dashes by default
    background:    lightTheme.graphBg,
    // ── Dot grid — grounds the canvas without competing ────────
    dotGridSpacing: 24,        // px — gap between dots
    dotGridOpacity: 0.04,      // ~4% — subtle
    dotGridSize:    1,         // px — dot radius
    dotGridColor:   '#000000', // black at 4% opacity = very faint
    minimap:       false,      // off by default; enable per user pref
  },

  progressRing: {
    size:         40,    // px diameter
    strokeWidth:  3,     // px
    trackColor:   lightTheme.progressTrack,
    fillColor:    lightTheme.progressFill,
  },

  // ── ELK layout configuration ─────────────────────────────────────
  // Authoritative ELK options — layout-engine.ts reads these directly.
  // See decisions log: edge-routing-hybrid-2026-08-06,
  //                    coordinate-transform-2026-08-06.
  elk: {
    algorithm:     'layered',
    direction:     'UP',            // root at bottom, leaves at top
    // The adapter MUST flip y-coordinates after layout:
    //   y_reactflow = maxY - y_elk
    // ELK's y increases downward in its own space. direction: 'UP'
    // reverses layer ORDER (root is last layer), but y still increases
    // downward. React Flow's canvas also has y increasing downward,
    // but fitView + user expectation = "root at bottom, leaves at top"
    // requires the flip. Without it, 'UP' renders inverted.
    yFlip:         true,            // adapter must apply y-flip
    nodeSpacing:   10,              // px — very tight horizontal packing
    layerSpacing:  100,             // px — generous vertical spacing for clear layer separation
    // ── Edge routing ───────────────────────────────────────────────
    // Hybrid approach (decision: edge-routing-hybrid-2026-08-06):
    //   Adjacent-layer edges: POLYLINE (straight diagonal lines)
    //   Long-span edges (>1 layer): ORTHOGONAL (routed around nodes)
    // ELK does not natively support per-edge routing. We use POLYLINE
    // globally and accept that long edges may cross nodes. The layered
    // algorithm's crossing minimisation mitigates this. SPLINES was
    // rejected because it adds curves to adjacent-layer edges.
    edgeRouting:   'POLYLINE',
    // ── Crossing minimisation ──────────────────────────────────────
    crossingMinimization: 'LAYER_SWEEP',
    crossingMinimizationThoroughness: '100', // high = fewest crossings
    nodePlacement: 'NETWORK_SIMPLEX',        // minimises edge length → compact, centred
    compaction:    'EDGE_LENGTH',            // post-compaction squeezes horizontal spread
    separateConnectedComponents: false,      // lay out as single graph, not separate clusters
    highDegreeNodeTreatment:     true,       // centres high-connectivity nodes (e.g. Newton's Laws)
  },
} as const;

export type Tokens = typeof tokens;
```

## State-to-visual mapping

| `UnlockStatus` | Node fill | Outline color | Glow | Label color |
|---|---|---|---|---|
| `completed` | `surface` | `completed` (#2e7d32) | none | `textPrimary` |
| `unlocked` | `surface` | `unlocked` (#1565c0) | `glowColor` at `glowRadius` | `textPrimary` |
| `in_progress` | `surface` | `inProgress` (#e65100) | none | `textPrimary` |
| `locked` | `surface` | `locked` (#9e9e9e) | none | `textSecondary` |

## Edge rendering

Edges are rendered as custom components (`ArborEdge`) with four visual behaviours:

**1. Width taper (trunk-to-crown).** Edge width interpolates from `edgeWidthBase` (2px) at the root layer to `edgeWidthCrown` (0.75px) at the top layer, based on the average layer fraction of the source and target nodes. This reinforces the trunk-to-treetop metaphor.

**2. No arrowheads.** Direction is carried by the vertical axis. No marker-end or marker-start on any edge.

**3. Halo for crossing legibility.** Each edge is rendered twice: a wider stroke in `edgeHalo` (the graph background colour) at `edgeWidth + edgeHaloExtra * 2`, followed by the coloured stroke on top. Crossings read as over/under instead of collapsing. The halo colour comes from the theme layer (it tracks the graph background).

**4. Opacity hierarchy by node state.** Edges leading into locked territory render at `edgeOpacityLocked` (0.2); edges between completed nodes render at `edgeOpacityCompleted` (0.6); edges at the frontier render at `edgeOpacityDefault` (0.4). The eye finds the live frontier unaided. Selection-highlighted edges render at full opacity.

**Selection highlighting.** When a node is selected, all edges directly connecting it to its parents and children are highlighted:
- Stroke colour: `edgeHighlight` (#1565c0)
- Stroke width: `edgeHighlightWidth` (2.5px — overrides taper)
- Opacity: 1.0 (overrides state hierarchy)

**Completion colouring.** When a node has status `completed`, edges FROM its children TO it are coloured:
- Stroke colour: `edgeCompleted` (#2e7d32)
- Selection highlighting takes priority over completion colouring when both apply

## Node rendering

Nodes are **circles** with the module name label rendered **inside** the circle. Text is small (9px), wraps to up to 3 lines, and truncates with ellipsis if it overflows.

- **Circle:** `node.diameter` (65px), filled with `surface`, outlined with the status colour at `node.borderWidth` (1.5px).
- **Label:** centered inside the circle, `node.labelFontSize` (9px), up to `node.labelMaxLines` (3) lines. CSS `word-wrap: break-word; text-align: center; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical`.
- **ELK dimensions:** `node.elkWidth` × `node.elkHeight` (65 × 65px) — matches the circle diameter. Inter-node spacing in ELK options provides visual clearance.
- **Description** (one-liner) appears on hover/click in a tooltip or summary panel, NOT on the node itself.

## ELK layout configuration

The `tokens.elk` section is authoritative. `layout-engine.ts` reads these values directly — no additional ELK options are set outside this contract.

Key decisions:
- **Direction: UP** with **y-flip in the adapter** — see [[12 Open Questions & Decisions Log#coordinate-transform-2026-08-06]].
- **Edge routing: POLYLINE** (hybrid intent) — see [[12 Open Questions & Decisions Log#edge-routing-hybrid-2026-08-06]].
- **Crossing minimisation: LAYER_SWEEP** with thoroughness 100.
- **Spacing:** 10px within-layer, 100px between-layer.

## Token usage invariant

**No hardcoded colour, font-size, or spacing values in `src/`**. All visual properties must reference:
- CSS custom properties set from tokens (e.g. `var(--color-base)`)
- The `tokens` object imported from `contracts/tokens.ts`

The token-lint test (`tests/T-009/token-lint.test.ts`) scans all `.ts`, `.tsx`, `.css`, and `.module.css` files under `src/` and fails if any literal hex colour (`#xxx`, `#xxxxxx`, `#xxxxxxxx`), `rgb()`/`rgba()`, or `hsl()` value is found outside of `tokens.css` (which is the generated CSS custom-properties file).

**Exceptions** (not flagged by lint):
- `src/tokens.css` — the single file that maps token values to CSS custom properties
- `0` and `none` (not colours)
- `transparent`, `currentColor`, `inherit` (CSS keywords)

## Changelog

| Date       | Change                              | Decisions-log ref                          |
|------------|-------------------------------------|--------------------------------------------|
| 2026-08-06 | Initial token set for Phase 3       | [[12 Open Questions & Decisions Log#phase3-design-tokens-2026-08-06]] |
| 2026-08-06 | Semantic token restructure: theme layer, light default, circular nodes, label-below, ELK config, y-flip | [[12 Open Questions & Decisions Log#semantic-token-restructure-2026-08-06]], [[12 Open Questions & Decisions Log#edge-routing-hybrid-2026-08-06]], [[12 Open Questions & Decisions Log#coordinate-transform-2026-08-06]] |
| 2026-08-07 | Edge highlighting: selection + completion colouring tokens, edge highlighting spec section | [[12 Open Questions & Decisions Log#edge-highlighting-2026-08-07]] |
| 2026-08-07 | Layout iteration: 65px nodes, 9px text, 1.5px border, bezier edges, NETWORK_SIMPLEX, tighter spacing, high-degree treatment | (aesthetic iteration, no contract change) |
| 2026-08-07 | Edge craft: width taper, halo, opacity hierarchy, no arrowheads, custom ArborEdge component | (aesthetic iteration) |
| 2026-08-08 | Full note ↔ mirror sync: darkTheme, focusDimOpacity, motion tokens (durationFocus/Hover/EdgeHighlight, rise*, hover*), node SVG tokens (borderWidthNum, progressArc*, glowRing*, pulse*), dotGrid tokens, minimapMask, shadowLight; fixed stale prose (65px/9px/10+100 spacing/thoroughness 100) | [[12 Open Questions & Decisions Log#phase3-out-of-band-2026-08-08]] |
