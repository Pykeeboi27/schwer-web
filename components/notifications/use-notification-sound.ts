"use client";

import { useEffect, useRef } from "react";

/**
 * Plays public/notification.mp3 when a new notification arrives.
 *
 * Browsers block audio autoplay until the page has received a real user
 * gesture (click/tap/keydown). Safari is stricter than Chrome here: the
 * unlocking `.play()` call must happen synchronously inside the gesture
 * handler itself, AND it has to be called on the exact element later reused
 * for playback -- unlocking a separate element doesn't carry over. So the
 * element is created eagerly on mount (not lazily inside play()) and the
 * same shared element is primed with a play()+pause() on the first
 * pointerdown/keydown anywhere on the page.
 *
 * One case is irreducible: a notification arriving before any interaction
 * has happened anywhere on the page cannot play sound -- no client-side code
 * can override that. The toast (fires unconditionally) and the background-tab
 * title/favicon badge are the fallback signal for that window.
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/notification.mp3");
    audio.preload = "auto";
    audioRef.current = audio;

    const primeOnFirstInteraction = () => {
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {
          // Still blocked -- a real notification's own play() will be
          // attempted and logged independently below.
        });
      window.removeEventListener("pointerdown", primeOnFirstInteraction);
      window.removeEventListener("keydown", primeOnFirstInteraction);
    };

    window.addEventListener("pointerdown", primeOnFirstInteraction);
    window.addEventListener("keydown", primeOnFirstInteraction);

    return () => {
      audioRef.current = null;
      window.removeEventListener("pointerdown", primeOnFirstInteraction);
      window.removeEventListener("keydown", primeOnFirstInteraction);
    };
  }, []);

  return function play() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    // Guard the seek: if metadata hasn't loaded yet, setting currentTime can
    // throw in some browsers when two notifications land in the same tick.
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      audio.currentTime = 0;
    }

    void audio.play().catch((error: unknown) => {
      // Kept as a warning (not thrown) -- a missed sound should never break
      // the toast/badge, but a silent failure here is exactly what makes this
      // bug invisible. Most likely cause for any recurrence: this
      // notification arrived before any interaction with the page at all
      // (see module doc comment above).
      console.warn("Failed to play notification sound:", error);
    });
  };
}
