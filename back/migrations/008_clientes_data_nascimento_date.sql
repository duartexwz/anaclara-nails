-- 008 — clientes.data_nascimento VARCHAR -> DATE (contrato da API).
-- Idempotente: só converte se ainda for texto.

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'data_nascimento'
        AND data_type <> 'date'
    ) THEN
        ALTER TABLE public.clientes
            ALTER COLUMN data_nascimento TYPE DATE USING data_nascimento::date;
    END IF;
END $$;
