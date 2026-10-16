BEGIN;
-- Keep monthly keys valid; extend private history to inclusive month intervals.
ALTER TABLE public.assistant_conversations
  DROP CONSTRAINT assistant_conversations_context_key_check;
ALTER TABLE public.assistant_conversations
  ADD CONSTRAINT assistant_conversations_context_key_check
  CHECK (context_key ~ '^(house|wallet:[0-9a-f-]{36}):[0-9]{4}-(0[1-9]|1[0-2])(\.\.[0-9]{4}-(0[1-9]|1[0-2]))?$');
-- Range order and maximum span are validated by the authenticated service.
-- Owner policy, grants, unique key and existing conversations remain unchanged.
NOTIFY pgrst, 'reload schema';
COMMIT;
