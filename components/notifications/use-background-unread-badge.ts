"use client";

import { useEffect, useRef } from "react";

const FAVICON_SIZE = 32;

/**
 * Composites a red count badge onto the existing favicon. Draws from
 * /favicon.ico directly (Next's App Router favicon convention) rather than
 * adding a separate icon asset -- canvas can rasterize it in every browser
 * this app targets.
 */
function drawBadgedFavicon(baseImage: HTMLImageElement, count: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return baseImage.src;
  }

  ctx.drawImage(baseImage, 0, 0, FAVICON_SIZE, FAVICON_SIZE);

  const label = count > 99 ? "99+" : String(count);
  const badgeRadius = label.length > 2 ? 11 : 9;
  const cx = FAVICON_SIZE - badgeRadius - 1;
  const cy = badgeRadius + 1;

  ctx.beginPath();
  ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${label.length > 2 ? 9 : 11}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 0.5);

  return canvas.toDataURL("image/png");
}

/**
 * Facebook-style "app is backgrounded" indicator: while the tab is hidden
 * and there's an unread count, prefixes document.title with "(N)" and swaps
 * in a badged favicon; restores both the moment the tab is refocused.
 * Read-only -- never marks anything read/seen itself, only reflects
 * `unreadCount`.
 */
export function useBackgroundUnreadBadge(unreadCount: number): void {
  const originalTitleRef = useRef<string | null>(null);
  const originalFaviconHrefRef = useRef<string | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    return () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (link && originalFaviconHrefRef.current) {
        link.href = originalFaviconHrefRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }

    let faviconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      document.head.appendChild(faviconLink);
    }
    if (originalFaviconHrefRef.current === null) {
      originalFaviconHrefRef.current = faviconLink.href || "/favicon.ico";
    }
    if (!baseImageRef.current) {
      const image = new Image();
      image.src = originalFaviconHrefRef.current;
      baseImageRef.current = image;
    }

    const link = faviconLink;
    const originalTitle = originalTitleRef.current ?? "";
    const originalFaviconHref = originalFaviconHrefRef.current ?? link.href;

    const applyBadge = () => {
      if (document.visibilityState === "hidden" && unreadCount > 0) {
        const label = unreadCount > 99 ? "99+" : String(unreadCount);
        document.title = `(${label}) ${originalTitle}`;

        const image = baseImageRef.current;
        if (image?.complete) {
          link.href = drawBadgedFavicon(image, unreadCount);
        } else if (image) {
          image.onload = () => {
            if (document.visibilityState === "hidden") {
              link.href = drawBadgedFavicon(image, unreadCount);
            }
          };
        }
      } else {
        document.title = originalTitle;
        link.href = originalFaviconHref;
      }
    };

    applyBadge();
    document.addEventListener("visibilitychange", applyBadge);

    return () => {
      document.removeEventListener("visibilitychange", applyBadge);
    };
  }, [unreadCount]);
}
