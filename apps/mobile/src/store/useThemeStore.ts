import { Appearance } from "react-native";
import { create } from "zustand";
import { colorSchemes } from "@dentsocia/ui-tokens";

type Scheme = "light" | "dark";

function resolveScheme(value: string | null | undefined): Scheme {
  return value === "light" ? "light" : "dark";
}

interface ThemeState {
  scheme: Scheme;
}

export const useThemeStore = create<ThemeState>(() => ({
  scheme: resolveScheme(Appearance.getColorScheme()),
}));

Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.setState({ scheme: resolveScheme(colorScheme) });
});

export function useTheme() {
  const scheme = useThemeStore((state) => state.scheme);
  return { scheme, colors: colorSchemes[scheme] };
}
