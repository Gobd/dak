/**
 * Hide cursor listener for DAK iframe apps.
 *
 * Import in your app's entry point to receive hide-cursor messages
 * from the dashboard parent frame.
 *
 * @example
 * import '@dak/vite-shared-react/hide-cursor';
 */

if (typeof window !== 'undefined') {
  // Apply on mount in case the parent already set the state before this iframe loaded
  const stored = localStorage.getItem('dak-hide-cursor');
  if (stored === 'true') {
    document.documentElement.classList.add('hide-cursor');
  }

  window.addEventListener('message', (event) => {
    if (event.data?.action === 'hideCursor') {
      document.documentElement.classList.toggle('hide-cursor', event.data.hidden);
    }
  });
}
