import { passwordRegister } from '@/lib/password-auth';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return passwordRegister(request); }
