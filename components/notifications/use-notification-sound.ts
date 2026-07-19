"use client";

import { useRef } from "react";

/**
 * Lazily creates and replays public/notification.mp3 on demand. Browsers
 * block audio autoplay until the user has interacted with the page at least
 * once, so `.play()` rejecting is expected and silently swallowed -- the
 * toast/badge still fire regardless of whether the sound actually played.
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return function play() {
    if (typeof window === "undefined") {
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio("/notification.mp3");
      audioRef.current.preload = "auto";
    }

    const audio = audioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay blocked (no prior user interaction) -- ignore.
    });
  };
}
