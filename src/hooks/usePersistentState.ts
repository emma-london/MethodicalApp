import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Like useState, but backed by localStorage under `key`. `decode` turns a stored
 * string back into a value (returning undefined if it's missing/invalid, so we
 * fall back to `initial`); `encode` defaults to String, which round-trips the
 * strings, numbers and booleans we persist. Writes are best-effort — a failing
 * localStorage (private mode, quota) is ignored rather than thrown.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  decode: (raw: string) => T | undefined,
  encode: (value: T) => string = String,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        const decoded = decode(raw)
        if (decoded !== undefined) return decoded
      }
    } catch {
      // localStorage unavailable — fall back to the initial value.
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, encode(value))
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
    // `encode` is expected to be stable (default String); intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value])

  return [value, setValue]
}

/** Decode a stored integer, or undefined if it isn't one. */
export const asInt = (raw: string): number | undefined => {
  const n = Number(raw)
  return Number.isInteger(n) ? n : undefined
}
