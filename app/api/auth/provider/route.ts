import { authProvider } from '@platform-runtime';

export const dynamic = 'force-dynamic';

// This public endpoint identifies the hosting mode only. It is not an
// authentication or authorization signal and contains no user data.
export function GET() {
  return Response.json({ provider: authProvider }, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
