// C7 — Design Tokens
// Mirror of: Arbor Spec/21 Contracts/C7 Design Tokens.md
// Do not edit by hand — architect updates this file when the contract changes.

// ── Theme layer ────────────────────────────────────────────────────────
// Light theme is the default. Dark theme deferred; when added, it will
// be a second object with the same shape, selected at runtime.
// Semantic token names are stable across themes.

export const lightTheme = {
  base:          '#f5f5f5',   // app background — light warm gray
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

  edge:          '#a0a0a0',   // edge stroke — medium gray on light bg
  graphBg:       '#f5f5f5',   // graph canvas — matches base
  nodeOutline:   '#333333',   // dark node outline for contrast

  progressTrack: '#d0d0d0',
  progressFill:  '#2e7d32',   // matches completed green
} as const;

export type Theme = typeof lightTheme;

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
    diameter:       80,     // px — circle diameter (fits ~3 lines of 10px text)
    borderWidth:    '2px',
    // Label placement: INSIDE the circle, centered
    labelFontSize:  '10px', // small for circle fit; readable at zoom
    labelLineHeight: 1.3,   // unitless
    labelMaxLines:  3,      // max lines before ellipsis
    // ELK layout dimensions: circle bounding box + inter-node padding.
    // Nodes are circles so ELK width = ELK height = diameter.
    elkWidth:       80,     // px — fed to ELK as node width
    elkHeight:      80,     // px — fed to ELK as node height
  },

  graph: {
    edgeColor:     lightTheme.edge,
    edgeWidth:     1.5,         // px
    edgeAnimated:  false,       // no animated dashes by default
    background:    lightTheme.graphBg,
    minimap:       false,       // off by default; enable per user pref
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
    nodeSpacing:   30,              // px — horizontal spacing within a layer
    layerSpacing:  60,              // px — vertical spacing between layers
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
    crossingMinimizationThoroughness: '30',  // higher = better but slower
  },
} as const;

export type Tokens = typeof tokens;
