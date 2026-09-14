#!/bin/sh
set -e

echo "Conectando ao PostgreSQL (Neon)..."
until python -c "import asyncpg, os; asyncpg.create_pool(dsn=os.environ['DATABASE_URL'])" 2>/dev/null; do
  sleep 2
done

echo "Aplicando migrations..."
python - <<'PY'
import asyncpg, os, glob
pool = asyncpg.create_pool(dsn=os.environ['DATABASE_URL'])
async def run():
    for f in sorted(glob.glob('./migrations/*.sql')):
        print(f" - {f}")
        with open(f) as fh:
            sql = fh.read()
        try:
            await pool.execute(sql)
        except Exception as e:
            print(f"   AVISO: {f} falhou: {e}")
import asyncio
asyncio.run(run())
await pool.close()
PY

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "Garantindo conta admin + grade padrão..."
  python -m api.seed || echo "AVISO: seed falhou (verifique ADMIN_* e o banco)"
fi

echo "Iniciando a API..."
exec uvicorn api.app:app --host 0.0.0.0 --port 8020 --proxy-headers --forwarded-allow-ips='*'
