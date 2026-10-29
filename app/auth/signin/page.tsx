import AuthForm from '../auth-form';
export const dynamic = 'force-dynamic';
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthForm mode="signin" params={await searchParams} />;
}
