import { createContext, useContext } from "react";

export const ThemeCtx = createContext<{ isDark: boolean }>({ isDark: true });
export function useTheme() {
  return useContext(ThemeCtx);
}
