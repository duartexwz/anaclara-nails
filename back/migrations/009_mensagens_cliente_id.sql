-- 009 — mensagens.cliente_id: vincula a conversa à cliente (RF16).
-- Sem isso, mensagens sem agendamento_id ficavam órfãs: o painel por
-- cliente nunca as exibia. Idempotente: só altera se a coluna não existir.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'mensagens' AND column_name = 'cliente_id'
    ) THEN
        ALTER TABLE public.mensagens
            ADD COLUMN cliente_id BIGINT REFERENCES public.clientes(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_mensagens_cliente_id
    ON public.mensagens USING btree (cliente_id);

-- Backfill: mensagens antigas herdam a cliente do agendamento vinculado.
UPDATE public.mensagens m
SET cliente_id = ag.cliente_id
FROM public.agendamentos ag
WHERE m.cliente_id IS NULL
  AND m.agendamento_id IS NOT NULL
  AND ag.id = m.agendamento_id;
