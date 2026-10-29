-- PostgreSQL equivalent of the existing D1 schema. Application routes access
-- these tables through a privileged server-only database connection. There are
-- deliberately no client RLS policies: browser clients must use the API routes.
CREATE TABLE public.user_states (
  user_id text PRIMARY KEY NOT NULL,
  revision bigint NOT NULL,
  state_json text NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE public.shared_campaigns (
  id text PRIMARY KEY NOT NULL,
  owner_id text NOT NULL,
  name text NOT NULL,
  revision bigint NOT NULL,
  shared_json text NOT NULL,
  notes_revision bigint NOT NULL,
  notes text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE public.campaign_members (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL,
  joined_at bigint NOT NULL
);

CREATE TABLE public.campaign_invites (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL,
  token_hash text NOT NULL,
  expires_at bigint NOT NULL,
  revoked_at bigint,
  used_by text,
  used_at bigint
);

CREATE TABLE public.campaign_shares (
  id text PRIMARY KEY NOT NULL,
  campaign_id text NOT NULL,
  user_id text NOT NULL,
  revision bigint NOT NULL,
  data_json text NOT NULL,
  updated_at bigint NOT NULL
);

CREATE UNIQUE INDEX campaign_member_identity ON public.campaign_members (campaign_id, user_id);
CREATE UNIQUE INDEX campaign_invite_token ON public.campaign_invites (token_hash);

ALTER TABLE public.user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_shares ENABLE ROW LEVEL SECURITY;

-- RLS is a second layer, not a replacement for table privileges. Supabase
-- installs these roles; the guarded loop also permits isolated local testing.
REVOKE ALL ON TABLE public.user_states, public.shared_campaigns, public.campaign_members, public.campaign_invites, public.campaign_shares FROM PUBLIC;
DO $$
DECLARE target_role text;
BEGIN
  FOR target_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.user_states, public.shared_campaigns, public.campaign_members, public.campaign_invites, public.campaign_shares FROM %I', target_role);
  END LOOP;
END
$$;
