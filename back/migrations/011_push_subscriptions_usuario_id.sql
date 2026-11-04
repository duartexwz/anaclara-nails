-- 011 — push_subscriptions.usuario_id: dono da inscrição (RF16/RNF06).
-- Sem dono, o push da admin ("Nova mensagem de cliente") ia para TODOS
-- os aparelhos inscritos — inclusive o da própria cliente que enviou.
-- Idempotente: só altera se a coluna não existir.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'push_subscriptions' AND column_name = 'usuario_id'
    ) THEN
        ALTER TABLE public.push_subscriptions
            ADD COLUMN usuario_id BIGINT REFERENCES public.usuarios(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_push_subscriptions_usuario_id
    ON public.push_subscriptions USING btree (usuario_id);
