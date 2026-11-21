// SEEN Studio — Edge Security Middleware
// Prevents public downloads of local/internal server scripts, configs, and docs.

const BLOCKED_PREFIXES = ['/cloud/', '/data/', '/functions/', '/.git/'];
const BLOCKED_EXACT = new Set([
  '/server.ps1',
  '/server.mjs',
  '/start-store.bat',
  '/wrangler.toml',
  '/readme.md',
  '/handover-guide.md',
  '/deployment-guide.md',
  '/.gitignore',
]);

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname.toLowerCase();
  if (BLOCKED_EXACT.has(path) || BLOCKED_PREFIXES.some((p) => path.startsWith(p))) {
    return new Response('Not Found', { status: 404 });
  }
  return context.next();
}
