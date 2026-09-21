"""Seed inicial de produção: conta admin + grade semanal padrão.

Uso (uma vez, com o banco no ar):
    ADMIN_EMAIL=ana@... ADMIN_PASSWORD=... \
    ADMIN_NOME="Ana Clara" python -m api.seed

Idempotente: não duplica admin, profissional, nem dias já configurados.
"""

import asyncio
import os
import sys

import asyncpg

from api.security import get_password_hash
from api.settings import settings

DIAS_UTEIS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']




async def seed_admin(pool: asyncpg.Pool, email: str, senha: str, nome: str) -> None:
    async with pool.acquire() as conn:
        existente = await conn.fetchrow(
            'SELECT id FROM administradores WHERE email = $1', email
        )
        if existente:
            print(f'Admin já existe (administradores.id={existente["id"]}) — pulando.')
            return
        row = await conn.fetchrow(
            """
            INSERT INTO administradores (nome, email, password, type_user_id)
            VALUES ($1, $2, $3, 1)
            RETURNING id
            """,
            nome,
            email,
            get_password_hash(senha),
        )
        print(f'Admin criado (administradores.id={row["id"]}).')


async def seed_programacao(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        prof = await conn.fetchrow(
            "SELECT id FROM nails_designs ORDER BY id LIMIT 1"
        )
        if not prof:
            prof = await conn.fetchrow(
                """
                INSERT INTO nails_designs (nome, cpf, telefone)
                VALUES ('Ana Clara', '06947029198', '61985092748') 
                RETURNING id
                """
            )
            print(f"Profissional criada (nails_designs.id={prof['id']}).")
        for dia in DIAS_UTEIS:
            await conn.execute(
                """
                INSERT INTO programacao_semanal
                    (profissional_id, dia_semana, ativo,
                     inicio_expediente, fim_expediente, pausa_duracao,
                     intervalo_minutos)
                VALUES ($1, $2, TRUE, '09:00', '18:00', '01:00', 90)
                ON CONFLICT (profissional_id, dia_semana) DO NOTHING
                """,
                prof['id'],
                dia,
            )
        print('Grade semanal padrão garantida (Seg–Sex 09:00–18:00).')


async def main() -> int:
    email = os.getenv('ADMIN_EMAIL', '').strip()
    senha = os.getenv('ADMIN_PASSWORD', '')
    nome = os.getenv('ADMIN_NOME', 'Ana Clara').strip() or 'Ana Clara'
    if not email or not senha:
        print('Defina ADMIN_EMAIL e ADMIN_PASSWORD para criar a conta admin.')
        return 2
    if len(senha) < 8:
        print('ADMIN_PASSWORD precisa de ao menos 8 caracteres.')
        return 2
    pool = await asyncpg.create_pool(dsn=settings.DATABASE_URL)
    try:
        await seed_admin(pool, email, senha, nome)
        await seed_programacao(pool)
    finally:
        await pool.close()
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
