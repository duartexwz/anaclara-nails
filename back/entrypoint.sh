#!/bin/sh

set -e

echo "Conectando ao PostgreSQL..."

until python - <<'PY'
import asyncpg
import asyncio
import os

async def test_connection():
    conn = await asyncpg.connect(
        dsn=os.environ["DATABASE_URL"]
    )
    await conn.close()

asyncio.run(test_connection())
PY
do
    echo "PostgreSQL ainda não disponível. Tentando novamente..."
    sleep 2
done

echo "PostgreSQL conectado!"
echo "Aplicando migrations..."

python - <<'PY'
import asyncpg
import asyncio
import os
import glob

async def run():
    conn = await asyncpg.connect(
        dsn=os.environ["DATABASE_URL"]
    )

    try:
        for f in sorted(glob.glob("./migrations/*.sql")):
            print(f" - {f}")

            with open(f, encoding="utf-8") as fh:
                sql = fh.read()

            try:
                await conn.execute(sql)
            except Exception as e:
                print(f"   AVISO: {f} falhou: {e}")

    finally:
        await conn.close()

asyncio.run(run())
PY

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    echo "Garantindo conta admin + grade padrão..."

    python -m api.seed || \
        echo "AVISO: seed falhou (verifique ADMIN_* e o banco)"
fi

echo "Iniciando a API..."

exec uvicorn api.app:app \
    --host 0.0.0.0 \
    --port 8020 \
    --proxy-headers \
    --forwarded-allow-ips="*"