-- 013 — nail_designs.email: e-mail da profissional (usado pela modal
-- "Adicionar administrador" para carregar nome + e-mail da nail selecionada).
-- Idempotente: só adiciona se a tabela existir e a coluna ainda não existir.

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'nail_designs'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'nail_designs'
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.nail_designs
            ADD COLUMN email character varying(255);
    END IF;
END $$;
