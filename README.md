# 💅 Ana Clara Nails — Sistema de Agendamento Online

Sistema completo de agendamento para nail designer: catálogo de modelos, reserva de horário com pagamento do **sinal (50%) via Mercado Pago**, painel administrativo (agenda, clientes, mensagens, equipe) e notificações.

> Stack: **React 19 + TanStack Start** (frontend) · **FastAPI + PostgreSQL** (backend) · **Docker/Nginx** (gateway) · **Vercel** (deploy).

---

## Índice

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Requisitos](#requisitos)
- [Como rodar](#como-rodar)
- [Configuração (.env)](#configuração-env)
- [Banco de dados](#banco-de-dados)
- [Backend (API)](#backend-api)
- [Frontend (Web)](#frontend-web)
- [Testes e qualidade](#testes-e-qualidade)
- [Deploy](#deploy)
- [Documentação do projeto](#documentação-do-projeto)

---

## Visão geral

| Área | Descrição |
|---|---|
| Cliente | navega no catálogo, escolhe modelo/dia/horário, paga o sinal no Pix/cartão e acompanha os próprios agendamentos e mensagens |
| Admin | gerencia agenda (remarcar/cancelar), catálogo (fotos no R2), clientes, bloqueios, grade semanal, equipe de nail designers, mensagens e notificações |
| Pagamento | Mercado Pago (Checkout Bricks) + webhook com validação de assinatura HMAC-SHA256 |
| Requisitos | RF (requisitos funcionais) e RN (regras de negócio) conforme `docs/Levantamento de Requisistos.pdf` |

---

## Arquitetura

```
                         ┌────────────────────────────────────────────┐
   Navegador ── :8010 ──▶│  gateway (nginx) — same-origin, sem CORS   │
                         │                                            │
                         │   /        ──▶ frontend (vite preview)     │
                         │   /api/    ──▶ backend  (uvicorn :8020)    │
                         └──────────────────┬─────────────────────────┘
                                            │
              ┌─────────────────────────────┼──────────────────────────────┐
              ▼                             ▼                              ▼
      PostgreSQL (externo,           Cloudflare R2                  Mercado Pago
      DATABASE_URL — Neon)           (fotos do catálogo)            (sinal + webhook)
                                            │
                             SMTP (e-mail de recuperação) · Web Push/VAPID (admin)
```

- **Dev local** roda com dois processos separados: backend em `:8000` e frontend em `:3000`.
- **Produção (compose)** usa o nginx como único ponto de entrada (`:8010`), eliminando CORS e viabilizando cookies `SameSite=Lax` na rede local.

---

## Estrutura do repositório

```
nail-appointment/
├── back/                    # API FastAPI (Python 3.12+)
│   ├── api/
│   │   ├── app.py           # criação do FastAPI, CORS, CSRF, lifespan (pool + migrations)
│   │   ├── settings.py      # configuração lida do .env da raiz
│   │   ├── security.py      # JWT (HS256), argon2, guards de permissão
│   │   ├── routers/         # 15 routers (auth, agendamentos, pagamentos, ...)
│   │   ├── services/        # regras de negócio
│   │   ├── repositories/    # SQL cru via asyncpg
│   │   ├── schemas/         # Pydantic + enums
│   │   └── seed.py          # cria admin + grade Seg–Sex (idempotente)
│   ├── migrations/*.sql     # rodam no startup e no entrypoint
│   ├── tests/               # 243 testes pytest (sem banco)
│   ├── schema_atualizado.sql# dump completo do schema (PostgreSQL 16)
│   ├── Dockerfile · entrypoint.sh · run.py
│   └── pyproject.toml · requirements.txt · uv.lock
│
├── front/                   # Web (React 19 + TanStack Start + Vite 8)
│   ├── src/routes/          # rotas file-based (público + /admin)
│   ├── src/components/      # ui/ (shadcn), admin/, modais e páginas
│   ├── src/lib/             # api.ts (HTTP), masks.ts, dados.ts
│   ├── Dockerfile · nginx.conf · vite.config.ts
│   └── package.json · bun.lock
│
├── gateway/nginx.conf       # proxy same-origin (frontend + /api)
├── docs/                    # levantamento, fluxos e modelagem
├── docker-compose.yml       # frontend + gateway + backend
├── .env.example             # variáveis do backend (raiz)
├── vercel.json              # deploy front + back na Vercel
└── package.json             # scaffold Vite (raiz)
```

---

## Requisitos

| Ferramenta | Versão |
|---|---|
| Node.js | ≥ 20.19 (npm ≥ 10) ou Bun |
| Python | ≥ 3.12 |
| [uv](https://docs.astral.sh/uv/) | gerenciador de deps do backend |
| PostgreSQL | 16 (banco externo, ex.: Neon) |
| Docker + Docker Compose | opcional (roda tudo junto) |

---

## Como rodar

### 1. Configurar segredos

```bash
cp .env.example .env
# preencha ao mínimo: DATABASE_URL, SECRET_KEY, CORS_ORIGINS
# opcional: MERCADO_PAGO_*, SMTP_*, R2_*, VAPID_*, ADMIN_EMAIL/ADMIN_PASSWORD (seed)
```

### 2. Backend (FastAPI)

```bash
cd back
uv sync                          # instala dependências (cria .venv)
uv run task dev                  # uvicorn api.app:app --reload → http://localhost:8000
```

Alternativas:

```bash
uvicorn api.app:app --reload     # sem taskipy
python run.py                    # atalho em run.py
```

As migrations em `back/migrations/*.sql` executam sozinhas no startup (idempotentes). Para criar o admin inicial e a grade Seg–Sex manualmente:

```bash
ADMIN_EMAIL=... ADMIN_PASSWORD=... uv run python -m api.seed
```

### 3. Frontend (React)

```bash
cd front
npm install                       # ou: bun install
cp .env.example .env              # VITE_API_URL=http://localhost:8000
npm run dev                       # → http://localhost:3000
```

Scripts disponíveis: `dev` · `build` · `preview` · `lint` (ESLint) · `format` (Prettier).

### 4. Tudo junto com Docker

```bash
docker compose up --build
# gateway: http://localhost:8010  → frontend
#          http://localhost:8010/api/... → backend (:8020 interno)
```

> O compose **não sobe banco** — aponte `DATABASE_URL` para um PostgreSQL externo.

---

## Configuração (.env)

O backend lê o `.env **na raiz do projeto** (`back/api/settings.py`). Todas as variáveis estão documentadas em [`.env.example`](.env.example):

| Grupo | Variáveis principais |
|---|---|
| App | `ENVIRONMENT` (`dev`/`prod` — em `prod` desliga `/docs`), `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` (30), `REFRESH_TOKEN_EXPIRE_DAYS` (7), `FRONTEND_URL`, `CORS_ORIGINS` |
| Pagamento | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_ACESS_TOKEN` |
| E-mail | `SMTP_USER`, `SMTP_PASSORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USE_TLS/SSL`, `APP_PUBLIC_URL` |
| Fotos | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_MAX_IMAGE_MB` |
| Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Cookies | `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` |
| Seed | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOME` (executados pelo `entrypoint.sh`) |

Frontend ([`front/.env.example`](front/.env.example)):

| Variável | Uso |
|---|---|
| `VITE_API_URL` | base da API (vazio = mesma origem, via gateway) |
| `VITE_MP_PUBLIC_KEY` | public key do Mercado Pago (sandbox `TEST-...`) |

> ⚠️ `.env` está no `.gitignore` — nunca commite chaves reais.

---

## Banco de dados

- **Schema**: [`back/schema_atualizado.sql`](back/schema_atualizado.sql) (dump PG 16, idempotente, usa `pg_trgm`).
- **Aplicação automática**: no startup da API (`lifespan` em `api/app.py`) e no `entrypoint.sh` — ambos rodam `back/migrations/*.sql` em ordem.
- **Tabelas (14)**: `administradores`, `agendamentos`, `bloqueios`, `clientes`, `mensagens`, `modelos_unhas`, `nail_designs`, `notificacoes`, `password_resets`, `programacao_semanal`, `push_subscriptions`, `status_pagamentos`, `type_users`, `usuarios`.
- **Modelagem inicial**: [`docs/modelagem_banco.sql`](docs/modelagem_banco.sql).

---

## Backend (API)

- **Base**: `/api/v1` · **Saúde**: `GET /health` e `GET /health/ready` · **Docs**: `/docs` e `/openapi.json` (somente `ENVIRONMENT=dev`).
- **Linguagem/bibliotecas**: FastAPI, asyncpg (SQL puro, sem ORM), PyJWT, pwdlib (argon2), mercadopago, httpx, fastapi-mail, pywebpush, boto3.

### Endpoints

| Router (prefixo `/api/v1`) | Métodos | Função |
|---|---|---|
| `/login` | `POST /`, `GET /auth/me`, `POST /auth/refresh`, `POST /logout/`, `POST /recuperar/`, `POST /redefinir/` | login, sessão, refresh e recuperação de senha (RF03) |
| `/usuarios` | `POST/GET/PATCH/DELETE` | clientes/usuários |
| `/administradores` | `POST/GET/PATCH/DELETE` | administradoras |
| `/clientes` | `POST/GET/PATCH/DELETE` | cadastro e gestão de clientes |
| `/agendamentos` | `POST/GET/PATCH/DELETE` | criar, listar (com filtros), remarcar e cancelar |
| `/pagamentos` | `POST ''`, `GET /public-key`, `GET /{id}`, `POST /webhook` | sinal via Checkout Bricks + webhook Mercado Pago |
| `/status-pagamentos` | `POST/GET/PATCH/DELETE` | catálogo de status (seed RN03) |
| `/programacao-semanal` | `POST/GET/PATCH/DELETE` | grade: expediente e intervalo por dia |
| `/bloqueios` | `POST/GET/DELETE` | bloquear/liberar datas na agenda |
| `/modelos-unhas` | `POST/GET/PATCH/DELETE` | catálogo de modelos (valor, duração, categoria) |
| `/nail-designs` | `POST/GET/PATCH/DELETE` | profissionais da equipe |
| `/mensagens` | `POST/GET/PATCH` | chat admin ⇄ cliente (marca como lida) |
| `/notificacoes` | `GET`, `PATCH /{id}/lida`, `PATCH /lidas` | painel de notificações da admin |
| `/push` | `GET /vapid-key`, `POST/GET/DELETE /subscriptions` | Web Push (VAPID) |
| `/uploads` | `POST/DELETE /modelos/{id}` | fotos do catálogo no Cloudflare R2 |

### Autenticação e permissões

- **JWT (HS256)**: access token de 30 min + refresh de 7 dias, senha com **argon2**.
- O token vive no `sessionStorage` do frontend → **sessão por aba**, viajando no header `Authorization: Bearer`.
- Papéis: `ADMIN (1)`, `USER (2)`, `NAIL_ADMIN (3)` — validados nos services (403 *“A ação requer elevação”*).
- Proteção **CSRF** (cookie + header `X-CSRF-Token`) para requisições que não usam Bearer.

### Regras de negócio

| RN/RF | Regra |
|---|---|
| **RN01** | o sinal é sempre **50% do valor do serviço** (tolerância de R$ 0,01), validado na criação, na troca de modelo e no pagamento |
| **RN03** | agendamento nasce **Pendente** e só fica **Confirmado** após aprovação do sinal (mapeamento status Mercado Pago → interno) |
| **RN06** | **sem colisão de horário** no mesmo dia (criação e remarcação) |
| **RF03** | recuperação/redefinição de senha por token enviado por e-mail |
| **RF17** | cancelamento permitido apenas para a admin ou a própria dona do agendamento |
| Webhook MP | validação oficial da assinatura `x-signature` (HMAC-SHA256), normalização Pix e fallback de CPF |

---

## Frontend (Web)

**Stack**: React 19 · TanStack Start/Router (rotas file-based) · Vite 8 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · TanStack Query · Zod.

### Páginas

| Área | Rotas |
|---|---|
| Pública | `/` (início) · `/catalogo` · `/agendamento` · `/meus-agendamentos` · `/mensagens` · `/meus-dados` · `/redefinir-senha` |
| Admin | `/admin` (painel) · `/admin/agendamentos` · `/admin/catalogo` · `/admin/horarios` · `/admin/clientes` · `/admin/mensagens` · `/admin/equipe` |

### Detalhes implementados

- **Cliente autenticado**: login/cadastro/recuperação em modais (`components/auth-modais.tsx`), sessão por aba (Bearer + refresh automático em `lib/api.ts`).
- **Pagamento**: modal com Mercado Pago Checkout Bricks (Pix ou cartão) cobrindo o sinal de 50%.
- **Máscaras de entrada** (`src/lib/masks.ts`): CPF (`000.000.000-00`), telefone (`(00) 00000-0000`), moeda (`140,55`) e duração (`1h30`) — aplicadas em todos os inputs do sistema; helpers de exibição (`formatarCpfExibicao`, `formatarTelefoneExibicao`).
- **Formatação de dados** (`src/lib/dados.ts`): `brl`, `fmtDuracao`/`duracaoParaApi` (`01:30:00` ↔ `1h30`), `fmtHora`, `fmtDataCurta`.
- **Upload de fotos** com otimização automática antes de enviar ao R2.
- **Web Push**: inscrição de notificações para a admin (`components/admin/AdminShell.tsx`).

---

## Testes e qualidade

### Backend

```bash
cd back
uv run pytest              # 243 testes — não precisa de banco (FakeConnection)
uv run task test           # pytest com cobertura (--cov=api)
uv run task lint           # ruff
uv run task format         # ruff format
uv run task check          # lint + format check
```

Suíte em `back/tests/`: `test_services`, `test_routers`, `test_pagamentos`, `test_notificacoes_push`, `test_novos_recursos`, `test_repositories`, `test_uploads` (+ `conftest.py` com env dummy e dependências mockadas).

### Frontend

```bash
cd front
npm run lint                # ESLint + Prettier
npm run format              # formata o código
npx tsc --noEmit            # checagem de tipos
```

---

## Deploy

### Vercel (front + back)

O [`vercel.json`](vercel.json) declara dois serviços na região `gru1`:

- `front` — build `bun run build` (TanStack Start)
- `back` — `api.app:app` (FastAPI) com `pip install -r requirements.txt`
- Rewrites: `/api/*` → serviço `back`; todo o resto → `front`

### Docker (self-hosted)

- `back/Dockerfile` (python:3.13-slim) — roda `entrypoint.sh` (espera o banco → migrations → seed → uvicorn na porta **8020**, com healthcheck `/health/ready`).
- `front/Dockerfile` (oven/bun) — build + `vite preview` na porta **8010**.
- `gateway/nginx.conf` — gzip, cache de `/assets/*` por 1 ano e proxy same-origin.

---

## Documentação do projeto

| Arquivo | Conteúdo |
|---|---|
| [`docs/Levantamento de Requisistos.pdf`](docs/Levantamento%20de%20Requisistos.pdf) | requisitos funcionais (RF) e regras de negócio (RN) |
| [`docs/fluxo_cliente_agendamento.png`](docs/fluxo_cliente_agendamento.png) | fluxo do cliente |
| [`docs/fluxo_administrador_agendamento.png`](docs/fluxo_administrador_agendamento.png) | fluxo do administrador |
| [`docs/modelagem_banco.sql`](docs/modelagem_banco.sql) | modelagem inicial do banco |
| `back/schema_atualizado.sql` | schema atual completo |
| Swagger (`/docs` em dev) | referência viva da API |

---

*Projeto acadêmico — Ana Clara Nails (RNF02).*
