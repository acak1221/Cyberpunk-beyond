import type { NextRequest, NextResponse } from 'next/server';

export function protectGameRequest(
  request: NextRequest,
  cookieName: string,
  checkSession: (token: string | undefined) => Promise<boolean>,
): Promise<NextResponse>;
