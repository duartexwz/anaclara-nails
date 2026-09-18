import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminShell,
  Card,
  SectionTitle,
  PrimaryButton,
  GhostButton,
} from "@/components/admin/AdminShell";
import {
  ApiError,
  atualizarProgramacaoApi,
  criarBloqueioApi,
  criarProgramacaoApi,
  excluirBloqueioApi,
  listarAgendamentosApi,
  listarBloqueiosApi,
  listarProgramacaoApi,
  type ProgramacaoApi,
} from "@/lib/api";
import { fmtDataCurta, gerarSlots } from "@/lib/dados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Clock, Ban, Plus, CalendarDays, Info, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { string } from "zod";

export const Route = createFileRoute("/admin/horarios")({
  head: () => ({
    meta: [
      { title: "Dias e horários — Painel Ana Clara Nails" },
      {
        name: "description",
        content:
          "Configuração dos dias e horários disponíveis para atendimento, que viabiliza a seleção de horário (RF27 → RF10).",
      },
    ],
  }),
  component: Horarios,
});

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

type DiaForm = {
  rowId: number | null;
  dia: string;
  ativo: boolean;
  inicio: string;
  fim: string;
  pausa: string;
  intervalo: number;
};

function Horarios() {
  const queryClient = useQueryClient();
  const [bloqueioAberto, setBloqueioAberto] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");
  const [salvandoDia, setSalvandoDia] = useState<string | null>(null);

  const programacaoQuery = useQuery({
    queryKey: ["programacao"],
    queryFn: listarProgramacaoApi,
  });
  const bloqueiosQuery = useQuery({
    queryKey: ["bloqueios"],
    queryFn: listarBloqueiosApi,
  });
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
  });


  function normalizarDia(dia: string | number){
    return String(dia).trim().toLocaleLowerCase();
  }
  const rows = programacaoQuery.data ?? [];
  const porDia = new Map<string, ProgramacaoApi>();
  for (const r of rows) porDia.set(normalizarDia(r.dia_semana), r);

  const dias: DiaForm[] = DIAS.map((dia) => {
    const r = porDia.get(normalizarDia(dia));
    return {
      rowId: r?.id ?? null,
      dia,
      ativo: r ? r.ativo : ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].includes(dia),
      inicio: r?.inicio_expediente?.slice(0, 5) ?? "09:00",
      fim: r?.fim_expediente?.slice(0, 5) ?? "18:00",
      pausa: "",
      intervalo: r?.intervalo_minutos ?? 90,
    };
  });

  const bloqueios = bloqueiosQuery.data ?? [];

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["programacao"] });
    void queryClient.invalidateQueries({ queryKey: ["bloqueios"] });
  };

  const persistirDia = async (d: DiaForm, patch: Partial<DiaForm>) => {
    const proximo = { ...d, ...patch };
    console.log(proximo)
    setSalvandoDia(d.dia);
    try {
      const payload = {
        dia_semana: DIA_PARA_NUMERO[proximo.dia] ?? 0,
        ativo: proximo.ativo,
        inicio_expediente: `${proximo.inicio}:00`.slice(0, 8),
        fim_expediente: `${proximo.fim}:00`.slice(0, 8),
        pausa_duracao: `${proximo.pausa}:00`.slice(0, 8),
        intervalo_minutos: proximo.intervalo,
      };
      if (proximo.rowId == null) {
        await criarProgramacaoApi({ profissional_id: 1, ...payload });
      } else {
        await atualizarProgramacaoApi(proximo.rowId, payload);
      }
      invalidar();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvandoDia(null);
    }
  };

  const slotsPorDia = (d: DiaForm) => {
    if (!d.ativo) return 0;
    const [hi, mi] = d.inicio.split(":").map(Number) as [number, number];
    const [hf, mf] = d.fim.split(":").map(Number) as [number, number];
    if ([hi, mi, hf, mf].some((n) => Number.isNaN(n))) return 0;
    return Math.max(0, Math.floor(((hf * 60 + mf) - (hi * 60 + mi) - 60) / d.intervalo));
  };
  const totalSlots = dias.reduce((s, d) => s + slotsPorDia(d), 0);

  const bloqueioMutation = useMutation({
    mutationFn: () => {
      if (!novaData || !novoMotivo.trim()) {
        throw new ApiError(400, "Informe data e motivo");
      }
      return criarBloqueioApi({ data: novaData, motivo: novoMotivo.trim() });
    },
    onSuccess: () => {
      setNovaData("");
      setNovoMotivo("");
      setBloqueioAberto(false);
      toast.success("Data bloqueada na agenda");
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível bloquear.");
    },
  });

  const removerMutation = useMutation({
    mutationFn: (id: number) => excluirBloqueioApi(id),
    onSuccess: () => {
      toast.success("Bloqueio removido — data liberada");
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível remover.");
    },
  });

  // Prévia real de amanhã
  const amanha = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  })();
  const ocupadosAmanha = new Set(
    (agendamentosQuery.data ?? [])
      .filter((a) => a.data === amanha)
      .map((a) => `${a.data}|${a.horario.slice(0, 8)}`),
  );
  const DIA_PARA_NUMERO: Record<string, number> = {
  Domingo: 0,
  Segunda: 1,
  Terça: 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
  Sabado: 6,
  Sábado: 6,
};

const programacoes: ProgramacaoApi[] = dias
  .map((d, i): ProgramacaoApi | null => {

    const diaSemana = DIA_PARA_NUMERO[d.dia];

    if (diaSemana === undefined) {
      return null;
    }

    return {
    id: i,
    profissional_id: 1,
    dia_semana: diaSemana,
    ativo: Boolean(d.ativo),
    inicio_expediente: `${d.inicio}:00`,
    fim_expediente: `${d.fim}:00`,
    pausa_duracao: `${d.pausa}:00`,
    intervalo_minutos: Number(d.intervalo),
    };
  })
  .filter((item): item is ProgramacaoApi => item !== null);

  const previa = gerarSlots(
    programacoes,
    bloqueios,
    ocupadosAmanha,
  ).filter((s) => s.dataISO === amanha);

  return (
    <AdminShell
      title="Dias e horários"
      subtitle="Disponibilidade do atendimento — base para a seleção de horário do cliente (RF27 → RF10)"
      actions={
        <>
          <PrimaryButton>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4" /> {dias.filter((d) => d.ativo).length} dias ativos
            </span>
          </PrimaryButton>
          <GhostButton onClick={() => setBloqueioAberto(true)}>
            <Ban className="size-4" /> Bloquear data
          </GhostButton>
        </>
      }
    >
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { rotulo: "Dias ativos", valor: `${dias.filter((d) => d.ativo).length} / ${dias.length}` },
          { rotulo: "Encaixes por semana", valor: String(totalSlots) },
          { rotulo: "Duração padrão do slot", valor: "90 min" },
        ].map((r) => (
          <Card key={r.rotulo} className="flex items-baseline justify-between">
            <p className="text-sm text-muted-foreground">{r.rotulo}</p>
            <p className="font-display text-2xl text-primary">{r.valor}</p>
          </Card>
        ))}
      </section>

      {/* Grade semanal — RF27 */}
      <Card>
        <SectionTitle
          title="Grade semanal"
          hint="Dias, janelas de atendimento, pausa de almoço e duração do slot — salvos automaticamente"
        />
        {programacaoQuery.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : programacaoQuery.isError ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a grade. Verifique sua conexão.
          </p>
        ) : (
          <ul className="space-y-3">
            {dias.map((d) => (
              <li
                key={d.dia}
                className={`rounded-2xl border p-4 transition ${
                  d.ativo ? "border-border bg-background" : "border-border/60 bg-muted/40 opacity-75"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Switch
                    checked={d.ativo}
                    onCheckedChange={(v) => void persistirDia(d, { ativo: v })}
                  />
                  <p className="w-20 font-display text-lg">
                    {d.dia}
                    {salvandoDia === d.dia && (
                      <span className="ml-2 text-xs text-muted-foreground">salvando…</span>
                    )}
                  </p>
                  {d.ativo ? (
                    <>
                      <CampoHora
                        rotulo="Início"
                        valor={d.inicio}
                        onMudar={(v) => void persistirDia(d, { inicio: v })}
                      />
                      <CampoHora
                        rotulo="Fim"
                        valor={d.fim}
                        onMudar={(v) => void persistirDia(d, { fim: v })}
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Slot</Label>
                        <Select
                          value={String(d.intervalo)}
                          onValueChange={(v) =>
                            void persistirDia(d, { intervalo: Number(v) || 90 })
                          }
                        >
                          <SelectTrigger className="h-10 w-24 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[60, 75, 90, 120].map((m) => (
                              <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                        <Clock className="size-3.5" /> {slotsPorDia(d)} encaixes
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado — sem atendimento</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-accent/60 p-4 text-xs text-accent-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Sem horário livre não há agendamento (RN06): horários já reservados aparecem riscados para a
          cliente na etapa 2 do agendamento.
        </p>
      </Card>

      {/* Bloqueios e exceções */}
      <Card>
        <SectionTitle
          title="Bloqueios e exceções"
          hint="Feriados, cursos e manhãs indisponíveis"
          right={
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setBloqueioAberto(true)}>
              <Plus className="mr-1 size-3.5" /> Novo bloqueio
            </Button>
          }
        />
        {bloqueiosQuery.isPending ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : bloqueios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma data bloqueada.</p>
        ) : (
          <ul className="space-y-3">
            {bloqueios.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-display text-lg">{fmtDataCurta(b.data)}</span>
                  <span className="ml-3 text-muted-foreground">{b.motivo}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={removerMutation.isPending}
                  onClick={() => removerMutation.mutate(b.id)}
                >
                  <Trash2 className="mr-1 size-3.5" /> Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Prévia dos encaixes */}
      <Card className="!bg-gradient-soft">
        <SectionTitle
          title="Prévia dos encaixes de amanhã"
          hint="Como a cliente vê na seleção de horário (RF10)"
        />
        {previa.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem encaixes amanhã (dia fechado ou bloqueado).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {previa.map((h) => (
              <span
                key={h.id}
                className={`rounded-2xl border px-5 py-3 font-display text-lg ${
                  h.ocupado
                    ? "border-border bg-muted text-muted-foreground line-through"
                    : "border-primary/40 bg-card text-primary shadow-card"
                }`}
              >
                {h.hora}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Modal bloqueio */}
      <Dialog open={bloqueioAberto} onOpenChange={setBloqueioAberto}>
        <DialogContent className="max-w-sm rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Bloquear data</DialogTitle>
            <DialogDescription>A data some da seleção de horário do cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                placeholder="Ex.: feriado, curso, compromisso"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <Button
            className="w-full gradient-primary text-primary-foreground"
            disabled={bloqueioMutation.isPending}
            onClick={() => bloqueioMutation.mutate()}
          >
            Bloquear data
          </Button>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function CampoHora({ rotulo, valor, onMudar }: { rotulo: string; valor: string; onMudar: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <Input type="time" value={valor} onChange={(e) => onMudar(e.target.value)} className="h-10 w-28 rounded-xl text-xs" />
    </label>
  );
}
