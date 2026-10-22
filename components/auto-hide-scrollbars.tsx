"use client";

import { useEffect } from "react";

/** Show a scrollbar only while its element is scrolling. */
export function AutoHideScrollbars() {
  useEffect(() => {
    const timers = new WeakMap<HTMLElement, number>();
    const onScroll = (event: Event) => {
      const el = event.target === document ? document.documentElement : event.target;
      if (!(el instanceof HTMLElement) || el.classList.contains("no-scrollbar")) return;
      el.classList.add("is-scrolling");
      const prev = timers.get(el);
      if (prev) window.clearTimeout(prev);
      timers.set(
        el,
        window.setTimeout(() => {
          el.classList.remove("is-scrolling");
          timers.delete(el);
        }, 700)
      );
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  return null;
}
