// Verifies the Cloudflare Access token on admin requests (FR-098), when Access is configured.
// Access blocks unauthenticated visitors at the edge; this check keeps the app safe even if Access is misconfigured.
import { clearJwtKeyCache, verifyJwt, type Jwk } from './jwt';

interface AccessConfig {
  teamDomain: string; // e.g. https://vyom-it.cloudflareaccess.com
  audience: string; // the Access application's AUD tag
  fetchKeys?: (url: string) => Promise<{ keys: Jwk[] }>;
  now?: () => number;
}

/** Returns the signed-in email, or null if the token is missing, forged, expired or for another app. */
export async function verifyAccessToken(token: string | null, config: AccessConfig): Promise<string | null> {
  if (!config.teamDomain || !config.audience) return null;
  const teamDomain = config.teamDomain.replace(/\/$/, '');
  const payload = await verifyJwt(token, {
    jwksUrl: `${teamDomain}/cdn-cgi/access/certs`,
    issuers: [teamDomain],
    audience: config.audience,
    ...(config.fetchKeys ? { fetchKeys: config.fetchKeys } : {}),
    ...(config.now ? { now: config.now } : {}),
  });
  return typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;
}

export const clearAccessKeyCache = clearJwtKeyCache;
