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
  const [attemptUri, setAttemptUri] = useState(uri);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Reset the retry counter *during render* when the uri changes (a recycled
  // FlatList row now showing a different listing). Doing this in a post-commit
  // effect instead would let the first render for the new uri reuse the old
  // image's counter and build a cache-busted `uri?_retry=N` — firing a wasted
  // network fetch that bypasses the CDN cache before the effect corrects it.
  // Adjusting state during render is React's supported pattern for this, and
  // `currentAttempt` keeps this transitional render's source/onError at 0 too.
  const changed = uri !== attemptUri;
  if (changed) {
    setAttemptUri(uri);
    setAttempt(0);
  }
  const currentAttempt = changed ? 0 : attempt;

  // Drop any pending retry from the previous uri (and on unmount) so a late
  // timer can't bump the new image's counter after the row is recycled.
  useEffect(() => clearTimer, [uri]);

  const source =
    currentAttempt === 0
      ? { uri }
      : { uri: `${uri}${uri.includes('?') ? '&' : '?'}_retry=${currentAttempt}` };

  return (
    <Image
      {...rest}
      source={source}
      // Lets expo-image reset per-item state when the row is recycled to a new
      // uri, so a previous listing's image never lingers in this slot.
      recyclingKey={uri}
      onError={(event) => {
        if (currentAttempt < MAX_RETRIES) {
          clearTimer();
          timer.current = setTimeout(
            () => setAttempt((a) => a + 1),
            RETRY_BASE_MS * 2 ** currentAttempt,
          );
        }
        onError?.(event);
      }}
    />
  );
}
