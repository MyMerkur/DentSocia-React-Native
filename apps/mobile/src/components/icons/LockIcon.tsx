import Svg, { Path, Rect } from "react-native-svg";
import { iconStrokeWidth } from "@dentsocia/ui-tokens";

export interface CustomIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Custom padlock (spec §8) — a recurring structural icon (LockedCard's paywall
// footer), not pulled from the generic lucide set.
export function LockIcon({ size = 16, color = "currentColor", strokeWidth = iconStrokeWidth }: CustomIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={10} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V7.5a4 4 0 0 1 8 0V11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
