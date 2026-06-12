const SPA_APPS = new Set([
  'family-chores',
  'health-tracker',
  'maintenance-tracker',
  'notes-app',
  'recipe-org',
  'reddit-gallery',
  'tracker',
]);

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const app = url.pathname.split('/')[1];

  // Only intercept known SPA apps
  if (!SPA_APPS.has(app)) return next();

  // Let static assets pass through
  if (url.pathname.match(/\.[a-z0-9]+$/i)) return next();

  return env.ASSETS.fetch(new URL(`/${app}/index.html`, request.url));
}
