import 'server-only';
import { SESSION_COOKIE_NAME, readPasswordUserFromToken } from './password-auth';

export const gameSessionCookieName = SESSION_COOKIE_NAME;

export async function isGameSessionAllowed(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    return Boolean(await readPasswordUserFromToken(token));
  } catch {
    // A database or configuration failure must never open access.
    return false;
  }
}
