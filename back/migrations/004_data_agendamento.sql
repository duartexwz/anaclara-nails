-- =====================================================================
-- MIGRATION 004 — Data do agendamento + índices de produção
-- Idempotente: pode rodar várias vezes (psql -f 004_data_agendamento.sql).
-- O agendamento passa a guardar a data (DATE), não só o horário (TIME),
-- permitindo agenda real, histórico e ocupação por dia (RN06).
-- =====================================================================

ALTER TABLE "agendamentos"
    ADD COLUMN IF NOT EXISTS "data" DATE;

CREATE INDEX IF NOT EXISTS "ix_agendamentos_data"
    ON "agendamentos" ("data");

CREATE INDEX IF NOT EXISTS "ix_agendamentos_cliente_data"
    ON "agendamentos" ("cliente_id", "data");
