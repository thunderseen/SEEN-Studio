// SEEN Studio — Edge Security Middleware
// Prevents public downloads of local/internal server scripts, configs, keystores, build trees, and docs.

const BLOCKED_PREFIXES = ['/cloud/', '/data/', '/functions/', '/.git/', '/android-twa/'];
const BLOCKED_EXTENSIONS = ['.keystore', '.jks', '.aab', '.ps1', '.mjs', '.bat'];
const BLOCKED_EXACT = new Set([
  '/wrangler.toml',
  '/wrangler.jsonc',
  '/readme.md',
  '/handover-guide.md',
  '/deployment-guide.md',
  '/.gitignore',
  '/.assetsignore',
]);

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname.toLowerCase();
  if (
    BLOCKED_EXACT.has(path) ||
    BLOCKED_PREFIXES.some((p) => path.startsWith(p)) ||
    BLOCKED_EXTENSIONS.some((ext) => path.endsWith(ext))
  ) {
    return new Response('Not Found', { status: 404 });
  }
  return context.next();
}
