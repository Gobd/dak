/**
 * PWA auto-refresh module.
 *
 * Import this in your app's entry point to automatically reload
 * when a new service worker version is available.
 *
 * @example
 * ```ts
 * // In main.tsx
 * import '@dak/vite-shared-react/pwa-refresh';
 * ```
 *
 * Or for more control:
 * ```ts
 * import { registerPwaRefresh } from '@dak/vite-shared-react/pwa-refresh';
 *
 * registerPwaRefresh({
 *   onNeedRefresh: () => showUpdateBanner(),
 *   autoRefresh: false, // Don't auto-reload, let user decide
 * });
 * ```
 */

/**
 * @typedef {Object} PwaRefreshOptions
 * @property {boolean} [autoRefresh=true] - Auto-reload when SW updates. Set false to handle manually.
 * @property {() => void} [onNeedRefresh] - Callback when new version is available.
 * @property {() => void} [onRefresh] - Callback just before reloading.
 */

let registered = false;

/**
 * Register PWA refresh handling.
 * @param {PwaRefreshOptions} [options]
 */
export function registerPwaRefresh(options = {}) {
  const { autoRefresh = true, onNeedRefresh, onRefresh } = options;

  if (registered || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  registered = true;

  // Listen for new service worker taking control
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[pwa] New service worker activated');
    onNeedRefresh?.();

    if (autoRefresh) {
      console.log('[pwa] Reloading to use new version...');
      onRefresh?.();
      window.location.reload();
    }
  });

  // Also check if there's a waiting SW on page load
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.waiting) {
      console.log('[pwa] Service worker waiting, prompting update');
      onNeedRefresh?.();

      if (autoRefresh) {
        // Tell the waiting SW to activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }

    // Listen for future updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[pwa] New version installed, update available');
          onNeedRefresh?.();

          if (autoRefresh) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      });
    });
  });
}

// Auto-register with defaults when imported as side-effect
registerPwaRefresh();
