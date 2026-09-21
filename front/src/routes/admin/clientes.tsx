import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminShell,
  Card,
  SectionTitle,
} from "@/components/admin/AdminShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Fingerprint, History, MessageCircle, Search, Save, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  atualizarClienteApi,
  enviarMensagemApi,
  listarAgendamentosApi,
  listarClientesApi,
  listarMensagensApi,
  listarModelosApi,
  type ClienteApi,
} from "@/lib/api";
import { brl, fmtDataCurta, mapModeloApi } from "@/lib/dados";
import { formatarTelefoneExibicao } from "@/lib/masks";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Controle de clientes — Painel Ana Clara Nails" },
      {
        name: "description",
        content:
          "Cadastro de molde por cliente, histórico de agendamentos e mensagens (RF26, RF28, RF16).",
      },
    ],
  }),
  component: ControleClientes,
});

const formatos = ["Amendoada", "Quadrada", "Oval", "Bailarina", "Stiletto"];
const tamanhos = ["PP", "P", "S", "M", "L"];

function ControleClientes() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null);
  const [moldeAberto, setMoldeAberto] = useState(false);
  const [molde, setMolde] = useState("");
  const [mensagem, setMensagem] = useState("");

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientesApi(),
  });
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
  });
  const modelosQuery = useQuery({ queryKey: ["modelos"], queryFn: listarModelosApi });
  const mensagensQuery = useQuery({
    queryKey: ["mensagens"],
    queryFn: listarMensagensApi,
    refetchInterval: 5000,
  });

  const clientes = clientesQuery.data ?? [];
  const lista = clientes.filter(
    (c) =>
      busca === "" ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone.includes(busca),
  );

  const selecionada: ClienteApi | null =
    lista.find((c) => c.id === selecionadaId) ?? lista[0] ?? null;

  useEffect(() => {
    if (selecionada) setMolde(selecionada.molde ?? "");
  }, [selecionada?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const modelos = (modelosQuery.data ?? []).map(mapModeloApi);
  const nomeModelo = (id: number | null) =>
    modelos.find((m) => m.id === id)?.nome ?? "Modelo";

  const historico = (agendamentosQuery.data ?? [])
    .filter((a) => selecionada && a.cliente_id === selecionada.id && a.data)
    .sort((a, b) => (a.data! < b.data! ? 1 : -1));
  const hojeISO = new Date().toISOString().slice(0, 10);
  const proximo =
    [...historico]
      .reverse()
      .find((a) => a.data! >= hojeISO) ?? null;

  const conversa = (mensagensQuery.data ?? []).filter((m) => {
    if (!selecionada) return false;
    const ag = (agendamentosQuery.data ?? []).find((a) => a.id === m.agendamento_id);
    return ag?.cliente_id === selecionada.id;
  });

  const salvarMoldeMutation = useMutation({
    mutationFn: () => {
      if (!selecionada) throw new ApiError(400, "Selecione uma cliente.");
      return atualizarClienteApi(selecionada.id, { molde: molde.trim() || null });
    },
    onSuccess: () => {
      toast.success(
        `Molde de ${selecionada?.nome.split(" ")[0]} atualizado (RN05)`,
      );
      setMoldeAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar o molde.");
    },
  });

  const enviarMutation = useMutation({
    mutationFn: (texto: string) =>
      enviarMensagemApi({ texto, remetente: "admin" }),
    onSuccess: () => {
      setMensagem("");
      toast.success("Mensagem enviada");
      void queryClient.invalidateQueries({ queryKey: ["mensagens"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar.");
    },
  });

  const iniciais = (nome: string) =>
    nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  const carregando = clientesQuery.isPending;

  return (
    <AdminShell
      title="Controle de clientes"
      subtitle="Moldes de unha, histórico por cliente e mensagens (RF26 · RF28 · RF16)"
    >
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr_22rem]">
        {/* Lista */}
        <Card className="!p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente"
              className="h-11 rounded-2xl pl-10"
            />
          </div>
          {clientesQuery.isPending ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : clientesQuery.isError ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Não foi possível carregar as clientes.
            </p>
          ) : lista.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma cliente cadastrada ainda.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {lista.map((c) => {
                const qtd = (agendamentosQuery.data ?? []).filter(
                  (a) => a.cliente_id === c.id,
                ).length;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelecionadaId(c.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selecionada?.id === c.id
                          ? "border-primary bg-accent/60 shadow-card"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Avatar className="bg-gradient-primary text-primary-foreground">
                        <AvatarFallback className="bg-transparent text-primary-foreground">
                          {iniciais(c.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {qtd} atendimento(s)
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Ficha */}
        <div className="space-y-6">
          {carregando ? (
            <Skeleton className="h-64 rounded-3xl" />
          ) : !selecionada ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Cadastre a primeira cliente para começar o controle.
              </p>
            </Card>
          ) : (
            <>
              <Card>
                <SectionTitle
                  title={selecionada.nome}
                  hint={`Cliente #${selecionada.id}`}
                />
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-3">
                    <Phone className="size-4 shrink-0 text-primary" /> {formatarTelefoneExibicao(selecionada.telefone)}
                  </p>
                </div>
                {proximo?.data && (
                  <p className="mt-3 rounded-2xl border border-primary/30 bg-accent/50 px-4 py-3 text-sm text-accent-foreground">
                    Próximo horário:{" "}
                    <span className="font-medium">
                      {fmtDataCurta(proximo.data)} às {proximo.horario.slice(0, 5)}
                    </span>
                  </p>
                )}

                {/* Molde — RF26/RN05 */}
                <div className="mt-4 rounded-3xl border border-secondary/30 bg-gradient-soft p-5">
                  <p className="flex items-center gap-2 font-display text-lg">
                    <Fingerprint className="size-5 text-primary" /> Molde da unha
                  </p>
                  <p className="mt-1.5 text-sm">{selecionada.molde || "Ainda não registrado"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Atualizado exclusivamente pela profissional (RN05).
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 gradient-primary text-primary-foreground"
                    onClick={() => setMoldeAberto(true)}
                  >
                    Editar molde
                  </Button>
                </div>
              </Card>

              {/* Histórico — RF28 */}
              <Card>
                <SectionTitle
                  title="Histórico de atendimentos"
                  hint="Consulta por cliente (RF28) — base para o molde e a próxima sugestão"
                />
                {historico.length === 0 ? (
                  <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                    Nenhum atendimento registrado ainda.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {historico.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm"
                      >
                        <span>
                          <span className="font-medium">{nomeModelo(h.modelo_id)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {fmtDataCurta(h.data)} · {h.horario.slice(0, 5)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <History className="size-3.5 text-muted-foreground" />
                          <span className="font-display text-base text-primary">{brl(h.sinal)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                  <div className="rounded-2xl bg-muted/60 p-3">
                    <p className="font-display text-xl">{historico.length}</p>
                    <p className="text-xs text-muted-foreground">atendimentos</p>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-3">
                    <p className="font-display text-base">
                      {fmtDataCurta(historico[0]?.data)}
                    </p>
                    <p className="text-xs text-muted-foreground">última visita</p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Mensagens — RF16 */}
        <Card className="flex flex-col">
          <SectionTitle title="Mensagens" hint="Antecipação e remarcação (RF16 · RNF06)" />
          <div className="flex-1 space-y-3">
            {!selecionada ? (
              <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                Selecione uma cliente para ver a conversa.
              </p>
            ) : conversa.length === 0 ? (
              <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                Nenhuma mensagem com {selecionada.nome.split(" ")[0]} ainda. Toda antecipação ou
                remarcação passa por aqui.
              </p>
            ) : (
              conversa.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[90%] rounded-2xl p-3.5 text-sm ${
                    m.remetente === "admin"
                      ? "ml-auto bg-gradient-primary text-primary-foreground shadow-soft"
                      : "bg-muted/70"
                  }`}
                >
                  <p className="mt-1">{m.texto}</p>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 space-y-2">
            <div className="space-y-1.5">
              <Label>Escrever para {selecionada?.nome.split(" ")[0] ?? "..."}</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={2}
                placeholder="Antecipar, remarcar, cobrar sinal..."
                className="rounded-xl"
                disabled={!selecionada}
              />
            </div>
            <Button
              className="w-full gradient-primary text-primary-foreground"
              disabled={!selecionada || enviarMutation.isPending}
              onClick={() => {
                if (!mensagem.trim()) {
                  toast.error("Escreva a mensagem antes de enviar");
                  return;
                }
                enviarMutation.mutate(mensagem.trim());
              }}
            >
              {enviarMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <MessageCircle className="mr-2 size-4" />
              )}
              Enviar mensagem
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal molde */}
      <Dialog open={moldeAberto} onOpenChange={setMoldeAberto}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Molde de {selecionada?.nome.split(" ")[0]}</DialogTitle>
            <DialogDescription>
              Medida e formato da unha — cadastro vinculado ao perfil, editável só pela profissional
              (RN05).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <div className="flex flex-wrap gap-2">
                {formatos.map((f) => (
                  <button
                    key={f}
                    onClick={() => setMolde((m) => `${f} · ${m.split("·").slice(1).join("·").trim() || "tamanho M"}`)}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                      molde.startsWith(f)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tamanho</Label>
              <div className="flex flex-wrap gap-2">
                {tamanhos.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      const partes = molde.split("·").map((p) => p.trim());
                      const resto = partes.length > 2 ? ` · ${partes.slice(2).join(" · ")}` : "";
                      setMolde(`${partes[0]} · tamanho ${t}${resto}`);
                    }}
                    className={`size-10 rounded-full border text-xs font-medium transition ${
                      molde.includes(`tamanho ${t}`)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações do molde</Label>
              <Textarea value={molde} onChange={(e) => setMolde(e.target.value)} rows={2} className="rounded-xl" />
            </div>
            <Button
              className="w-full gradient-primary text-primary-foreground"
              disabled={salvarMoldeMutation.isPending}
              onClick={() => salvarMoldeMutation.mutate()}
            >
              {salvarMoldeMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Salvar molde
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
