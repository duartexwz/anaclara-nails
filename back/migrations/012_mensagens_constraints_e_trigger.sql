-- 012 — mensagens: corrige constraints, FKs e trigger de updated_at.
--
-- Problemas corrigidos:
--   1. FK de cliente_id sem nome explícito e sem ON DELETE → ON DELETE SET NULL
--   2. FK de usuario_id sem nome explícito e sem ON DELETE → ON DELETE SET NULL
--   3. updated_at nunca era atualizado automaticamente → trigger genérico
--
-- Idempotente: cada bloco verifica existência antes de alterar.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Renomear/recriar FK de cliente_id com nome explícito + ON DELETE SET NULL
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    -- Remove constraint antiga gerada automaticamente (nome pode variar)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'mensagens'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name != 'fk_mensagens_agendamento_id'
          AND constraint_name != 'fk_mensagens_cliente_id'
          AND constraint_name != 'fk_mensagens_usuario_id'
          AND constraint_name LIKE '%cliente_id%'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE public.mensagens DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'mensagens'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name != 'fk_mensagens_agendamento_id'
              AND constraint_name != 'fk_mensagens_cliente_id'
              AND constraint_name != 'fk_mensagens_usuario_id'
              AND constraint_name LIKE '%cliente_id%'
            LIMIT 1
        );
    END IF;

    -- Adiciona com nome canônico (idempotente)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'mensagens'
          AND constraint_name = 'fk_mensagens_cliente_id'
    ) THEN
        ALTER TABLE public.mensagens
            ADD CONSTRAINT fk_mensagens_cliente_id
            FOREIGN KEY (cliente_id)
            REFERENCES public.clientes(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Renomear/recriar FK de usuario_id com nome explícito + ON DELETE SET NULL
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'mensagens'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name != 'fk_mensagens_agendamento_id'
          AND constraint_name != 'fk_mensagens_cliente_id'
          AND constraint_name != 'fk_mensagens_usuario_id'
          AND constraint_name LIKE '%usuario_id%'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE public.mensagens DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'mensagens'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name != 'fk_mensagens_agendamento_id'
              AND constraint_name != 'fk_mensagens_cliente_id'
              AND constraint_name != 'fk_mensagens_usuario_id'
              AND constraint_name LIKE '%usuario_id%'
            LIMIT 1
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'mensagens'
          AND constraint_name = 'fk_mensagens_usuario_id'
    ) THEN
        ALTER TABLE public.mensagens
            ADD CONSTRAINT fk_mensagens_usuario_id
            FOREIGN KEY (usuario_id)
            REFERENCES public.usuarios(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger genérico para updated_at (reutilizável em qualquer tabela)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Aplica o trigger em mensagens (idempotente via DROP IF EXISTS)
DROP TRIGGER IF EXISTS trg_mensagens_updated_at ON public.mensagens;
CREATE TRIGGER trg_mensagens_updated_at
    BEFORE UPDATE ON public.mensagens
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
