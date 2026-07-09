import React, { useEffect, useRef, useState } from 'react';
import { Image, type ImageProps } from 'expo-image';

// A just-uploaded storage object's public URL can briefly 404 at the CDN edge
// before it propagates. expo-image attempts the load exactly once and does not
// retry on its own, so a freshly posted listing shows a blank card (just the
// imageColor placeholder) until the *next* fresh attempt happens — which is
// exactly why pull-to-refresh or opening the listing "fixes" it: both are new
// load attempts a moment later, once the object is servable.
//
// RemoteImage wraps expo-image to self-heal that window: on an error it retries
// a few times with exponential backoff. Retries are cache-busted with a throw-
// away query param so they bypass any native failed-URL cache and force a real
// network fetch; the object URL ignores the unknown param, so it still resolves
// to the same image. The first (attempt 0) load uses the clean URL so normal
// caching is untouched for the overwhelmingly common already-available case.
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 800;

type Props = Omit<ImageProps, 'source'> & { uri: string };

export default function RemoteImage({ uri, onError, ...rest }: Props) {
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Reset retry state when the uri changes (e.g. a recycled FlatList row now
  // rendering a different listing) and drop any pending retry for the old uri.
  useEffect(() => {
    setAttempt(0);
    return clearTimer;
  }, [uri]);

  const source =
    attempt === 0
      ? { uri }
      : { uri: `${uri}${uri.includes('?') ? '&' : '?'}_retry=${attempt}` };

  return (
    <Image
      {...rest}
      source={source}
      // Lets expo-image reset per-item state when the row is recycled to a new
      // uri, so a previous listing's image never lingers in this slot.
      recyclingKey={uri}
      onError={(event) => {
        if (attempt < MAX_RETRIES) {
          clearTimer();
          timer.current = setTimeout(
            () => setAttempt((a) => a + 1),
            RETRY_BASE_MS * 2 ** attempt,
          );
        }
        onError?.(event);
      }}
    />
  );
}
