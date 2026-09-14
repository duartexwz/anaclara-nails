import type { ModeloApi, ProgramacaoApi, BloqueioApi } from "./api";

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

export function brl(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "01:30:00" -> "1h30" · "00:45:00" -> "45min" */
export function fmtDuracao(hms: string | null | undefined): string {
  if (!hms) return "—";
  const [h = "0", m = "0"] = hms.split(":");
  const horas = Number(h ?? "0");
  const minutos = Number(m ?? "0");
  if (horas > 0 && minutos > 0) return `${horas}h${String(minutos).padStart(2, "0")}`;
  if (horas > 0) return `${horas}h`;
  return `${minutos}min`;
}

/** "1h30" | "1h" | "45min" | "90" -> "01:30:00" (formato TIME da API) */
export function duracaoParaApi(texto: string): string | null {
  const t = texto.trim().toLowerCase().replace(",", ".");
  if (!t) return null;
  let minutos = 0;
  const hMatch = t.match(/(\d+(?:\.\d+)?)\s*h/);
  const mMatch = t.match(/(\d+(?:\.\d+)?)\s*min/);
  if (hMatch) minutos += Math.round(parseFloat(hMatch[1]!) * 60);
  if (mMatch) minutos += Math.round(parseFloat(mMatch[1]!));
  if (!hMatch && !mMatch) {
    const n = Number(t);
    if (Number.isNaN(n) || n <= 0) return null;
    minutos = Math.round(n);
  }
  if (minutos <= 0) return null;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** "14:00:00" -> "14:00" */
export function fmtHora(hms: string | null | undefined): string {
  if (!hms) return "—";
  return hms.slice(0, 5);
}

/** "2026-09-20" -> "20/09" */
export function fmtDataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  if (!a || !m || !d) return iso;
  return `${d}/${m}`;
}

/* ------------------------------------------------------------------ */
/* Catálogo (RF04–RF06, RF09 · RF20–RF22 no admin)                       */
/* ------------------------------------------------------------------ */

export type Modelo = {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  duracao: string;
  categoria: string;
  imagem?: string | null;
  ativo: boolean;
  destaque: boolean;
};

export const categorias = ["Todos", "Clássicas", "Nail art", "Festa", "Noivas"] as const;

export function mapModeloApi(m: ModeloApi): Modelo {
  return {
    id: m.id,
    nome: m.nome,
    descricao: m.descricao,
    preco: m.valor_total,
    duracao: fmtDuracao(m.duracao),
    categoria: m.categoria,
    imagem: m.imagem_url ?? null,
    ativo: m.ativo ?? true,
    destaque: m.destaque ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* Status (RF14) — nomes do backend → rótulos exibidos                   */
/* ------------------------------------------------------------------ */

export const statusEstilo: Record<string, string> = {
  Confirmado: "border-success/40 bg-success/10 text-success",
  "Aguardando sinal": "border-warning/50 bg-warning/15 text-warning-foreground",
  Remarcado: "border-warning/50 bg-warning/15 text-warning-foreground",
  Antecipado: "border-primary/40 bg-primary/10 text-primary",
  Concluído: "border-success/40 bg-success/10 text-success",
  Cancelado: "border-destructive/40 bg-destructive/10 text-destructive",
  Pendente: "border-warning/50 bg-warning/15 text-warning-foreground",
};

export type StatusAgendamento =
  | "Confirmado"
  | "Aguardando sinal"
  | "Remarcado"
  | "Antecipado"
  | "Concluído"
  | "Cancelado";

export const STATUS_API_PARA_EXIBICAO: Record<string, StatusAgendamento> = {
  Pendente: "Aguardando sinal",
  Pago: "Confirmado",
  Cancelado: "Cancelado",
};

export function statusExibicao(nomeBackend: string | null | undefined): StatusAgendamento {
  if (!nomeBackend) return "Aguardando sinal";
  return STATUS_API_PARA_EXIBICAO[nomeBackend] ?? "Aguardando sinal";
}

/* ------------------------------------------------------------------ */
/* Slots de horário (RF10) — gerados da programação + bloqueios         */
/* ------------------------------------------------------------------ */

export type Slot = {
  id: string;
  dataISO: string;
  dataCurta: string;
  dia: string;
  hora: string;
  ocupado: boolean;
};

const DIAS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function normalizarDia(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function paraMinutos(hms: string): number | null {
  const [h, m] = hms.split(":").map(Number);
  const hh = h ?? NaN;
  const mm = m ?? NaN;
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function paraHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/**
 * Gera slots dos próximos 21 dias a partir da programação semanal,
 * removendo datas bloqueadas e horários passados. `ocupados` contém
 * chaves "YYYY-MM-DD|HH:MM:SS" já reservados (RN06).
 */
export function gerarSlots(
  programacao: ProgramacaoApi[],
  bloqueios: BloqueioApi[],
  ocupados: Set<string>,
  dias = 21,
): Slot[] {
  const datasBloqueadas = new Set(bloqueios.map((b) => b.data.slice(0, 10)));
  const agora = new Date();
  const slots: Slot[] = [];

  for (let d = 0; d < dias; d++) {
    const data = new Date(agora);
    data.setDate(data.getDate() + d);
    const iso = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
      data.getDate(),
    ).padStart(2, "0")}`;
    if (datasBloqueadas.has(iso)) continue;

    const diaNome = DIAS_PT[data.getDay()]!;
    const regras = programacao.filter(
      (p) => p.ativo && normalizarDia(p.dia_semana) === normalizarDia(diaNome),
    );
    for (const r of regras) {
      const inicio = paraMinutos(r.inicio_expediente);
      const fim = paraMinutos(r.fim_expediente);
      if (inicio == null || fim == null || fim <= inicio) continue;
      const passo = r.intervalo_minutos && r.intervalo_minutos > 0 ? r.intervalo_minutos : 90;
      for (let t = inicio; t + 30 <= fim; t += passo) {
        const hora = paraHora(t);
        const dt = new Date(data);
        const [hh, mm] = hora.split(":").map(Number);
        dt.setHours(hh!, mm!, 0, 0);
        if (dt <= agora) continue;
        const id = `${iso}|${hora}`;
        slots.push({
          id,
          dataISO: iso,
          dataCurta: fmtDataCurta(iso),
          dia: DIAS_CURTO[data.getDay()]!,
          hora: hora.slice(0, 5),
          ocupado: ocupados.has(id),
        });
      }
    }
  }
  return slots;
}
