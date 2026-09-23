import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AdminShell,
  Card,
  SectionTitle,
  Pill,
  statusTone,
  PrimaryButton,
  GhostButton,
} from "@/components/admin/AdminShell";
import { useAgenda, type AgendamentoExibicao } from "@/hooks/useAgenda";
import { ApiError, enviarMensagemApi, excluirAgendamentoApi } from "@/lib/api";
import { brl } from "@/lib/dados";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  CalendarClock,
  XCircle,
  CheckCircle2,
  Search,
  Send,
  Users,
  ArrowRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/agendamentos")({
  head: () => ({
    meta: [
      { title: "Agendamentos — Painel Ana Clara Nails" },
      {
        name: "description",
        content:
          "Antecipe e remarque horários com mensagem ao cliente; recusa aciona o próximo da fila (RF23, RF24, RF25).",
      },
    ],
  }),
  component: Agendamentos,
});

const filtros = ["Todos", "Confirmado", "Aguardando sinal", "Remarcado", "Concluído", "Cancelado"] as const;

function Agendamentos() {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<(typeof filtros)[number]>("Todos");
  const [busca, setBusca] = useState("");
  const [antecipar, setAntecipar] = useState<AgendamentoExibicao | null>(null);
  const [remarcar, setRemarcar] = useState<AgendamentoExibicao | null>(null);
  const [cancelar, setCancelar] = useState<AgendamentoExibicao | null>(null);
  const [etapaAntecipacao, setEtapaAntecipacao] = useState<"mensagem" | "aguardando" | "recusou">("mensagem");
  const [filaIdx, setFilaIdx] = useState(0);
  const [msgAntecipar, setMsgAntecipar] = useState("");
  const [msgRemarcar, setMsgRemarcar] = useState("");
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  const { itens, isPending, isError } = useAgenda();

  const lista = itens.filter(
    (a) =>
      (filtro === "Todos" || a.status === filtro) &&
      (busca === "" ||
        a.cliente.toLowerCase().includes(busca.toLowerCase()) ||
        String(a.id).includes(busca)),
  );
  const fila = [...itens].sort((a, b) => a.id - b.id);

  const recarregar = () => {
    void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
    void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    toast.success("Agenda atualizada");
  };

  const enviarMutation = useMutation({
    mutationFn: (dados: { texto: string; agendamento_id: number }) =>
      enviarMensagemApi({ ...dados, remetente: "admin" }),
    onSuccess: (_r, v) => {
      void queryClient.invalidateQueries({ queryKey: ["mensagens"] });
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      if (v.texto.startsWith("ANTECIPAR::")) setEtapaAntecipacao("aguardando");
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar.");
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: (id: number) => excluirAgendamentoApi(id),
    onSuccess: () => {
      toast.success("Agendamento cancelado. O cliente foi avisado no mural.");
      setCancelar(null);
      void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível cancelar.");
    },
  });

  const abrirAntecipar = (a: AgendamentoExibicao) => {
    setAntecipar(a);
    setEtapaAntecipacao("mensagem");
    setFilaIdx(0);
    setMsgAntecipar(
      `Oi, ${a.cliente.split(" ")[0]}! Surgiu um encaixe — você conseguiria antecipar seu horário de ${a.data} às ${a.hora}? Me confirma por aqui, por favor.`,
    );
  };

  const abrirRemarcar = (a: AgendamentoExibicao) => {
    setRemarcar(a);
    setNovaData("");
    setNovaHora("");
    setMsgRemarcar(
      `Oi, ${a.cliente.split(" ")[0]}! Precisamos remarcar seu horário de ${a.data} às ${a.hora}. Me diz uma nova data que funcione pra você?`,
    );
  };

  const enviarAntecipacao = () => {
    if (!antecipar || !msgAntecipar.trim()) {
      toast.error("Escreva a mensagem antes de enviar.");
      return;
    }
    enviarMutation.mutate({
      texto: `ANTECIPAR::${msgAntecipar.trim()}`,
      agendamento_id: antecipar.id,
    });
  };

  const enviarRemarcacao = () => {
    if (!remarcar || !msgRemarcar.trim()) {
      toast.error("Escreva a mensagem antes de enviar.");
      return;
    }
    const sugestao =
      novaData && novaHora ? ` (Sugestão: ${novaData} às ${novaHora})` : "";
    enviarMutation.mutate({
      texto: `REMARCAR::${msgRemarcar.trim()}${sugestao}`,
      agendamento_id: remarcar.id,
    });
    toast.success("Pedido de remarcação enviado ao cliente");
    setRemarcar(null);
  };

  return (
    <AdminShell
      title="Agendamentos"
      subtitle="Antecipação e remarcação de horários com mensagem ao cliente (RF23 · RF24 · RF25)"
      actions={
        <>
          <PrimaryButton onClick={recarregar}>
            <RefreshCw className="size-4" /> Atualizar agenda
          </PrimaryButton>
        </>
      }
    >
      {/* Filtros + busca */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou protocolo (ex.: 1042)"
              className="h-11 rounded-2xl pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filtros.map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  filtro === f
                    ? "border-primary bg-gradient-primary text-primary-foreground shadow-soft"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabela de agendamentos — RF19 */}
      <Card className="!p-0 overflow-hidden">
        {isPending ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Não foi possível carregar a agenda. Verifique sua conexão.
          </p>
        ) : (
          <>
            {/* Mobile: cards sem scroll lateral */}
            <ul className="space-y-3 p-4 md:hidden">
              {lista.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl border border-border/70 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.cliente}</p>
                      <p className="text-xs text-muted-foreground">
                        #{a.id} · {a.telefone}
                      </p>
                    </div>
                    <Pill label={a.status} tone={statusTone(a.status)} />
                  </div>
                  <p className="mt-2 truncate text-sm text-muted-foreground">{a.modelo}</p>
                  <p className="mt-1 font-display text-lg leading-tight">
                    {a.data} · {a.hora}
                  </p>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {brl(a.sinal)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {a.pagamento}
                    </span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-secondary/50 text-primary hover:bg-accent"
                      onClick={() => abrirAntecipar(a)}
                    >
                      <Zap className="mr-1 size-3.5" /> Antecipar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => abrirRemarcar(a)}
                    >
                      <CalendarClock className="mr-1 size-3.5" /> Remarcar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-4 py-4 font-medium">Modelo</th>
                  <th className="px-4 py-4 font-medium">Horário</th>
                  <th className="px-4 py-4 font-medium">Sinal</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <p className="font-medium">{a.cliente}</p>
                      <p className="text-xs text-muted-foreground">
                        #{a.id} · {a.telefone}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{a.modelo}</td>
                    <td className="px-4 py-4">
                      <span className="font-display text-base">
                        {a.data} · {a.hora}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-primary">{brl(a.sinal)}</p>
                      <p className="text-xs text-muted-foreground">{a.pagamento}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Pill label={a.status} tone={statusTone(a.status)} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-secondary/50 text-primary hover:bg-accent"
                          onClick={() => abrirAntecipar(a)}
                        >
                          <Zap className="mr-1 size-3.5" /> Antecipar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => abrirRemarcar(a)}
                        >
                          <CalendarClock className="mr-1 size-3.5" /> Remarcar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Cancelar agendamento"
                          onClick={() => setCancelar(a)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Cancelar</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        {!isPending && !isError && lista.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nenhum agendamento com esse filtro.
          </p>
        )}
      </Card>

      {/* Fila de antecipação — RN04 */}
      <Card className="!bg-gradient-soft">
        <SectionTitle
          title="Fila de antecipação"
          hint="Se o cliente recusar, o sistema notifica automaticamente o próximo mais próximo (RF24 · RN04)"
          right={<Badge className="bg-card text-primary">RN04 ativa</Badge>}
        />
        {fila.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem agendamentos na fila.</p>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3">
            {fila.slice(0, 6).map((f, i) => (
              <li
                key={f.id}
                className={`rounded-2xl border p-4 ${
                  i < filaIdx
                    ? "border-border bg-muted text-muted-foreground"
                    : i === filaIdx
                      ? "border-primary bg-card shadow-card"
                      : "border-border bg-card/70"
                }`}
              >
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Users className="size-3.5" /> {i < filaIdx ? "Já notificado" : `${i + 1}º da fila`}
                </p>
                <p className="mt-1.5 font-medium">{f.cliente}</p>
                <p className="text-xs text-muted-foreground">
                  #{f.id} · {f.data} · {f.hora}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Modal Antecipar — RF23/RF24 */}
      <Dialog open={!!antecipar} onOpenChange={(o) => !o && setAntecipar(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <Zap className="size-5 text-secondary" /> Antecipar #{antecipar?.id}
            </DialogTitle>
            <DialogDescription>
              O sistema envia mensagem perguntando sobre a disponibilidade (RF23).
            </DialogDescription>
          </DialogHeader>

          {etapaAntecipacao === "mensagem" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="text-muted-foreground">
                  {antecipar?.cliente} · {antecipar?.data} às {antecipar?.hora}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Mensagem ao cliente</Label>
                <Textarea
                  rows={3}
                  value={msgAntecipar}
                  onChange={(e) => setMsgAntecipar(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <Button
                className="w-full gradient-primary text-primary-foreground"
                disabled={enviarMutation.isPending}
                onClick={enviarAntecipacao}
              >
                <Send className="mr-2 size-4" /> Enviar e aguardar resposta
              </Button>
            </div>
          )}

          {etapaAntecipacao === "aguardando" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                Mensagem enviada para <span className="font-medium">{antecipar?.cliente}</span>.
                Aguardando a resposta no painel de mensagens.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="border-success/40 text-success hover:bg-success/10"
                  onClick={() => {
                    toast.success("Resposta registrada como aceita");
                    setAntecipar(null);
                  }}
                >
                  <CheckCircle2 className="mr-1 size-4" /> Aceitou
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => setEtapaAntecipacao("recusou")}
                >
                  <XCircle className="mr-1 size-4" /> Recusou
                </Button>
              </div>
            </div>
          )}

          {etapaAntecipacao === "recusou" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/30 bg-accent/50 p-4 text-sm">
                <p className="font-medium text-accent-foreground">Recusa registrada (RF24 · RN04)</p>
                <p className="mt-1 text-accent-foreground/80">
                  Próximo da fila a notificar:{" "}
                  <span className="font-medium">
                    {fila[Math.min(filaIdx + 1, fila.length - 1)]?.cliente ?? "—"}
                  </span>
                  .
                </p>
              </div>
              <Button
                className="w-full gradient-primary text-primary-foreground"
                onClick={() => {
                  setFilaIdx((i) => Math.min(i + 1, Math.max(fila.length - 1, 0)));
                  toast.success("Convite enviado ao próximo cliente da fila");
                  setAntecipar(null);
                }}
              >
                Notificar próximo da fila <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Remarcar — RF25 */}
      <Dialog open={!!remarcar} onOpenChange={(o) => !o && setRemarcar(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <CalendarClock className="size-5 text-secondary" /> Remarcar #{remarcar?.id}
            </DialogTitle>
            <DialogDescription>
              Envie mensagem solicitando nova data disponível. O agendamento atualiza quando o cliente
              responde (RF25).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted/60 p-4 text-sm">
              <p className="text-muted-foreground">
                {remarcar?.cliente} · atual: {remarcar?.data} às {remarcar?.hora}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nova data (sugestão)</Label>
                <Input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Novo horário</Label>
                <Input
                  type="time"
                  value={novaHora}
                  onChange={(e) => setNovaHora(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem ao cliente</Label>
              <Textarea
                rows={3}
                value={msgRemarcar}
                onChange={(e) => setMsgRemarcar(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-3">
              <GhostButton className="flex-1" onClick={() => setRemarcar(null)}>
                Cancelar
              </GhostButton>
              <PrimaryButton
                className="flex-1"
                onClick={enviarRemarcacao}
              >
                <Send className="size-4" /> Enviar pedido
              </PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar */}
      <Dialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 font-display text-xl sm:text-2xl">
              <Trash2 className="size-5 text-destructive" /> Cancelar #{cancelar?.id}?
            </DialogTitle>
            <DialogDescription>
              {cancelar?.cliente} · {cancelar?.data} às {cancelar?.hora}. O cliente
              é avisado no mural e o horário volta a ficar livre.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 min-[420px]:flex-row">
            <GhostButton className="flex-1" onClick={() => setCancelar(null)}>
              Manter
            </GhostButton>
            <Button
              className="flex-1 rounded-2xl bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90"
              disabled={cancelarMutation.isPending}
              onClick={() => cancelar && cancelarMutation.mutate(cancelar.id)}
            >
              {cancelarMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
