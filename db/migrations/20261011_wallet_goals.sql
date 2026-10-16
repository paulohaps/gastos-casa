-- Aplicar primeiro na branch isolada. Reutiliza a RLS por dono de personal_wallets.
BEGIN;
ALTER TABLE public.personal_wallets
  ADD COLUMN goal_nome text,
  ADD COLUMN goal_valor numeric(12,2),
  ADD COLUMN goal_reserva numeric(12,2),
  ADD COLUMN goal_prazo date,
  ADD COLUMN goal_mes text,
  ADD CONSTRAINT personal_wallet_goal_valid CHECK (
    (goal_nome IS NULL AND goal_valor IS NULL AND goal_reserva IS NULL AND goal_prazo IS NULL AND goal_mes IS NULL)
    OR (goal_nome IS NOT NULL AND goal_valor IS NOT NULL AND goal_reserva IS NOT NULL AND goal_prazo IS NOT NULL AND goal_mes IS NOT NULL
      AND length(trim(goal_nome)) BETWEEN 2 AND 80 AND goal_valor > 0
      AND goal_reserva >= 0 AND goal_reserva <= goal_valor
      AND goal_mes ~ '^\d{4}-(0[1-9]|1[0-2])$' AND to_char(goal_prazo, 'YYYY-MM') >= goal_mes)
  );
NOTIFY pgrst, 'reload schema';
COMMIT;
