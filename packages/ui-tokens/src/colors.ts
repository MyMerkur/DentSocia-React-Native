// Design system v2 — "Gece Laciverti & Altın" (DentSocia_Tasarim_Sistemi_ClaudeCode.md).
// Replaces the v1 palette outright (rejected by the user as "sert"/"kahverengi" —
// see PR history). Existing token *names* are kept so no consuming file needs to
// change; only hex/rgba values move to the new cool-navy + gold identity, plus a
// handful of new keys for concepts v1 didn't have (surfaceTertiary, goldStrong,
// goldBg, iceBg, photoA/B). `accentGold` maps to spec's `gold`, `accentBlue` to
// `ice`, `border`/`borderSubtle` to `hairline`, `borderStrong` to `hairlineStrong`.
//
// Health/med-UX rule (spec §1.1): red is reserved for real errors/urgency — general
// "important" emphasis uses gold instead, to avoid the clinical "alarm" association
// red carries for a physician audience.
const textOnAccent = "#171208"; // fixed dark text on gold surfaces, theme-independent

const darkColors = {
  background: "#0D1220",
  surface: "#131A2C",
  surfaceElevated: "#1A2238",
  surfaceTertiary: "#212B45",
  surfaceGlass: "rgba(160, 180, 255, 0.06)",
  overlay: "rgba(6, 9, 18, 0.72)",
  border: "rgba(160, 180, 255, 0.09)",
  borderSubtle: "rgba(160, 180, 255, 0.09)",
  borderStrong: "rgba(160, 180, 255, 0.17)",
  textPrimary: "#EDEFF5",
  textSecondary: "#9AA3BD",
  textTertiary: "#5C6580",

  accentGold: "#D8B872",
  accentGoldStrong: "#E8CB92",
  goldBg: "rgba(216, 184, 114, 0.13)",
  accentGoldHover: "#E8CB92",
  accentGoldPressed: "#C2A05F",
  accentGoldDisabled: "rgba(216, 184, 114, 0.35)",

  accentBlue: "#7FA8FF",
  iceBg: "rgba(127, 168, 255, 0.14)",
  accentBlueHover: "#9DBEFF",
  accentBluePressed: "#5C82D9",
  accentBlueDisabled: "rgba(127, 168, 255, 0.35)",

  danger: "#E27A72",
  dangerHover: "#EA9891",
  dangerPressed: "#C85950",
  success: "#6FCB9E",
  successHover: "#8AD6B2",
  successPressed: "#4FAE80",
  warning: "#F5A623",
  warningHover: "#F7B84D",
  warningPressed: "#D6900F",

  photoA: "#283350",
  photoB: "#111726",
  textOnAccent,
} as const;

const lightColors = {
  background: "#F5F6FA",
  surface: "#FFFFFF",
  surfaceElevated: "#ECEFF7",
  surfaceTertiary: "#E1E5F1",
  surfaceGlass: "rgba(20, 30, 60, 0.04)",
  overlay: "rgba(18, 24, 46, 0.45)",
  border: "rgba(20, 30, 60, 0.08)",
  borderSubtle: "rgba(20, 30, 60, 0.08)",
  borderStrong: "rgba(20, 30, 60, 0.14)",
  textPrimary: "#161B2E",
  textSecondary: "#4C5670",
  textTertiary: "#8790A8",

  accentGold: "#9C7635",
  accentGoldStrong: "#B8863E",
  goldBg: "rgba(156, 118, 53, 0.10)",
  accentGoldHover: "#B8863E",
  accentGoldPressed: "#7C5C29",
  accentGoldDisabled: "rgba(156, 118, 53, 0.35)",

  accentBlue: "#3E63D6",
  iceBg: "rgba(62, 99, 214, 0.10)",
  accentBlueHover: "#5C7EE0",
  accentBluePressed: "#2A47A8",
  accentBlueDisabled: "rgba(62, 99, 214, 0.35)",

  danger: "#C1433A",
  dangerHover: "#D06158",
  dangerPressed: "#9A342C",
  success: "#2F9E68",
  successHover: "#4CB37E",
  successPressed: "#217A4E",
  warning: "#F5A623",
  warningHover: "#F7B84D",
  warningPressed: "#D6900F",

  photoA: "#DCE1F0",
  photoB: "#C7CEE8",
  textOnAccent,
} as const;

export const colorSchemes = { dark: darkColors, light: lightColors } as const;

// Widened (non-literal) shape shared by both variants — use this, not `typeof colors`,
// to type anything that accepts either scheme's palette (e.g. useTheme()'s return value).
export type ThemeColors = { [K in keyof typeof darkColors]: string };

// Static, dark-only export kept for screens not yet on useTheme() — same shape
// either variant would produce, so switching a call site over later is a no-op
// besides the import itself. NOTE: gold/ice/success/danger now differ by theme
// (unlike v1), so any style built from this static export is dark-mode-only —
// prefer useTheme().colors for anything that should react to light mode.
export const colors = darkColors;

export const gradients = {
  goldSheen: {
    angle: 135,
    stops: [darkColors.accentGold, darkColors.accentGoldStrong, darkColors.accentGoldPressed],
  },
  glass: {
    angle: 180,
    stops: ["rgba(160, 180, 255, 0.10)", "rgba(160, 180, 255, 0.02)"],
  },
} as const;

// Tints a theme color (6-digit hex only) for tag/badge/result-card backgrounds —
// e.g. withAlpha(colors.success, 0.1) for the KYC result card fill (spec §7.14).
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
