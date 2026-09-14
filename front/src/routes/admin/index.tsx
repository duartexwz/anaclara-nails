import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AdminShell,
  Card,
  SectionTitle,
  Pill,
  statusTone,
  PrimaryButton,
  GhostButton,
} from "@/components/admin/AdminShell";
import { PaymentModal } from "@/components/admin/PaymentModal";
import { PopupUltimoAgendamento } from "@/components/admin/PopupUltimoAgendamento";
import { useAgenda, type AgendamentoExibicao } from "@/hooks/useAgenda";
import { listarNotificacoesApi } from "@/lib/api";
import { brl } from "@/lib/dados";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  Clock,
  Wallet,
  Sparkles,
  ArrowRight,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// Gráfico pesado (recharts) carregado sob demanda para não pesar a rota.
const GraficoSemana = lazy(() =>
  import("@/components/admin/GraficoSemana").then((m) => ({
    default: m.GraficoSemana,
  })),
);

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — Ana Clara Nails" },
      {
        name: "description",
        content:
          "Visão geral dos horários agendados, sinais recebidos, mensagens e atalhos de gestão (RF19).",
      },
    ],
  }),
  component: Painel,
});

const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Painel() {
  const [pagamento, setPagamento] = useState<AgendamentoExibicao | null>(null);
  const { itens, modelos, isPending, isError } = useAgenda();
  const notificacoesQuery = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => listarNotificacoesApi(),
  });

  const confirmados = itens.filter((a) => a.status === "Confirmado");
  const sinalPendente = itens.filter((a) => a.pagamento === "Aguardando sinal");
  const sinalRecebido = itens
    .filter((a) => a.pagamento !== "Aguardando sinal")
    .reduce((s, a) => s + a.sinal, 0);
  const naoLidas = (notificacoesQuery.data ?? []).filter((n) => !n.lida);
  const primeiroPendente = sinalPendente[0] ?? null;

  const semana = useMemo(() => {
    const contagem = new Array<number>(7).fill(0);
    for (const a of itens) {
      if (!a.dataISO) continue;
      const d = new Date(`${a.dataISO}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      contagem[d.getDay()] = (contagem[d.getDay()] ?? 0) + 1;
    }
    return DIAS_CURTO.map((dia, i) => ({ dia, atendimentos: contagem[i] ?? 0 }));
  }, [itens]);

  const kpis = [
    {
      icone: CalendarDays,
      rotulo: "Agendamentos",
      valor: String(itens.length),
      detalhe: `${confirmados.length} confirmados`,
    },
    {
      icone: Wallet,
      rotulo: "Sinal recebido",
      valor: brl(sinalRecebido),
      detalhe: "50% por agendamento (RN01)",
    },
    {
      icone: Clock,
      rotulo: "Aguardando sinal",
      valor: String(sinalPendente.length),
      detalhe: "confirma após pagamento (RN03)",
    },
    {
      icone: Sparkles,
      rotulo: "Modelos no catálogo",
      valor: String(modelos.length),
      detalhe: `${modelos.length} modelos`,
    },
  ];

  return (
    <AdminShell
      title="Bom dia, Ana Clara"
      subtitle={`${itens.length} agendamento(s) no total`}
      actions={
        <>
          <PrimaryButton>
            <Link to="/admin/agendamentos" className="flex items-center gap-2">
              <CalendarDays className="size-4" /> Ver agendamentos
            </Link>
          </PrimaryButton>
          <GhostButton>
            <Link to="/admin/horarios" className="flex items-center gap-2">
              <Clock className="size-4" /> Ajustar disponibilidade
            </Link>
          </GhostButton>
        </>
      }
    >
      {/* KPIs — RF19 */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isPending
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-3xl" />)
          : kpis.map((k) => (
              <Card key={k.rotulo} className="relative overflow-hidden">
                <span className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-gradient-soft" />
                <k.icone className="size-5 text-primary" />
                <p className="mt-3 font-display text-3xl">{k.valor}</p>
                <p className="text-sm font-medium">{k.rotulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.detalhe}</p>
              </Card>
            ))}
      </section>

      {isError && (
        <Card>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a agenda. Verifique sua conexão e recarregue.
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Agenda — RF19 */}
        <Card>
          <SectionTitle
            title="Próximos agendamentos"
            hint="Horários agendados · refletem alterações em tempo real (RNF05)"
            right={
              <Link
                to="/admin/agendamentos"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Ver todos <ArrowRight className="size-4" />
              </Link>
            }
          />
          <ol className="relative space-y-0 border-l-2 border-dashed border-primary/25 pl-0">
            {itens.slice(0, 4).map((a) => (
              <li key={a.id} className="relative flex gap-4 pb-5 pl-6 last:pb-0">
                <span className="absolute -left-[7px] top-1 size-3 rounded-full bg-gradient-primary ring-4 ring-accent/60" />
                <div className="flex w-14 shrink-0 flex-col">
                  <span className="font-display text-lg leading-none">{a.hora}</span>
                  <span className="text-xs text-muted-foreground">{a.data}</span>
                </div>
                <div className="min-w-0 flex-1 rounded-2xl bg-muted/50 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{a.cliente}</p>
                    <Pill label={a.status} tone={statusTone(a.status)} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {a.modelo} · #{a.id} · sinal {brl(a.sinal)} ({a.pagamento})
                  </p>
                  {a.pagamento === "Aguardando sinal" && (
                    <button
                      onClick={() => setPagamento(a)}
                      className="mt-2 text-xs font-medium text-primary hover:underline"
                    >
                      Registrar pagamento do sinal
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!isPending && itens.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Nenhum agendamento ainda.</p>
          )}
        </Card>

        <div className="space-y-6">
          {/* Alertas operacionais */}
          <Card className="!bg-gradient-soft">
            <SectionTitle title="Precisa da sua atenção" hint="Antecipações, remarcações e sinais" />
            <ul className="space-y-3 text-sm">
              {primeiroPendente ? (
                <li className="flex gap-3 rounded-2xl border border-warning/40 bg-card/80 p-3.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                  <p>
                    <span className="font-medium">{primeiroPendente.cliente}</span> ainda não
                    pagou o sinal de {brl(primeiroPendente.sinal)} (#{primeiroPendente.id}).{" "}
                    <Link
                      to="/admin/agendamentos"
                      className="font-medium text-primary hover:underline"
                    >
                      Ver agendamento
                    </Link>
                  </p>
                </li>
              ) : (
                <li className="rounded-2xl border border-border bg-card/80 p-3.5 text-muted-foreground">
                  Nenhum sinal pendente. Tudo em dia.
                </li>
              )}
              <li className="flex gap-3 rounded-2xl border border-border bg-card/80 p-3.5">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-secondary" />
                <p>
                  <span className="font-medium">{naoLidas.length} mensagem(ns) não lida(s)</span>.{" "}
                  <Link to="/admin/clientes" className="font-medium text-primary hover:underline">
                    Responder
                  </Link>
                </p>
              </li>
            </ul>
          </Card>

          {/* Movimento da semana */}
          <Card>
            <SectionTitle title="Movimento da semana" hint="Atendimentos por dia" />
            <Suspense
              fallback={
                <div className="h-44 animate-pulse rounded-2xl bg-muted/60" />
              }
            >
              <GraficoSemana dados={semana} />
            </Suspense>
          </Card>
        </div>
      </div>

      {/* Atalhos do mapa de páginas */}
      <Card>
        <SectionTitle title="Atalhos de gestão" hint="Mapa de páginas do sistema (seção 8)" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { para: "/admin/agendamentos", titulo: "Agendamentos", texto: "Antecipar e remarcar horários" },
            { para: "/admin/catalogo", titulo: "Gestão de catálogo", texto: "Incluir e editar modelos (POST / PATCH)" },
            { para: "/admin/clientes", titulo: "Controle de clientes", texto: "Moldes e histórico por cliente" },
            { para: "/admin/horarios", titulo: "Dias e horários", texto: "Disponibilidade e bloqueios" },
          ].map((a) => (
            <Link
              key={a.para}
              to={a.para}
              className="group rounded-2xl border border-border bg-background p-4 transition hover:border-primary/50 hover:shadow-card"
            >
              <p className="flex items-center justify-between font-display text-lg">
                {a.titulo}
                <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{a.texto}</p>
            </Link>
          ))}
        </div>
      </Card>

      <PaymentModal
        open={!!pagamento}
        onOpenChange={(o) => !o && setPagamento(null)}
        agendamento={pagamento}
        onConfirmado={(ag) => {
          toast.success(`Sinal de ${ag.cliente} confirmado`);
          setPagamento(null);
        }}
      />
      <PopupUltimoAgendamento itens={itens} />
    </AdminShell>
  );
}
