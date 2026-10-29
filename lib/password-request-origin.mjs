import { siteOrigin } from './supabase-auth-flow.mjs';

// Browsers may omit Origin (or send "null") under a no-referrer policy.
// In that case, accept only the browser-provided same-origin fetch metadata.
// Never infer the trusted site from forwarded headers or a Referer value.
export function allowedPasswordRequestOrigin(request, baseUrl, production = true) {
  try {
    const expected = siteOrigin(baseUrl, request.url, production);
    if (!expected || new URL(request.url).origin !== expected) return false;
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite !== null && fetchSite !== 'same-origin') return false;
    const origin = request.headers.get('origin');
    if (origin && origin !== 'null') return origin === expected;
    return fetchSite === 'same-origin';
  } catch {
    return false;
  }
}
