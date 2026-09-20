import { registerSW } from 'virtual:pwa-register';

/** Precache + offline; updates apply on the next load. */
export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
