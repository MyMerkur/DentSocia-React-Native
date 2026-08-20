interface ElevationLevel {
  ios: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
  };
  android: { elevation: number };
}

export const elevation = {
  low: {
    ios: { shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.24, shadowRadius: 4 },
    android: { elevation: 2 },
  },
  medium: {
    ios: { shadowColor: "#000000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 16 },
    android: { elevation: 8 },
  },
  high: {
    ios: { shadowColor: "#000000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 28 },
    android: { elevation: 16 },
  },
  // Gold-tint glow, reserved for the primary CTA button (spec §4) — not a depth cue,
  // a brand-color accent shadow. iOS gets the real tinted glow; Android's shadowColor
  // support is limited pre-API 28 so it falls back to a small neutral lift.
  // Kept tight (small radius/offset): a wide radius here bleeds past the CTA's own
  // bounds into the tab bar's floating-button area and reads as a muddy smear rather
  // than a halo (seen on the raised "Paylaş" button in MainTabNavigator).
  glow: {
    ios: { shadowColor: "#D8B872", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6 },
    android: { elevation: 6 },
  },
} satisfies Record<string, ElevationLevel>;

export type ElevationToken = keyof typeof elevation;
