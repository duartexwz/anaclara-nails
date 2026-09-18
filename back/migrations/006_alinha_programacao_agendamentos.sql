-- 006 — Alinha o banco vivo ao contrato da API (idempotente).
--   * agendamentos: modelo -> modelo_id, status -> status_pagamentos_id
--   * programacao_semanal: corrige typos (inicio/fim_espediente),
--     dia_da_semana (int) -> dia_semana (VARCHAR com o nome do dia),
--     pausa_duracao (int) -> TIME.
-- Tabelas estavam vazias; conversões preservam dados existentes.

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agendamentos' AND column_name = 'modelo'
    ) THEN
        ALTER TABLE public.agendamentos RENAME COLUMN modelo TO modelo_id;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agendamentos' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.agendamentos RENAME COLUMN status TO status_pagamentos_id;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programacao_semanal' AND column_name = 'dia_da_semana'
    ) THEN
        ALTER TABLE public.programacao_semanal RENAME COLUMN dia_da_semana TO dia_semana;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programacao_semanal' AND column_name = 'inicio_espediente'
    ) THEN
        ALTER TABLE public.programacao_semanal RENAME COLUMN inicio_espediente TO inicio_expediente;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programacao_semanal' AND column_name = 'fim_espediente'
    ) THEN
        ALTER TABLE public.programacao_semanal RENAME COLUMN fim_espediente TO fim_expediente;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programacao_semanal' AND column_name = 'dia_semana'
        AND data_type <> 'character varying'
    ) THEN
        ALTER TABLE public.programacao_semanal
            ALTER COLUMN dia_semana TYPE VARCHAR(20) USING dia_semana::text;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'programacao_semanal' AND column_name = 'pausa_duracao'
        AND data_type <> 'time without time zone'
    ) THEN
        ALTER TABLE public.programacao_semanal
            ALTER COLUMN pausa_duracao TYPE TIME USING make_interval(mins => pausa_duracao);
    END IF;
END $$;
