-- The application connects through its server-only database account. These
-- credentials and sessions are never readable by Supabase browser roles.
CREATE TABLE public.app_accounts (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  is_owner boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX app_single_owner ON public.app_accounts (is_owner) WHERE is_owner;
CREATE TABLE public.app_sessions (
  token_hash text PRIMARY KEY,
  account_id text NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);
CREATE INDEX app_sessions_account ON public.app_sessions(account_id);
CREATE TABLE public.app_access_invites (
  id text PRIMARY KEY,
  token_hash text UNIQUE NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  used_at bigint,
  revoked_at bigint
);
CREATE TABLE public.app_auth_limits (
  bucket text PRIMARY KEY,
  started_at bigint NOT NULL,
  attempts integer NOT NULL
);
ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_access_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_auth_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_accounts, public.app_sessions, public.app_access_invites, public.app_auth_limits FROM PUBLIC;
DO $$
DECLARE target_role text;
BEGIN
  FOR target_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.app_accounts, public.app_sessions, public.app_access_invites, public.app_auth_limits FROM %I', target_role);
  END LOOP;
END
$$;
