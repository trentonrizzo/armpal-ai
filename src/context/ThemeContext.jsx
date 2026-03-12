import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

const THEME_KEY = "armpal_theme";   // accent: "red" | "blue" | "purple" | "green"
const MODE_KEY = "armpal_mode";     // "dark" | "light"

export function ThemeProvider({ children }) {
  // Default to dark + red; per-account overrides are applied from profile in App.
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("red");

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-accent", accent);
    if (document.body) document.body.setAttribute("data-theme", theme);

    localStorage.setItem(MODE_KEY, theme);
    localStorage.setItem(THEME_KEY, accent);
  }, [theme, accent]);

  const value = useMemo(() => ({
    theme,
    accent,
    setTheme,
    setAccent,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  }), [theme, accent]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
