import os
from contextlib import asynccontextmanager
from http import HTTPStatus

import asyncpg
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.settings import settings
from api.routers import (
    administradores,
    agendamentos,
    auth,
    bloqueios,
    clientes,
    mensagens,
    modelos_unhas,
    nail_designs,
    notificacoes,
    pagamentos,
    programacao_semanal,
    push,
    status_pagamentos,
    uploads,
    usuarios,
)
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import glob
    app.state.pool = await asyncpg.create_pool(dsn=settings.DATABASE_URL)
    pool = app.state.pool
    for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), '..', 'migrations', '*.sql'))):
        with open(f) as fh:
            sql = fh.read()
        try:
            await pool.execute(sql)
        except Exception as e:
            print(f"MIGRATION {f}: {e}")
    yield
    await app.state.pool.close()



PRODUCAO = settings.ENVIRONMENT.strip().lower() == 'prod'

app = FastAPI(
    description='Sistema de agendamento de horários de Ana Clara Nails',
    version='1.0',
    lifespan=lifespan,
    # EM PRODUÇÃO O SWAGGER NÃO É EXPOSTO
    docs_url=None if PRODUCAO else '/docs',
    redoc_url=None if PRODUCAO else '/redoc',
    openapi_url=None if PRODUCAO else '/openapi.json',
)


@app.get('/health', tags=['health'], include_in_schema=False)
async def health():
    ## LIVENESS: RESPONDE SEMPRE (SEM BANCO, SEM AUTH)
    return {'status': 'ok', 'environment': settings.ENVIRONMENT}


@app.get('/health/ready', tags=['health'], include_in_schema=False)
async def ready(request: Request):
    ## READINESS: SÓ OK COM O POOL DO BANCO ATIVO
    pool = getattr(request.app.state, 'pool', None)
    if pool is None:
        return JSONResponse(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            content={'status': 'degraded', 'database': 'down'},
        )
    try:
        async with pool.acquire() as conn:
            await conn.fetchval('SELECT 1')
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            content={'status': 'degraded', 'database': 'down'},
        )
    return {'status': 'ok', 'database': 'up'}

origins = [
    origin.strip()
    for origin in os.getenv('CORS_ORIGINS', settings.CORS_ORIGINS).split(',')
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT', ],
    allow_headers=[
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'x-signature',
        'x-request-id'
    ]
)

## REGISTRA AS ROTAS DA API SOB O PREFIXO /api/v1
api_v1 = APIRouter(prefix='/api/v1')

api_v1.include_router(auth.router)
api_v1.include_router(usuarios.router)
api_v1.include_router(administradores.router)
api_v1.include_router(bloqueios.router)
api_v1.include_router(clientes.router)
api_v1.include_router(agendamentos.router)
api_v1.include_router(mensagens.router)
api_v1.include_router(modelos_unhas.router)
api_v1.include_router(nail_designs.router)
api_v1.include_router(notificacoes.router)
api_v1.include_router(pagamentos.router)
api_v1.include_router(programacao_semanal.router)
api_v1.include_router(push.router)
api_v1.include_router(status_pagamentos.router)
api_v1.include_router(uploads.router)

app.include_router(api_v1)

@app.middleware('http')
async def csrf_cookie_protection(request: Request, call_next):
    # SESSÃO POR ABA: Authorization Bearer não usa cookies, logo é imune
    # a CSRF (o navegador nunca o envia sozinho) — segue direto.
    if request.headers.get('authorization', '').lower().startswith('bearer '):
        return await call_next(request)
    exempt_paths = {
        '/api/v1/login/', '/api/v1/login/recuperar/',
        '/api/v1/usuarios', '/api/v1/login/redefinir/',
        '/api/v1/login/refresh', '/api/v1/login/logout/'
        '/docs', '/docs/', '/openapi.json',
        '/acompanhar/agendamento', '/api/v1/pagamentos/webhook',
        '/api/v1/administradores', '/admin/catalogo'
    }

    if request.url.path in exempt_paths or request.method in ('GET', 'HEAD', 'OPTIONS'):
        return await call_next(request)

    csrf_cookie = request.cookies.get('csrf_token')
    csrf_header = request.headers.get('X-CSRF-Token')

    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        return JSONResponse(
            status_code=HTTPStatus.FORBIDDEN,
            content={'detail': 'CSRF token inválido ou ausente'}
        )

    return await call_next(request)
