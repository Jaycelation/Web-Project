// Demo data is opt-in, server-only, and never available in a production build.
export function isDemoCatalogEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_CATALOG === 'true';
}
