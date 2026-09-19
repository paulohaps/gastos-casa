-- Recarrega o schema cache da Neon Data API / PostgREST.
-- Necessário após DDL que cria/altera objetos expostos pela Data API.
-- Seguro: não altera dados nem estrutura.
NOTIFY pgrst, 'reload schema';
