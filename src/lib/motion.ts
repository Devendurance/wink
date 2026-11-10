"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CONFETTI = ["#E040C8", "#2FD3B5", "#FF9A2E", "#3F8CFF", "#FF4F7B"];

/** Launch confetti from the centre of a container. No-op under reduced motion. */
export function fireConfetti(container: HTMLElement | null, count = 60): void {
  if (!container || prefersReducedMotion()) return;
  const pieces: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `position:absolute;left:50%;top:45%;width:8px;height:14px;border-radius:2px;background:${CONFETTI[i % CONFETTI.length]};pointer-events:none;`;
    container.appendChild(el);
    pieces.push(el);
  }
  pieces.forEach((el) => {
    const angle = Math.random() * Math.PI * 2;
    const power = 90 + Math.random() * 180;
    const duration = 0.4 + Math.random() * 0.5 + 0.5;
    gsap.fromTo(
      el,
      { x: 0, y: 0, rotation: 0, opacity: 1 },
      {
        x: Math.cos(angle) * power,
        y: Math.sin(angle) * power - 120,
        rotation: Math.random() * 720 - 360,
        duration,
        ease: "power2.out",
      }
    );
    gsap.to(el, {
      y: `+=${160 + Math.random() * 140}`,
      opacity: 0,
      duration: 0.7,
      delay: duration * 0.8,
      ease: "power1.in",
      onComplete: () => el.remove(),
    });
  });
}

/** Squash then wobble a box. No-op under reduced motion. */
export function wobble(target: Element | null, intensity = 1): void {
  if (!target || prefersReducedMotion()) return;
  gsap.fromTo(target, { rotation: -8 * intensity }, { rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.35)" });
}

export function squash(target: Element | null): Promise<void> {
  if (!target || prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    gsap.timeline({ onComplete: resolve }).to(target, { scale: 0.94, duration: 0.12, ease: "power1.out" }).to(target, { scale: 1, duration: 0.25, ease: "back.out(2)" });
  });
}

/**
 * Detects two acceleration spikes above ~15 m/s^2 within 800ms. Returns a
 * function that requests iOS motion permission, which must run inside a tap.
 */
export function useShake(onShake: () => void, enabled: boolean): () => Promise<void> {
  const handler = useRef(onShake);
  useEffect(() => {
    handler.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    let spikes: number[] = [];
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration;
      if (!a) return;
      const mag = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0);
      if (mag < 15) return;
      const now = Date.now();
      spikes = spikes.filter((t) => now - t < 800);
      spikes.push(now);
      if (spikes.length >= 2) {
        spikes = [];
        handler.current();
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [enabled]);

  return async () => {
    const DM = typeof window !== "undefined" ? (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent : undefined;
    try {
      await DM?.requestPermission?.();
    } catch {
      // Denied or unsupported. Tap still works.
    }
  };
}
