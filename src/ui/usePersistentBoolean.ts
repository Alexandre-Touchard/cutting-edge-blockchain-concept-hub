// A boolean UI preference remembered in the browser (localStorage).
// Falls back to the default when storage is unavailable (private mode, SSR, tests).
import { useCallback, useState } from 'react';

export function readBooleanPreference(key: string, fallback: boolean): boolean {
  try {
    const v = (globalThis as { localStorage?: Storage }).localStorage?.getItem(key);
    return v === 'true' ? true : v === 'false' ? false : fallback;
  } catch {
    return fallback;
  }
}

export function writeBooleanPreference(key: string, value: boolean) {
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.setItem(key, String(value));
  } catch {
    /* storage unavailable: the preference just lasts for this visit */
  }
}

/** Like `useState<boolean>`, but the value survives reloads. Returns [value, set, toggle]. */
export function usePersistentBoolean(key: string, fallback: boolean): [boolean, (v: boolean) => void, () => void] {
  const [value, setValue] = useState(() => readBooleanPreference(key, fallback));
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      writeBooleanPreference(key, v);
    },
    [key]
  );
  const toggle = useCallback(() => {
    setValue((prev) => {
      writeBooleanPreference(key, !prev);
      return !prev;
    });
  }, [key]);
  return [value, set, toggle];
}
