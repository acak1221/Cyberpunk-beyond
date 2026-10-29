import { NextRequest } from 'next/server';
import { gameSessionCookieName, isGameSessionAllowed } from '@game-guard';
import { protectGameRequest } from './lib/game-proxy.mjs';

// Vercel executes this before the CDN and public files. The Sites build uses
// its own private-site authorization through the platform-specific guard.
export async function proxy(request: NextRequest) {
  return protectGameRequest(request, gameSessionCookieName, isGameSessionAllowed);
}

export const config = { matcher: ['/game/:path*'] };
