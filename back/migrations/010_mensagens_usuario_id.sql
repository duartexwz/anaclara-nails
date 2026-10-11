-- 010 — mensagens.usuario_id: conversa privada por usuário/sessão (RF16).
-- Cada usuário logado vê só a própria conversa com a admin; a admin vê tudo.
-- Idempotente: só altera se a coluna não existir.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'mensagens' AND column_name = 'usuario_id'
    ) THEN
        ALTER TABLE public.mensagens
            ADD COLUMN usuario_id BIGINT REFERENCES public.usuarios(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_mensagens_usuario_id
    ON public.mensagens USING btree (usuario_id);

-- Backfill: mensagens vinculadas à cliente herdam o usuário do cadastro
-- (clientes.email_id aponta para usuarios.id).
UPDATE public.mensagens m
SET usuario_id = c.email_id
FROM public.clientes c
WHERE m.usuario_id IS NULL
  AND m.cliente_id IS NOT NULL
  AND c.id = m.cliente_id;
