CREATE TABLE public.discord_connections (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  global_name TEXT,
  avatar_hash TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guild_status TEXT NOT NULL DEFAULT 'unknown' CHECK (guild_status IN ('unknown', 'member', 'not_member', 'reconnect_required')),
  guild_pending BOOLEAN NOT NULL DEFAULT false,
  guild_joined_at TIMESTAMPTZ,
  guild_checked_at TIMESTAMPTZ
);

GRANT SELECT ON public.discord_connections TO authenticated;
GRANT ALL ON public.discord_connections TO service_role;

ALTER TABLE public.discord_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own Discord connection"
ON public.discord_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.discord_oauth_tokens (
  user_id UUID PRIMARY KEY REFERENCES public.discord_connections(user_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.discord_oauth_tokens TO service_role;
ALTER TABLE public.discord_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.discord_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX discord_oauth_states_user_idx ON public.discord_oauth_states(user_id);

GRANT ALL ON public.discord_oauth_states TO service_role;
ALTER TABLE public.discord_oauth_states ENABLE ROW LEVEL SECURITY;