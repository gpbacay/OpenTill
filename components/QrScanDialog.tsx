"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type DetectedCode = { rawValue?: string };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>;
};

/** Camera reader for a product QR. One read per code; `close` stops the camera after a product is added. */
export function QrScanDialog({
  onClose,
  onCode,
}: {
  onClose: () => void;
  onCode: (raw: string) => { status: string; close: boolean };
}) {
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const stopRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState("Point the camera at a product QR.");

  useEffect(() => () => stopRef.current?.(), []);

  // The video sits in a dialog portal, so it is not mounted on the first effect. Start when it is.
  const attach = useCallback((video: HTMLVideoElement | null) => {
    stopRef.current?.();
    stopRef.current = null;
    if (!video) return;

    let stream: MediaStream | null = null;
    let stopped = false;
    let timer = 0;
    let last = { value: "", at: 0 };
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
    stopRef.current = stop;

    // ponytail: BarcodeDetector (Chrome/Edge). A code adds once until it leaves the frame, so holding it doesn't raise the quantity.
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setStatus("This browser can't scan with the camera. Use Chrome or Edge, or search for the product.");
      return;
    }

    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((next) => {
        if (stopped) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        video.srcObject = next;
        return video.play();
      })
      .then(() => {
        if (stopped) return;
        const tick = () => {
          if (stopped) return;
          detector
            .detect(video)
            .then((codes) => {
              const value = codes[0]?.rawValue?.trim() ?? "";
              if (value && value !== last.value) {
                last = { value, at: Date.now() };
                const result = onCodeRef.current(value);
                setStatus(result.status);
                if (result.close) stop();
              } else if (!value) {
                last = { value: "", at: 0 };
              }
              if (!stopped) timer = window.setTimeout(tick, 200);
            })
            .catch(() => {
              if (!stopped) timer = window.setTimeout(tick, 400);
            });
        };
        tick();
      })
      .catch(() => {
        stream?.getTracks().forEach((track) => track.stop());
        if (!stopped) setStatus("Camera is blocked. Allow it for this site, then try Scan QR again.");
      });
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan product QR</DialogTitle>
        </DialogHeader>
        <video ref={attach} muted playsInline className="aspect-square w-full rounded-lg bg-black object-cover" />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {status}
        </p>
      </DialogContent>
    </Dialog>
  );
}
