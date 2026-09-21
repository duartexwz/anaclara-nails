-- 007 — Garante os status de pagamento (RN03) e preenche os
-- agendamentos antigos que nasceram com status NULL.
-- Idempotente: só insere o que ainda não existe.

INSERT INTO public.status_pagamentos (nome)
SELECT v.nome
FROM (VALUES ('Pendente'), ('Pago'), ('Cancelado')) AS v(nome)
WHERE NOT EXISTS (
    SELECT 1 FROM public.status_pagamentos s WHERE s.nome = v.nome
);

UPDATE public.agendamentos
SET status_pagamentos_id = (
    SELECT id FROM public.status_pagamentos WHERE nome = 'Pendente' LIMIT 1
)
WHERE status_pagamentos_id IS NULL;
