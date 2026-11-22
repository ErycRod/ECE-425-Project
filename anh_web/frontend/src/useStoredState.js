import { useEffect, useState } from "react";

// Like useState, but the value is kept in sessionStorage, so progress (tasks done, quick
// checks passed, the Advanced design) survives switching between levels. It's cleared when
// the browser tab is closed. If storage isn't available, it behaves like plain useState.
export default function useStoredState(key, initial) {
  const fullKey = "edgevlm:" + key;
  const [value, setValue] = useState(() => {
    try {
      const saved = window.sessionStorage.getItem(fullKey);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      // storage blocked or bad JSON: start fresh
    }
    return initial;
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(fullKey, JSON.stringify(value));
    } catch (error) {
      // storage full or blocked: keep working without saving
    }
  }, [fullKey, value]);

  return [value, setValue];
}
