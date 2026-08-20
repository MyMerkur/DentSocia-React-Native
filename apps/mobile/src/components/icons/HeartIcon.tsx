import Svg, { Path } from "react-native-svg";
import { iconStrokeWidth } from "@dentsocia/ui-tokens";
import type { CustomIconProps } from "./LockIcon";

export interface HeartIconProps extends CustomIconProps {
  filled?: boolean;
}

// Heart path copied verbatim from the design spec's HEART_SVG (§7.11/§8) — this
// exact silhouette is the approved one, not a lucide icon.
const HEART_PATH =
  "M12 21s-7.5-4.6-10-9.3C.4 8 2 4 6 4c2.2 0 3.7 1.3 4.6 2.6C11.4 5.3 12.9 4 15 4c4 0 5.6 4 4 7.7C19.5 16.4 12 21 12 21z";

export function HeartIcon({ size = 16, color = "currentColor", strokeWidth = iconStrokeWidth, filled = false }: HeartIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={HEART_PATH} fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : strokeWidth} />
    </Svg>
  );
}
