import AuthForm from '../auth-form';
export const dynamic = 'force-dynamic';
export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthForm mode="signup" params={await searchParams} />;
}
