BEGIN;
-- One private, resumable conversation per financial context. Never stored in localStorage.
CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  context_key text NOT NULL CHECK (context_key ~ '^(house|wallet:[0-9a-f-]{36}):[0-9]{4}-(0[1-9]|1[0-2])$'),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(messages) = 'array' AND jsonb_array_length(messages) <= 100 AND octet_length(messages::text) <= 1500000),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, context_key)
);
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_conversations FROM public, anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
CREATE POLICY assistant_conversations_owner ON public.assistant_conversations FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_household_member())
  WITH CHECK (owner_id = auth.uid() AND public.is_household_member());
NOTIFY pgrst, 'reload schema';
COMMIT;
