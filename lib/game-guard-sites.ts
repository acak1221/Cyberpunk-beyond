// Sites enforces its own private-site access before the application runs.
// Keep that platform's existing behavior when building with vinext.
export async function isGameSessionAllowed(_token: string | undefined): Promise<boolean> {
  return true;
}

export const gameSessionCookieName = 'nc_session';
