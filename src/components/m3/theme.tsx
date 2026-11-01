import React, { createContext, useContext, useEffect, useState } from 'react';

export const M3_SEEDS = [
  { id: 'bliss', label: 'Bliss', hue: 32 },
  { id: 'azure', label: 'Azure', hue: 258 },
  { id: 'moss', label: 'Moss', hue: 148 },
  { id: 'violet', label: 'Violet', hue: 300 },
] as const;

export type M3Seed = typeof M3_SEEDS[number]['id'];
export type M3Mode = 'light' | 'dark';

interface M3ThemeCtx {
  seed: M3Seed;
  setSeed: (s: M3Seed) => void;
  mode: M3Mode;
  setMode: (m: M3Mode) => void;
  seeds: typeof M3_SEEDS;
}

const Ctx = createContext<M3ThemeCtx | undefined>(undefined);

export const M3ThemeProvider: React.FC<{ children: React.ReactNode; defaultSeed?: M3Seed }> = ({ children, defaultSeed = 'bliss' }) => {
  const [seed, setSeedState] = useState<M3Seed>(() => {
    try {
      const v = localStorage.getItem('m3_seed');
      if (v && M3_SEEDS.some((s) => s.id === v)) return v as M3Seed;
    } catch {}
    return defaultSeed;
  });
  const [mode, setModeState] = useState<M3Mode>('dark');

  const setSeed = (s: M3Seed) => {
    setSeedState(s);
    try { localStorage.setItem('m3_seed', s); } catch {}
  };

  const setMode = (m: M3Mode) => setModeState(m);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.m3Seed = seed;
  }, [seed]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'light') root.classList.remove('dark');
    else root.classList.add('dark');
  }, [mode]);

  return (
    <Ctx.Provider value={{ seed, setSeed, mode, setMode, seeds: M3_SEEDS }}>
      {children}
    </Ctx.Provider>
  );
};

export const useM3Theme = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useM3Theme must be used within M3ThemeProvider');
  return ctx;
};

// restore dark on unmount helper for sandboxed pages
export function useRestoreDark() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.add('dark');
    };
  }, []);
}
