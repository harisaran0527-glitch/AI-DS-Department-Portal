import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeToDOM(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;

  root.setAttribute('data-theme', mode);
  if (body) {
    body.setAttribute('data-theme', mode);
  }

  if (mode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    if (body) {
      body.classList.add('light');
      body.classList.remove('dark');
    }
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    if (body) {
      body.classList.add('dark');
      body.classList.remove('light');
    }
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('app_theme');
        if (saved === 'light' || saved === 'dark') {
          applyThemeToDOM(saved);
          return saved;
        }
      } catch {}
    }
    applyThemeToDOM('dark');
    return 'dark';
  });

  const currentThemeRef = React.useRef<ThemeMode>(theme);
  currentThemeRef.current = theme;

  // Ensure DOM is synced whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem('app_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = currentThemeRef.current === 'dark' ? 'light' : 'dark';
    currentThemeRef.current = nextTheme;
    // Synchronously apply to DOM immediately before paint
    applyThemeToDOM(nextTheme);
    try {
      localStorage.setItem('app_theme', nextTheme);
    } catch {}
    setThemeState(nextTheme);
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    currentThemeRef.current = t;
    applyThemeToDOM(t);
    try {
      localStorage.setItem('app_theme', t);
    } catch {}
    setThemeState(t);
  }, []);

  const contextValue = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme
  }), [theme, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark',
      toggleTheme: () => {},
      setTheme: () => {}
    };
  }
  return context;
};
