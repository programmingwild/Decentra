"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dec:theme") as Theme | null;
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      const initial: Theme = saved || (prefersLight ? "light" : "dark");
      setTheme(initial);
      document.documentElement.classList.toggle("light", initial === "light");
      document.documentElement.classList.toggle("dark", initial === "dark");
    } catch {}
  }, []);
  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try { localStorage.setItem("dec:theme", next); } catch {}
      document.documentElement.classList.toggle("light", next === "light");
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }