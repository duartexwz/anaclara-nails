import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { AuthModais, type ModoAuth } from "@/components/auth-modais";
import { useAuth } from "@/lib/auth";
import { ModalPagamento } from "@/components/modal-pagamento";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FotoModelo } from "@/components/foto-modelo";
import {
  ApiError,
  criarAgendamentoApi,
  criarClienteApi,
  excluirAgendamentoApi,
  listarAgendamentosApi,
  listarBloqueiosApi,
  listarClientesApi,
  listarModelosApi,
  listarProgramacaoApi,
  listarStatusApi,
  type AgendamentoApi,
} from "@/lib/api";
import {
  brl,
  fmtDataCurta,
  gerarSlots,
  mapModeloApi,
  statusEstilo,
  statusExibicao,
  type StatusAgendamento,
} from "@/lib/dados";
import { mascararTelefone, apenasDigitos } from "@/lib/masks";
import { Check, Lock, CalendarDays, User, CreditCard, ArrowRight, ArrowLeft, Info, LogIn, CalendarX2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agendamento")({
  validateSearch: z.object({ modelo: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Agendar horário — Ana Clara Nails" },
      {
        name: "description",
        content:
          "Preencha seus dados, escolha o modelo e o horário disponível e confirme o agendamento com o pagamento do sinal de 50%.",
      },
      { property: "og:title", content: "Agendar horário — Ana Clara Nails" },
      { property: "og:description", content: "Agendamento em quatro etapas com confirmação por sinal." },
    ],
  }),
  component: Agendamento,
});

const etapas = [
  { id: 1, rotulo: "Seus dados", icone: User },
  { id: 2, rotulo: "Modelo e horário", icone: CalendarDays },
  { id: 3, rotulo: "Confirmação", icone: Check },
  { id: 4, rotulo: "Pagamento", icone: CreditCard },
];

function Agendamento() {
  const { modelo: modeloInicial } = Route.useSearch();
  const { usuario, entrar, cadastrar } = useAuth();
  const queryClient = useQueryClient();
  const [authAberto, setAuthAberto] = useState(false);
  const [modoAuth, setModoAuth] = useState<ModoAuth>("login");
  const [etapa, setEtapa] = useState(1);
  const [modeloId, setModeloId] = useState<number | null>(
    modeloInicial && /^\d+$/.test(modeloInicial) ? Number(modeloInicial) : null,
  );
  const [slotId, setSlotId] = useState<string | null>(null);
  const [pagamentoAberto, setPagamentoAberto] = useState(false);
  const [agendamentoCriado, setAgendamentoCriado] = useState<AgendamentoApi | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const modelosQuery = useQuery({ queryKey: ["modelos"], queryFn: listarModelosApi });
  const programacaoQuery = useQuery({ queryKey: ["programacao"], queryFn: listarProgramacaoApi });
  const bloqueiosQuery = useQuery({ queryKey: ["bloqueios"], queryFn: listarBloqueiosApi });
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
    enabled: !!usuario,
  });
  const statusQuery = useQuery({ queryKey: ["status"], queryFn: listarStatusApi });
  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientesApi(),
    enabled: !!usuario,
  });

  const modelos = useMemo(
    () => (modelosQuery.data ?? []).map(mapModeloApi).filter((m) => m.ativo),
    [modelosQuery.data],
  );
  const statusNome = useMemo(() => {
    const mapa: Record<number, string> = {};
    for (const s of statusQuery.data ?? []) mapa[s.id] = s.nome;
    return mapa;
  }, [statusQuery.data]);

  useEffect(() => {
    if (modelos.length > 0 && (modeloId == null || !modelos.some((m) => m.id === modeloId))) {
      setModeloId(modelos[0]!.id);
    }
  }, [modelos, modeloId]);

  const modelo = modelos.find((m) => m.id === modeloId) ?? null;

  const ocupados = useMemo(() => {
    const set = new Set<string>();
    for (const a of agendamentosQuery.data ?? []) {
      if (a.data && a.horario) set.add(`${a.data}|${a.horario.slice(0, 8)}`);
    }
    return set;
  }, [agendamentosQuery.data]);

  const slots = useMemo(
    () =>
      gerarSlots(programacaoQuery.data ?? [], bloqueiosQuery.data ?? [], ocupados).slice(
        0,
        60,
      ),
    [programacaoQuery.data, bloqueiosQuery.data, ocupados],
  );

  // Dias com horários: o cliente escolhe o dia e vê só os slots dele.
  const diasComSlots = useMemo(() => {
    const mapa = new Map<string, (typeof slots)[number]>();
    for (const s of slots) {
      if (!mapa.has(s.dataISO)) mapa.set(s.dataISO, s);
    }
    return [...mapa.values()];
  }, [slots]);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const diaAtivo =
    (diaSelecionado && diasComSlots.some((d) => d.dataISO === diaSelecionado)
      ? diaSelecionado
      : diasComSlots[0]?.dataISO) ?? null;
  const slotsDoDia = useMemo(
    () => slots.filter((s) => s.dataISO === diaAtivo),
    [slots, diaAtivo],
  );
  const livresDoDia = (iso: string) =>
    slots.filter((s) => s.dataISO === iso && !s.ocupado).length;

  // Trocou de dia: descarta horário de outro dia.
  useEffect(() => {
    if (slotId && !slotsDoDia.some((s) => s.id === slotId)) setSlotId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaAtivo]);

  const slot = slots.find((s) => s.id === slotId) ?? null;

  const email = usuario?.email ?? "";

  const meuCliente = useMemo(() => {
    if (!usuario) return null;
    const lista = clientesQuery.data ?? [];
    return lista.find((c) => c.email_id === usuario.id) ?? null;
  }, [clientesQuery.data, usuario]);

  // Pré-preenche com os dados de "Meus dados" (cliente vinculado ao login).
  // Antes carregava `usuario.nome` (derivado do e-mail) — agora usa `cliente.nome`.
  useEffect(() => {
    if (meuCliente) {
      if (!nome) setNome(meuCliente.nome);
      if (!telefone) setTelefone(mascararTelefone(meuCliente.telefone));
    } else if (usuario && !nome) {
      // fallback só enquanto o cliente ainda não foi criado
      setNome(usuario.nome);
    }
  }, [meuCliente, usuario]); // eslint-disable-line react-hooks/exhaustive-deps

  const meuClienteId = useMemo(() => {
    if (meuCliente) return meuCliente.id;
    if (!usuario) return null;
    const telDigitos = apenasDigitos(telefone);
    const lista = clientesQuery.data ?? [];
    return lista.find((c) => telDigitos && apenasDigitos(c.telefone) === telDigitos)?.id ?? null;
  }, [clientesQuery.data, usuario, telefone, meuCliente]);

  const meusAgendamentos = useMemo(() => {
    if (meuClienteId == null) return [];
    return (agendamentosQuery.data ?? []).filter((a) => a.cliente_id === meuClienteId);
  }, [agendamentosQuery.data, meuClienteId]);

  const nomeModelo = (id: number | null) =>
    modelos.find((m) => m.id === id)?.nome ?? "Modelo";

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!usuario || modelo == null || slot == null) {
        throw new ApiError(400, "Faltam dados para criar o agendamento.");
      }
      if (!nome.trim()) throw new ApiError(400, "Informe seu nome completo.");
      const telDigitos = apenasDigitos(telefone);
      if (!telDigitos) throw new ApiError(400, "Informe seu telefone.");
      if (telDigitos.length < 10) throw new ApiError(400, "Telefone deve ter 10 ou 11 dígitos.");
      let clienteId = meuClienteId;
      if (clienteId == null) {
        const existentes = await listarClientesApi({ telefone: telDigitos });
        clienteId =
          existentes.find((c) => c.email_id === usuario.id)?.id ??
          existentes[0]?.id ??
          null;
        if (clienteId == null) {
          const novo = await criarClienteApi({
            nome: nome.trim(),
            telefone: telDigitos,
            email_id: usuario.id,
          });
          clienteId = novo.id;
        }
      }
      return criarAgendamentoApi({
        cliente_id: clienteId,
        modelo_id: modelo.id,
        horario: `${slot.hora}:00`.slice(0, 8),
        sinal: Number((modelo.preco / 2).toFixed(2)),
        data: slot.dataISO,
      });
    },
    onSuccess: (ag) => {
      setAgendamentoCriado(ag);
      void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setPagamentoAberto(true);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível criar o agendamento.");
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: (id: number) => excluirAgendamentoApi(id),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível cancelar.");
    },
  });

  const proxima = () => {
    if (etapa === 2 && !slot) {
      toast.error("Selecione um horário disponível");
      return;
    }
    if (etapa === 3) {
      criarMutation.mutate();
      return;
    }
    setEtapa((e) => Math.min(e + 1, 4));
  };

  // Agendamento exige login: sem sessão, exibe a tela de entrada.
  if (!usuario) {
    return (
      <div className="min-h-screen">
        <Cabecalho />
        <section className="gradient-soft">
          <div className="mx-auto max-w-5xl px-4 py-10">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">Agendamento</p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl">Reserve seu horário</h1>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Para agendar, entre na sua conta ou crie uma gratuitamente. Leva menos de um minuto.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-md px-4 pb-16">
          <Card className="rounded-3xl border-border/70 p-6 text-center shadow-card sm:p-8">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-soft">
              <LogIn className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl">Entre para continuar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O agendamento é vinculado à sua conta: seus dados entram automaticamente e você
              acompanha o status do horário.
            </p>
            <Button
              className="mt-6 w-full gradient-primary text-primary-foreground shadow-soft"
              onClick={() => {
                setModoAuth("login");
                setAuthAberto(true);
              }}
            >
              <LogIn className="mr-2 size-4" /> Entrar na minha conta
            </Button>
            <button
              className="mt-3 w-full text-sm text-muted-foreground hover:text-primary"
              onClick={() => {
                setModoAuth("cadastro");
                setAuthAberto(true);
              }}
            >
              Ainda não tenho conta — <span className="font-medium text-primary">criar conta</span>
            </button>
          </Card>
        </section>
        <Rodape />
        <AuthModais
          open={authAberto}
          modo={modoAuth}
          onOpenChange={setAuthAberto}
          onModo={setModoAuth}
          onEntrar={entrar}
          onCadastrar={cadastrar}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Cabecalho />

      <section className="gradient-soft">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Agendamento</p>
          <h1 className="mt-2 font-display text-4xl">Reserve seu horário</h1>
          <div className="mt-8 flex flex-wrap gap-2">
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => setEtapa(e.id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  etapa === e.id
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : etapa > e.id
                      ? "border-primary/40 bg-card text-primary"
                      : "border-border bg-card/70 text-muted-foreground"
                }`}
              >
                {etapa > e.id ? <Check className="size-4" /> : <e.icone className="size-4" />}
                {e.id}. {e.rotulo}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_20rem]">
        <div>
          {etapa === 1 && (
            <Card className="rounded-3xl border-border/70 p-6 shadow-card">
              <h2 className="font-display text-2xl">Seus dados pessoais</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O e-mail é preenchido automaticamente com o e-mail do seu login
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Input id="email" value={email} readOnly className="h-11 rounded-xl bg-muted pr-10" />
                    <Lock className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Vinculado à sua conta</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tel">Telefone / WhatsApp</Label>
                  <Input
                    id="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    maxLength={15}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="obs">Observações (opcional)</Label>
                  <Textarea id="obs" rows={3} placeholder="Alergias, preferências de cor, inspirações..." className="rounded-xl" />
                </div>
              </div>
            </Card>
          )}

          {etapa === 2 && (
            <div className="space-y-6">
              <Card className="rounded-3xl border-border/70 p-6 shadow-card">
                <h2 className="font-display text-2xl">Modelo desejado</h2>
                <div className="mt-4 space-y-1.5">
                  <Label>Selecione na lista de modelos disponíveis</Label>
                  {modelosQuery.isPending ? (
                    <Skeleton className="h-11 w-full rounded-xl" />
                  ) : (
                    <Select
                      value={modeloId != null ? String(modeloId) : ""}
                      onValueChange={(v) => setModeloId(Number(v))}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Escolha um modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelos.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.nome} — {brl(m.preco)} · {m.duracao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {modelo && (
                  <div className="mt-5 flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
                    <FotoModelo
                      src={modelo.imagem}
                      alt={modelo.nome}
                      className="size-20 shrink-0 rounded-xl"
                      imgClassName="size-20 rounded-xl object-cover"
                    />
                    <div>
                      <p className="font-display text-lg">{modelo.nome}</p>
                      <p className="text-sm text-muted-foreground">{modelo.descricao}</p>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="rounded-3xl border-border/70 p-6 shadow-card">
                <h2 className="font-display text-2xl">Horários disponíveis</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Horários em cinza já estão reservados por outra cliente.
                </p>
                {programacaoQuery.isPending || bloqueiosQuery.isPending ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <p className="mt-5 rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                    Nenhum horário disponível no momento. Tente novamente em breve.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="dia-slot">Dia</Label>
                      <Select
                        value={diaAtivo ?? ""}
                        onValueChange={(v) => {
                          setDiaSelecionado(v);
                          setSlotId(null);
                        }}
                      >
                        <SelectTrigger id="dia-slot" className="h-11 rounded-xl">
                          <SelectValue placeholder="Escolha o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {diasComSlots.map((d) => (
                            <SelectItem key={d.dataISO} value={d.dataISO}>
                              {d.dia} · {d.dataCurta} ({livresDoDia(d.dataISO)} livres)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {slotsDoDia.map((s) => (
                        <button
                          key={s.id}
                          disabled={s.ocupado}
                          onClick={() => setSlotId(s.id)}
                          className={`min-w-0 rounded-2xl border p-3 text-center text-sm transition ${
                            s.ocupado
                              ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
                              : slotId === s.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          <span className="block font-display text-lg leading-tight">{s.hora.slice(0, 5)}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {s.ocupado ? "Reservado" : "Livre"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {etapa === 3 && modelo && (
            <Card className="rounded-3xl border-border/70 p-6 shadow-card">
              <h2 className="font-display text-2xl">Confirme os dados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Revise antes de seguir para o pagamento do sinal.
              </p>
              <div className="mt-6 space-y-3 text-sm">
                <Item rotulo="Nome" valor={nome} />
                <Item rotulo="E-mail" valor={email} />
                <Item rotulo="Telefone" valor={telefone} />
                <Separator />
                <Item rotulo="Modelo" valor={modelo.nome} />
                <Item rotulo="Duração estimada" valor={modelo.duracao} />
                <Item rotulo="Data e hora" valor={slot ? `${slot.dataCurta} · ${slot.hora}` : "Selecione um horário"} />
                <Separator />
                <Item rotulo="Valor total" valor={brl(modelo.preco)} />
                <Item rotulo="Sinal a pagar agora (50%)" valor={brl(modelo.preco / 2)} destaque />
                <Item rotulo="Restante no atendimento" valor={brl(modelo.preco / 2)} />
              </div>
              <div className="mt-5 flex items-start gap-2 rounded-2xl bg-accent/60 p-4 text-xs text-accent-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                O agendamento só é confirmado após a aprovação do pagamento do sinal .
              </div>
            </Card>
          )}

          {etapa === 4 && modelo && (
            <Card className="rounded-3xl border-border/70 p-6 shadow-card">
              <h2 className="font-display text-2xl">Pagamento do sinal</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pague {brl(modelo.preco / 2)} via Pix ou cartão de crédito para garantir o horário.
              </p>
              {agendamentoCriado ? (
                <div className="mt-6 rounded-2xl border border-success/40 bg-success/10 p-5">
                  <p className="flex items-center gap-2 font-medium text-success">
                    <Check className="size-4" /> Agendamento criado
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Protocolo #{agendamentoCriado.id}
                    {slot ? ` · ${slot.dataCurta} às ${slot.hora}` : ""}. Conclua o pagamento
                    para confirmar o horário.
                  </p>
                </div>
              ) : (
                <Button
                  className="mt-6 w-full gradient-primary text-primary-foreground shadow-soft"
                  onClick={() => setPagamentoAberto(true)}
                  disabled={!slot}
                >
                  Abrir pagamento do sinal
                </Button>
              )}

              <div className="mt-8">
                <h3 className="font-display text-xl">Status dos meus agendamentos</h3>
                <div className="mt-4 space-y-3">
                  {agendamentosQuery.isPending ? (
                    <Skeleton className="h-20 rounded-2xl" />
                  ) : meusAgendamentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Você ainda não tem agendamentos.
                    </p>
                  ) : (
                    meusAgendamentos.map((a) => (
                      <div key={a.id}>
                        <LinhaStatus
                          id={`#${a.id}`}
                          modelo={nomeModelo(a.modelo_id)}
                          quando={`${fmtDataCurta(a.data)} · ${a.horario.slice(0, 5)}`}
                          status={statusExibicao(
                            a.status_pagamentos_id != null
                              ? statusNome[a.status_pagamentos_id]
                              : null,
                          )}
                        />
                        <button
                          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                          disabled={cancelarMutation.isPending}
                          onClick={() => cancelarMutation.mutate(a.id)}
                        >
                          <CalendarX2 className="size-3.5" />
                          {cancelarMutation.isPending ? "Cancelando..." : "Cancelar agendamento"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="mt-6 flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setEtapa((e) => Math.max(1, e - 1))}
              disabled={etapa === 1}
              className="border-primary/30 text-primary"
            >
              <ArrowLeft className="mr-2 size-4" /> Voltar
            </Button>
            {etapa < 4 && (
              <Button
                onClick={proxima}
                disabled={etapa === 3 && criarMutation.isPending}
                className="gradient-primary text-primary-foreground shadow-soft"
              >
                {etapa === 3 ? (
                  criarMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>Ir para o pagamento <ArrowRight className="ml-2 size-4" /></>
                  )
                ) : (
                  <>Continuar <ArrowRight className="ml-2 size-4" /></>
                )}
              </Button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-3xl border-border/70 p-5 shadow-card">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">Resumo</p>
            {modelo ? (
              <>
                <FotoModelo
                  src={modelo.imagem}
                  alt={modelo.nome}
                  className="mt-4 aspect-square w-full rounded-2xl"
                  imgClassName="mt-4 aspect-square w-full rounded-2xl object-cover"
                />
                <h3 className="mt-4 font-display text-xl">{modelo.nome}</h3>
                <Badge variant="secondary" className="mt-2 bg-accent text-accent-foreground">{modelo.categoria}</Badge>
                <Separator className="my-4" />
                <Item rotulo="Horário" valor={slot ? `${slot.dataCurta} · ${slot.hora}` : "—"} />
                <Item rotulo="Total" valor={brl(modelo.preco)} />
                <Item rotulo="Sinal (50%)" valor={brl(modelo.preco / 2)} destaque />
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Escolha um modelo para ver o resumo.
              </p>
            )}
          </Card>
        </aside>
      </section>

      {modelo && (
        <ModalPagamento
          open={pagamentoAberto}
          onOpenChange={setPagamentoAberto}
          modelo={modelo.nome}
          valor={modelo.preco}
          data={slot?.dataCurta ?? ""}
          hora={slot?.hora ?? ""}
          agendamentoId={agendamentoCriado?.id ?? null}
          email={email}
          onConfirmado={() => {
            void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
          }}
        />
      )}

      <Rodape />
    </div>
  );
}

function Item({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={destaque ? "font-display text-lg text-primary" : "font-medium"}>{valor}</span>
    </div>
  );
}

function LinhaStatus({
  id,
  modelo,
  quando,
  status,
}: {
  id: string;
  modelo: string;
  quando: string;
  status: keyof typeof statusEstilo;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-xs text-muted-foreground">{id}</p>
        <p className="font-medium">{modelo}</p>
        <p className="text-xs text-muted-foreground">{quando}</p>
      </div>
      <Badge variant="outline" className={statusEstilo[status]}>
        {status}
      </Badge>
    </div>
  );
}
