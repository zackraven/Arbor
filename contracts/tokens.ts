// C7 — Design Tokens
// Mirror of: Arbor Spec/21 Contracts/C7 Design Tokens.md
// Do not edit by hand — architect updates this file when the contract changes.

export const tokens = {
  color: {
    // ── Base palette ──────────────────────────────────────────────
    base:       '#0e0e10',   // app background
    surface:    '#1a1a1f',   // card / panel background
    surfaceAlt: '#242429',   // subtle elevation (hover, active panel)
    border:     '#2e2e35',   // dividers and outlines
    textPrimary:   '#e8e6e3',   // primary text
    textSecondary: '#9a9a9a',   // secondary / muted text
    textDim:       '#6a6a6a',   // disabled or hint text

    // ── Node states (unlock status → visual) ─────────────────────
    completed:   '#4caf50',   // green — node completed
    unlocked:    '#42a5f5',   // blue — unlocked, ready to learn
    inProgress:  '#ffa726',   // amber — currently being learned
    locked:      '#555555',   // muted gray — prerequisites not met

    // ── Glow (unlocked node emphasis) ────────────────────────────
    glowColor:   'rgba(66, 165, 245, 0.35)',   // unlocked blue at 35% opacity
    glowRadius:  '12px',                        // blur radius

    // ── Interactive ──────────────────────────────────────────────
    selectedRing:  '#42a5f5',   // selection ring matches unlocked blue
    hoverOverlay:  'rgba(255, 255, 255, 0.04)', // subtle hover lift
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

  node: {
    width:       180,   // px
    minHeight:   50,    // px
    borderRadius: '8px',
    borderWidth:  '2px',
  },

  graph: {
    edgeColor:     '#3a3a42',   // default edge stroke
    edgeWidth:     1.5,         // px
    edgeAnimated:  false,       // no animated dashes by default
    background:    '#0e0e10',   // matches base
    minimap:       false,       // off by default; enable per user pref
  },

  progressRing: {
    size:         40,    // px diameter
    strokeWidth:  3,     // px
    trackColor:   '#2e2e35',
    fillColor:    '#4caf50',   // matches completed green
  },
} as const;

export type Tokens = typeof tokens;
