import Svg, { Path } from "react-native-svg";
import { iconStrokeWidth } from "@dentsocia/ui-tokens";
import type { CustomIconProps } from "./LockIcon";

// Custom document icon (spec §8) — used in the KYC dropzone ("diploma/uzmanlık
// belgeni yükle") and anywhere a generic file/upload glyph is needed.
export function DocumentIcon({ size = 20, color = "currentColor", strokeWidth = iconStrokeWidth }: CustomIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M14 3.5V7a1 1 0 0 0 1 1h3.3" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9 13h6M9 16.5h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
