/**
 * Cliente HTTP da API Ana Clara Nails (FastAPI em /api/v1).
 * Autenticação via cookies httpOnly do backend (credentials: include).
 */

export const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onlineCache: { at: number; value: boolean } | null = null;

export async function isBackendOnline(): Promise<boolean> {
  const agora = Date.now();
  if (onlineCache && agora - onlineCache.at < 10_000) return onlineCache.value;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${API_URL}/openapi.json`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    onlineCache = { at: agora, value: res.ok };
    return res.ok;
  } catch {
    onlineCache = { at: agora, value: false };
    return false;
  }
}

function lerCookie(nome: string): string | null {
  if (typeof document === "undefined") return null;
  const achado = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${nome}=`));
  return achado ? decodeURIComponent(achado.slice(nome.length + 1)) : null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const csrf = lerCookie("csrf_token");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalhe =
      typeof corpo?.detail === "string"
        ? corpo.detail
        : `Erro ${res.status} na API`;
    throw new ApiError(res.status, detalhe);
  }
  if (res.status === 401 && path != "/api/v1/login/auth/refresh"){
    const refreshOk = await fetch(`${API_URL} /api/v1/login/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshOk) return apiFetch(path, init); //Repete a chamada original
  }
  return corpo as T;
}

/* ------------------------------- Auth ------------------------------- */

export type UsuarioApi = {
  id: number;
  email: string;
  type_user_id: number;
};

export async function loginApi(
  email: string,
  senha: string,
): Promise<UsuarioApi> {
  const corpo = new URLSearchParams({ username: email, password: senha });
  const res = await fetch(`${API_URL}/api/v1/login/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  if (!res.ok) {
    throw new ApiError(
      res.status,
      res.status === 401 ? "E-mail ou senha inválidos" : "Falha no login",
    );
  }
  const data = (await res.json()) as { user: UsuarioApi };
  return data.user;
}

export async function logoutApi(): Promise<void> {
  await apiFetch("/api/v1/login/logout/", { method: "POST" }).catch(
    () => undefined,
  );
}

export async function meApi(): Promise<UsuarioApi> {
  const data = await apiFetch<{ user: UsuarioApi }>("/api/v1/login/auth/me");
  return data.user;
}

export async function registerApi(dados: {
  email: string;
  password: string;
}): Promise<{ id: number; email: string }> {
  return apiFetch("/api/v1/usuarios/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarUsuarioApi(
  id: number,
  dados: Partial<{ email: string; password: string }>,
): Promise<UsuarioApi> {
  return apiFetch<UsuarioApi>(`/api/v1/usuarios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export async function recuperarSenhaApi(email: string): Promise<void> {
  await apiFetch("/api/v1/login/recuperar/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function redefinirSenhaApi(
  token: string,
  nova_senha: string,
): Promise<void> {
  await apiFetch("/api/v1/login/redefinir/", {
    method: "POST",
    body: JSON.stringify({ token, nova_senha }),
  });
}

/* ---------------------------- Agendamentos --------------------------- */

export type AgendamentoApi = {
  id: number;
  cliente_id: number;
  modelo_id: number | null;
  horario: string;
  sinal: number;
  status_pagamentos_id: number | null;
  data?: string | null;
};

export async function criarAgendamentoApi(dados: {
  cliente_id: number;
  modelo_id: number;
  horario: string;
  sinal: number;
  data?: string;
}): Promise<AgendamentoApi> {
  return apiFetch<AgendamentoApi>("/api/v1/agendamentos/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function listarAgendamentosApi(): Promise<AgendamentoApi[]> {
  const data = await apiFetch<{ agendamentos: AgendamentoApi[] }>(
    "/api/v1/agendamentos/",
  );
  return data.agendamentos ?? [];
}

export async function atualizarAgendamentoApi(
  id: number,
  dados: Partial<Pick<AgendamentoApi, "horario" | "modelo_id" | "status_pagamentos_id">>,
): Promise<AgendamentoApi> {
  return apiFetch<AgendamentoApi>(`/api/v1/agendamentos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export async function excluirAgendamentoApi(id: number): Promise<void> {
  await apiFetch(`/api/v1/agendamentos/${id}`, { method: "DELETE" });
}

/* ------------------------------- Modelos ----------------------------- */

export type ModeloApi = {
  id: number;
  nome: string;
  descricao: string;
  valor_total: number;
  categoria: string;
  duracao: string;
  imagem_url?: string | null;
  ativo?: boolean | null;
  destaque?: boolean | null;
};

export async function listarModelosApi(): Promise<ModeloApi[]> {
  const data = await apiFetch<{ modelos_unhas: ModeloApi[] }>(
    "/api/v1/modelos-unhas/",
  );
  return data.modelos_unhas ?? [];
}

export async function criarModeloApi(dados: {
  nome: string;
  descricao: string;
  valor_total: number;
  categoria: string;
  duracao: string;
  ativo?: boolean;
  destaque?: boolean;
}): Promise<ModeloApi> {
  return apiFetch<ModeloApi>("/api/v1/modelos-unhas/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarModeloApi(
  id: number,
  dados: Partial<{
    nome: string;
    descricao: string;
    valor_total: number;
    categoria: string;
    duracao: string;
    imagem_url: string | null;
    ativo: boolean;
    destaque: boolean;
  }>,
): Promise<ModeloApi> {
  return apiFetch<ModeloApi>(`/api/v1/modelos-unhas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export async function excluirModeloApi(id: number): Promise<void> {
  await apiFetch(`/api/v1/modelos-unhas/${id}`, { method: "DELETE" });
}

export async function uploadFotoModeloApi(
  id: number,
  arquivo: File,
): Promise<{ imagem_url: string }> {
  const form = new FormData();
  form.append("arquivo", arquivo);
  const res = await fetch(`${API_URL}/api/v1/uploads/modelos/${id}`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new ApiError(res.status, "Falha no upload da foto");
  return (await res.json()) as { imagem_url: string };
}

/* ------------------------------- Clientes ---------------------------- */

export type ClienteApi = {
  id: number;
  nome: string;
  telefone: string;
  email_id?: number | null;
  molde?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null;
  pref_app?: boolean | null;
  pref_email?: boolean | null;
  pref_whatsapp?: boolean | null;
};

export async function listarClientesApi(params?: {
  nome?: string;
  telefone?: string;
}): Promise<ClienteApi[]> {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v != null && v !== ""),
    ),
  ).toString();
  const data = await apiFetch<{ clientes: ClienteApi[] }>(
    `/api/v1/clientes/${qs ? `?${qs}` : ""}`,
  );
  return data.clientes ?? [];
}

export async function criarClienteApi(dados: {
  nome: string;
  telefone: string;
  email_id?: number | null;
}): Promise<ClienteApi> {
  return apiFetch<ClienteApi>("/api/v1/clientes/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarClienteApi(
  id: number,
  dados: Partial<
    Pick<
      ClienteApi,
      | "nome"
      | "telefone"
      | "molde"
      | "cpf"
      | "data_nascimento"
      | "pref_app"
      | "pref_email"
      | "pref_whatsapp"
    >
  >,): Promise<ClienteApi> {
  return apiFetch<ClienteApi>(`/api/v1/clientes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

/* --------------------------- Disponibilidade ------------------------- */

export type ProgramacaoApi = {
  id: number;
  profissional_id: number;
  dia_semana: string;
  ativo: boolean;
  inicio_expediente: string;
  fim_expediente: string;
  pausa_duracao: string;
  intervalo_minutos?: number | null;
};

export async function listarProgramacaoApi(): Promise<ProgramacaoApi[]> {
  const data = await apiFetch<{ programacoes_semanais: ProgramacaoApi[] }>(
    "/api/v1/programacao-semanal/",
  );
  return data.programacoes_semanais ?? [];
}

export async function criarProgramacaoApi(dados: {
  profissional_id: number;
  dia_semana: string;
  ativo: boolean;
  inicio_expediente: string;
  fim_expediente: string;
  intervalo_minutos?: number | null;
}): Promise<ProgramacaoApi> {
  return apiFetch<ProgramacaoApi>("/api/v1/programacao-semanal/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function atualizarProgramacaoApi(
  id: number,
  dados: Partial<
    Pick<
      ProgramacaoApi,
      | "dia_semana"
      | "ativo"
      | "inicio_expediente"
      | "fim_expediente"
      | "pausa_duracao"
      | "intervalo_minutos"
    >
  >,
): Promise<ProgramacaoApi> {
  return apiFetch<ProgramacaoApi>(`/api/v1/programacao-semanal/${id}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });
}

export type BloqueioApi = { id: number; data: string; motivo: string };

export async function listarBloqueiosApi(): Promise<BloqueioApi[]> {
  const data = await apiFetch<{ bloqueios: BloqueioApi[] }>(
    "/api/v1/bloqueios/",
  );
  return data.bloqueios ?? [];
}

export async function criarBloqueioApi(dados: {
  data: string;
  motivo: string;
}): Promise<BloqueioApi> {
  return apiFetch<BloqueioApi>("/api/v1/bloqueios/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function excluirBloqueioApi(id: number): Promise<void> {
  await apiFetch(`/api/v1/bloqueios/${id}`, { method: "DELETE" });
}

/* ------------------------------ Mensagens ---------------------------- */

export type MensagemApi = {
  id: number;
  agendamento_id?: number | null;
  remetente: string;
  texto: string;
  lida: boolean;
};

export async function listarMensagensApi(): Promise<MensagemApi[]> {
  const data = await apiFetch<{ mensagens: MensagemApi[] }>(
    "/api/v1/mensagens/?limit=50",
  );
  return data.mensagens ?? [];
}

export async function enviarMensagemApi(dados: {
  texto: string;
  agendamento_id?: number | null;
  remetente: string;
}): Promise<MensagemApi> {
  return apiFetch<MensagemApi>("/api/v1/mensagens/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

/* -------------------------------- Status ----------------------------- */

export async function listarStatusApi(): Promise<
  { id: number; nome: string }[]
> {
  try {
    const data = await apiFetch<{ status_pagamentos: { id: number; nome: string }[] }>(
      "/api/v1/status-pagamentos/",
    );
    return data.status_pagamentos ?? [];
  } catch {
    return [];
  }
}

/* ----------------------------- Pagamentos ---------------------------- */

export type PagamentoBrickPayload = {
  agendamento_id: number;
  transaction_amount: number;
  token?: string;
  issuer_id?: string;
  payment_method_id: string;
  installments: number;
  payer: {
    name?: string;
    surname?: string;
    email: string;
    identification?: { type: string; number: string };
  };
  description?: string;
};

export type PagamentoApi = {
  id: number;
  status: string;
  status_detail?: string | null;
  agendamento_id: number;
  status_pagamentos_id?: number | null;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
};

export async function criarPagamentoApi(
  dados: PagamentoBrickPayload,
): Promise<PagamentoApi> {
  return apiFetch<PagamentoApi>("/api/v1/pagamentos/", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export async function consultarPagamentoApi(
  paymentId: number,
): Promise<PagamentoApi> {
  return apiFetch<PagamentoApi>(`/api/v1/pagamentos/${paymentId}`);
}

export async function getPublicKeyApi(): Promise<string | null> {
  try {
    const data = await apiFetch<{ public_key: string }>(
      "/api/v1/pagamentos/public-key",
    );
    return data.public_key || null;
  } catch {
    return null;
  }
}

/* ---------------------------- Notificações --------------------------- */

export type NotificacaoApi = {
  id: number;
  tipo: "agendamento" | "cancelamento" | "pagamento" | "mensagem";
  titulo: string;
  mensagem: string;
  agendamento_id?: number | null;
  lida: boolean;
  created_at?: string;
};

export async function listarNotificacoesApi(
  somenteNaoLidas = false,
): Promise<NotificacaoApi[]> {
  const qs = somenteNaoLidas ? "?lida=false" : "";
  const data = await apiFetch<{ notificacoes: NotificacaoApi[] }>(
    `/api/v1/notificacoes/${qs}`,
  );
  return data.notificacoes ?? [];
}

export async function marcarNotificacaoLidaApi(id: number): Promise<void> {
  await apiFetch(`/api/v1/notificacoes/${id}/lida`, { method: "PATCH" });
}

export async function marcarTodasLidasApi(): Promise<void> {
  await apiFetch("/api/v1/notificacoes/lidas", { method: "PATCH" });
}

/* ------------------------------- Push -------------------------------- */

export async function getVapidKeyApi(): Promise<string | null> {
  try {
    const data = await apiFetch<{ public_key: string | null }>(
      "/api/v1/push/vapid-key",
    );
    return data.public_key || null;
  } catch {
    return null;
  }
}

export async function salvarPushSubscriptionApi(dados: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  await apiFetch("/api/v1/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}
