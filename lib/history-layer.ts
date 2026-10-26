"use client";

import { useEffect, useRef } from "react";

type Layer = { id: number; close: () => void };

const layers: Layer[] = [];
let nextId = 1;
let ignorePop = false;

function layerId(state: unknown) {
  if (!state || typeof state !== "object" || !("opentillLayer" in state)) return undefined;
  const id = (state as { opentillLayer?: unknown }).opentillLayer;
  return typeof id === "number" ? id : undefined;
}

function onPop(event: PopStateEvent) {
  if (ignorePop) {
    ignorePop = false;
    event.stopImmediatePropagation();
    return;
  }
  if (layers.length === 0) return;
  // Same address as the page underneath, so keep Next from reloading it and wiping the screen behind.
  event.stopImmediatePropagation();
  const current = layerId(history.state);
  if (current === undefined) {
    while (layers.length) layers.pop()?.close();
    return;
  }
  const index = layers.findIndex((layer) => layer.id === current);
  if (index === -1 || index === layers.length - 1) return;
  while (layers.length - 1 > index) layers.pop()?.close();
}

if (typeof window !== "undefined" && !(window as Window & { __opentillHistoryLayer?: boolean }).__opentillHistoryLayer) {
  (window as Window & { __opentillHistoryLayer?: boolean }).__opentillHistoryLayer = true;
  window.addEventListener("popstate", onPop, true);
}

/** Browser back closes this instead of leaving the page. Closing it any other way removes that back step. */
export function useHistoryLayer(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const id = nextId++;
    layers.push({ id, close: () => closeRef.current() });
    history.pushState({ opentillLayer: id }, "");
    return () => {
      const index = layers.findIndex((layer) => layer.id === id);
      if (index === -1) return;
      layers.splice(index, 1);
      if (layerId(history.state) === id) {
        ignorePop = true;
        history.back();
      }
    };
  }, [open]);
}
