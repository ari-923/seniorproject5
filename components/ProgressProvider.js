"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ProgressContext = createContext(null);
const STORAGE_KEY = "splus_course_progress_v3";

export function ProgressProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [mastered, setMastered] = useState(new Set());
  const [bestScore, setBestScoreState] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setMastered(new Set(saved.mastered || []));
      setBestScoreState(Number.isFinite(saved.bestScore) ? saved.bestScore : null);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mastered: [...mastered], bestScore }));
  }, [mastered, bestScore, ready]);

  const api = useMemo(() => ({
    ready,
    mastered,
    bestScore,
    isMastered: (key) => mastered.has(key),
    setMastered: (key, value = true) => setMastered((current) => {
      const next = new Set(current);
      value ? next.add(key) : next.delete(key);
      return next;
    }),
    setBestScore: (score) => setBestScoreState((current) => current == null ? score : Math.max(current, score)),
    resetProgress: () => { setMastered(new Set()); setBestScoreState(null); },
  }), [ready, mastered, bestScore]);

  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useProgress must be used inside ProgressProvider");
  return value;
}
