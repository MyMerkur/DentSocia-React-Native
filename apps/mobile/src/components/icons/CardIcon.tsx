import Svg, { Path, Rect } from "react-native-svg";
import { iconStrokeWidth } from "@dentsocia/ui-tokens";
import type { CustomIconProps } from "./LockIcon";

// Custom payment-card icon (spec §8) — used in the "iyzico ile güvenli ödeme"
// trust badge on checkout screens.
export function CardIcon({ size = 14, color = "currentColor", strokeWidth = iconStrokeWidth }: CustomIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5.5} width={18} height={13} rx={2.25} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3 10h18" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M7 14.5h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
