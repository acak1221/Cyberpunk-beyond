import { NextResponse } from 'next/server.js';

export async function protectGameRequest(request, cookieName, checkSession) {
  let allowed = false;
  try {
    allowed = await checkSession(request.cookies.get(cookieName)?.value);
  } catch {
    allowed = false;
  }

  const isPage = request.nextUrl.pathname === '/game' ||
    request.nextUrl.pathname === '/game/' ||
    request.nextUrl.pathname === '/game/index.html';
  const response = allowed
    ? NextResponse.next()
    : isPage
      ? NextResponse.redirect(new URL('/auth/signin', request.url))
      : new NextResponse('Unauthorized', { status: 401 });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
