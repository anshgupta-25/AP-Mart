import { useEffect, useState } from "react";
import {
  invalidateStorageUrl,
  isStorageRef,
  normalizeImageValue,
  peekStorageUrl,
  resolveStorageUrl,
} from "@/lib/storage";

/**
 * Resolve a stored image value (storage:// reference, old-project Supabase URL or plain URL)
 * to a displayable URL. Plain URLs are returned synchronously; references are signed lazily
 * and cached. `retry()` forces a fresh signature (e.g. an expired URL failed to load).
 * `failed` is true once signing definitively failed (object missing / not permitted).
 */
export function useStorageUrl(raw: string | null | undefined) {
  const value = normalizeImageValue(raw);
  const [url, setUrl] = useState<string | null>(() => peekStorageUrl(value));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    if (!value) {
      setUrl(null);
      return;
    }
    if (!isStorageRef(value)) {
      setUrl(value);
      return;
    }
    let alive = true;
    const cached = attempt === 0 ? peekStorageUrl(value) : null;
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(null);
    resolveStorageUrl(value, { force: attempt > 0 }).then((u) => {
      if (!alive) return;
      setUrl(u);
      setFailed(!u);
    });
    return () => {
      alive = false;
    };
  }, [value, attempt]);

  const retry = () => {
    invalidateStorageUrl(value);
    setAttempt((n) => n + 1);
  };
  return { url, retry, failed, isRef: isStorageRef(value) };
}
