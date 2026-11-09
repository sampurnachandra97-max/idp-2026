"use client";

import { useEffect, useRef, useState } from "react";
import { paintScene, SCENE_HEIGHT as H, sceneWidth } from "@/lib/paintScene";

const MAX_SCALE = 2.5;
const FRAME_MS = 1000 / 30;
const HOVER_FRAME_MS = 1000 / 58;
const RESIZE_DELAY_MS = 220;

export function SoilField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);

  // The scene is composed for the panel's shape, so a resize composes it again.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let timer = 0;
    let { width, height } = element.getBoundingClientRect();
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect();
      if (Math.abs(next.width - width) < 2 && Math.abs(next.height - height) < 2) return;
      width = next.width;
      height = next.height;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLayoutVersion((version) => version + 1), RESIZE_DELAY_MS);
    });
    observer.observe(element);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let frame = 0;
    let cancelled = false;
    let hovering = false;
    let removeListeners = () => {};
    // The characters are text, so the site font has to be ready before they are drawn.
    Promise.allSettled([
      document.fonts.load('600 12px "PP Mori"'),
      document.fonts.load('600 12px "Instrument Sans Variable"'),
    ]).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return; // Hidden on this screen size, so there is nothing to draw.
        const sceneW = sceneWidth(width / height);
        const fit = Math.min(width / sceneW, height / H) * window.devicePixelRatio;
        const font = getComputedStyle(document.body).fontFamily;
        const motion = paintScene(element, Math.min(MAX_SCALE, Math.max(1.5, fit)), font, sceneW);
        setPainted(true);
        if (!motion) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          motion.still();
          return;
        }

        const onMove = (event: PointerEvent) => {
          if (event.pointerType !== "mouse") return;
          const rect = element.getBoundingClientRect();
          // The scene is centred horizontally and rests on the bottom edge.
          const fitted = Math.min(rect.width / sceneW, rect.height / H);
          motion.point({
            x: (event.clientX - rect.left - (rect.width - sceneW * fitted) / 2) / fitted,
            y: (event.clientY - rect.top - (rect.height - H * fitted)) / fitted,
          });
          hovering = true;
        };
        const onLeave = () => {
          motion.point(null);
          hovering = false;
        };
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerleave", onLeave);
        removeListeners = () => {
          element.removeEventListener("pointermove", onMove);
          element.removeEventListener("pointerleave", onLeave);
        };

        const start = performance.now();
        let last = -FRAME_MS;
        const tick = (now: number) => {
          if (cancelled) return;
          // A fuller frame rate while the cursor is over the art keeps it responsive.
          if (now - last >= (hovering ? HOVER_FRAME_MS : FRAME_MS)) {
            last = now;
            motion.frame(now - start);
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      removeListeners();
    };
  }, [layoutVersion]);

  return (
    <div className="field-art" aria-hidden="true">
      <div className="field-wash" />
      <canvas ref={canvas} className="field-canvas" data-painted={painted} />
    </div>
  );
}
