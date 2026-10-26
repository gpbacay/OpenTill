"use client";

import { useEffect, useRef } from "react";

type Layer = { id: number; close: () => void };

const layers: Layer[] = [];
let nextId = 1;
let ignorePop = false;
// A phone's file picker pauses the page and pops the dialog's history entry, which would close Add product
// before the picture comes back. Hold the dialog until the picker is done.
let filePicker = false;
let fileTimer = 0;

function pickingFile(target: EventTarget | null) {
  return target instanceof HTMLInputElement && target.type === "file";
}

function armFilePicker() {
  filePicker = true;
  window.clearTimeout(fileTimer);
  fileTimer = window.setTimeout(() => {
    if (document.hasFocus()) filePicker = false;
  }, 700);
}

function releaseFilePicker() {
  if (!filePicker) return;
  window.clearTimeout(fileTimer);
  fileTimer = window.setTimeout(() => {
    filePicker = false;
  }, 400);
}

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
  if (filePicker && layers.length > 0) {
    event.stopImmediatePropagation();
    const top = layers[layers.length - 1];
    if (layerId(history.state) !== top.id) history.pushState({ opentillLayer: top.id }, "");
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
  document.addEventListener(
    "click",
    (event) => {
      if (pickingFile(event.target)) armFilePicker();
    },
    true
  );
  document.addEventListener(
    "change",
    (event) => {
      if (pickingFile(event.target)) releaseFilePicker();
    },
    true
  );
  window.addEventListener("focus", releaseFilePicker);
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
