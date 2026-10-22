"use client";

import { useEffect } from "react";

// Fields that bring up the on-screen keyboard (selects open a picker instead).
const TYPING = 'input:not([type="checkbox"], [type="radio"], [type="file"], [type="button"], [type="submit"], [type="range"]), textarea';

/**
 * Phones: once the keyboard is up, scroll the field being typed in back into the visible area if the keyboard
 * covers it. Chrome on Android also shrinks the page (viewport `interactive-widget`); this covers iOS Safari and
 * fields inside the app's own scroll areas.
 */
export function KeepFocusedFieldVisible() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let timer = 0;

    const reveal = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches(TYPING)) return;
      const rect = el.getBoundingClientRect();
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      if (rect.top < top + 8 || rect.bottom > bottom - 8) el.scrollIntoView({ block: "center", behavior: "smooth" });
    };

    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches(TYPING)) return;
      window.clearTimeout(timer);
      // The keyboard animates in for ~250ms; measure after it settles.
      timer = window.setTimeout(reveal, 300);
    };

    document.addEventListener("focusin", onFocus);
    viewport?.addEventListener("resize", reveal);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onFocus);
      viewport?.removeEventListener("resize", reveal);
    };
  }, []);
  return null;
}
