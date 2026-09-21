-- 006 — Alinha programacao_semanal/agendamentos ao contrato da API,
-- remove duplicatas da grade e cria o UNIQUE que torna o seed idempotente.
-- Idempotente: pode rodar a cada boot sem efeitos colaterais.

-- Alinhamento de colunas (guards: só renomeia/converte se necessário).
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

-- Remove duplicatas da grade (mantém o menor id por profissional/dia).
DELETE FROM public.programacao_semanal a
USING public.programacao_semanal b
WHERE a.id > b.id
AND a.profissional_id IS NOT DISTINCT FROM b.profissional_id
AND a.dia_semana IS NOT DISTINCT FROM b.dia_semana;

-- UNIQUE que impede novas duplicatas e permite ON CONFLICT (profissional_id, dia_semana).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_programacao_profissional_dia'
    ) THEN
        ALTER TABLE public.programacao_semanal
            ADD CONSTRAINT uq_programacao_profissional_dia UNIQUE (profissional_id, dia_semana);
    END IF;
END $$;
