import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PhosphorTheme, THEME_ACCENTS, palette } from './tokens';

const STORAGE_KEY = 'digi2fm.theme.v1';

type Accent = { base: string; soft: string; glow: string; label: string };

interface ThemeContextType {
  theme: PhosphorTheme;
  accent: Accent;
  palette: typeof palette;
  setTheme: (next: PhosphorTheme) => void;
}

const initialAccent = THEME_ACCENTS.cyan;

const ThemeContext = createContext<ThemeContextType>({
  theme: 'cyan',
  accent: initialAccent,
  palette,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<PhosphorTheme>('cyan');

  // Restore persisted theme on mount (best-effort; we don't block render on it).
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (cancelled) return;
        if (val && val in THEME_ACCENTS) {
          setThemeState(val as PhosphorTheme);
        }
      })
      .catch(() => { /* ignore — keep default */ });
    return () => { cancelled = true; };
  }, []);

  const setTheme = useCallback((next: PhosphorTheme) => {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({ theme, accent: THEME_ACCENTS[theme], palette, setTheme }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
