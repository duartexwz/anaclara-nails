import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import {
  ApiError,
  atualizarClienteApi,
  atualizarUsuarioApi,
  criarClienteApi,
  excluirAgendamentoApi,
  listarAgendamentosApi,
  listarClientesApi,
  listarModelosApi,
  listarStatusApi,
} from "@/lib/api";
import { statusEstilo, brl, fmtDataCurta, mapModeloApi, statusExibicao } from "@/lib/dados";
import { mascararCpf, mascararTelefone, apenasDigitos } from "@/lib/masks";
import { Fingerprint, Lock, Save, CalendarX2, History, Loader2, DiamondPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/meus-dados")({
  head: () => ({
    meta: [
      { title: "Meus dados e agendamentos — Ana Clara Nails" },
      {
        name: "description",
        content:
          "Veja e edite seus dados cadastrais, acompanhe o status dos agendamentos e consulte seu histórico de atendimentos.",
      },
      { property: "og:title", content: "Meus dados e agendamentos — Ana Clara Nails" },
      { property: "og:description", content: "Dados cadastrais, status do agendamento e histórico." },
    ],
  }),
  component: MeusDados,
});

function MeusDados() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [prefApp, setPrefApp] = useState(true);
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefWhatsapp, setPrefWhatsapp] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confSenha, setConfSenha] = useState("");

  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientesApi(),
    enabled: !!usuario,
  });
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
    enabled: !!usuario,
  });
  const modelosQuery = useQuery({ queryKey: ["modelos"], queryFn: listarModelosApi });
  const statusQuery = useQuery({ queryKey: ["status"], queryFn: listarStatusApi });

  const cliente = (clientesQuery.data ?? []).find((c) => usuario && c.email_id === usuario.id) ?? null;
  const modelos = (modelosQuery.data ?? []).map(mapModeloApi);
  const statusNome: Record<number, string> = {};
  for (const s of statusQuery.data ?? []) statusNome[s.id] = s.nome;
  const nomeModelo = (id: number | null) => modelos.find((m) => m.id === id)?.nome ?? "Modelo";

  useEffect(() => {
    if (cliente) {
      setNome((n) => n || cliente.nome);
      setTelefone((t) => t || mascararTelefone(cliente.telefone));
      setCpf((c) => c || (cliente.cpf ? mascararCpf(cliente.cpf) : ""));
      setNascimento((d) => d || cliente.data_nascimento || "");
      if (cliente.pref_app != null) setPrefApp(cliente.pref_app);
      if (cliente.pref_email != null) setPrefEmail(cliente.pref_email);
      if (cliente.pref_whatsapp != null) setPrefWhatsapp(cliente.pref_whatsapp);
    } else if (usuario) {
      setNome((n) => n || usuario.nome);
    }
  }, [cliente, usuario]);

  const meusAgendamentos = (agendamentosQuery.data ?? []).filter(
    (a) => cliente != null && a.cliente_id === cliente.id,
  );
  const concluidos = meusAgendamentos.filter(
    (a) =>
      a.status_pagamentos_id != null &&
      statusExibicao(statusNome[a.status_pagamentos_id]) === "Confirmado",
  );
  const ultimo = [...meusAgendamentos]
    .filter((a) => a.data)
    .sort((a, b) => (a.data! > b.data! ? -1 : 1))[0];
  const favorito = (() => {
    const contagem = new Map<number, number>();
    for (const a of meusAgendamentos) {
      if (a.modelo_id != null) contagem.set(a.modelo_id, (contagem.get(a.modelo_id) ?? 0) + 1);
    }
    let melhor: number | null = null;
    let max = 0;
    for (const [id, qtd] of contagem) {
      if (qtd > max) {
        max = qtd;
        melhor = id;
      }
    }
    return melhor != null ? nomeModelo(melhor) : "—";
  })();

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!usuario) throw new ApiError(401, "Entre para salvar.");
      if (!nome.trim()) throw new ApiError(400, "Informe seu nome.");
      const telDigitos = apenasDigitos(telefone);
      if (!telDigitos) throw new ApiError(400, "Informe seu telefone.");
      if (telDigitos.length < 10) throw new ApiError(400, "Telefone deve ter 10 ou 11 dígitos.");
      const cpfDigitos = apenasDigitos(cpf);
      if (cpfDigitos && cpfDigitos.length !== 11) throw new ApiError(400, "CPF deve ter 11 dígitos.");
      const dados = {
        nome: nome.trim(),
        telefone: telDigitos,
        cpf: cpfDigitos,
        data_nascimento: nascimento,
        pref_app: prefApp,
        pref_email: prefEmail,
        pref_whatsapp: prefWhatsapp,
      };
      if (cliente) {
        return atualizarClienteApi(cliente.id, dados);
      }
      return criarClienteApi({
        nome: dados.nome,
        telefone: dados.telefone,
        email_id: usuario.id,
        cpf: dados.cpf,
        data_nascimento: dados.data_nascimento,
        pref_app: dados.pref_app,
        pref_email: dados.pref_email,
        pref_whatsapp: dados.pref_whatsapp

      });
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    },
  });

  const senhaMutation = useMutation({
    mutationFn: async () => {
      if (!usuario) throw new ApiError(401, "Entre para continuar.");
      if (novaSenha.length < 8) throw new ApiError(400, "A nova senha precisa de 8+ caracteres.");
      if (novaSenha !== confSenha) throw new ApiError(400, "As senhas não conferem.");
      return atualizarUsuarioApi(usuario.id, { password: novaSenha });
    },
    onSuccess: () => {
      setSenhaAberta(false);
      setNovaSenha("");
      setConfSenha("");
      toast.success("Senha alterada");
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível alterar a senha.");
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

  return (
    <div className="min-h-screen">
      <Cabecalho />

      <section className="gradient-soft">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Minha conta</p>
          <h1 className="mt-2 font-display text-4xl">Meus dados</h1>
          <p className="mt-3 text-muted-foreground">Mantenha seus dados atualizados para receber avisos da Ana Clara.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-3xl border-border/70 p-6 shadow-card">
          <h2 className="font-display text-2xl">Dados cadastrais</h2>
          {clientesQuery.isPending ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="n">Nome completo</Label>
                  <Input id="n" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e">E-mail (login)</Label>
                  <Input id="e" value={usuario?.email ?? ""} readOnly className="h-11 rounded-xl bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t">Telefone / WhatsApp</Label>
                  <Input
                    id="t"
                    value={telefone}
                    onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    maxLength={15}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nasc">Data de nascimento</Label>
                  <Input id="nasc" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(mascararCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-muted/50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Fingerprint className="size-4 text-primary" /> Molde da unha
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{cliente?.molde || "Ainda não registrado"}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cadastro atualizado exclusivamente pela profissional .
                </p>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="font-display text-lg">Preferências de aviso</h3>
                {[
                  { rotulo: "Avisos no aplicativo", valor: prefApp, mudar: setPrefApp },
                  { rotulo: "E-mail", valor: prefEmail, mudar: setPrefEmail },
                  { rotulo: "WhatsApp", valor: prefWhatsapp, mudar: setPrefWhatsapp },
                ].map((p) => (
                  <div key={p.rotulo} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.rotulo}</span>
                    <Switch checked={p.valor} onCheckedChange={p.mudar} />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  className="gradient-primary text-primary-foreground shadow-soft"
                  disabled={salvarMutation.isPending}
                  onClick={() => salvarMutation.mutate()}
                >
                  {salvarMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Salvar alterações
                </Button>
                <Button variant="outline" className="border-primary/30 text-primary" onClick={() => setSenhaAberta(true)}>
                  <Lock className="mr-2 size-4" /> Alterar senha
                </Button>
              </div>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border-border/70 p-6 shadow-card">
            <h2 className="font-display text-2xl">Meus agendamentos</h2>
            <div className="mt-4 space-y-3">
              {agendamentosQuery.isPending ? (
                <Skeleton className="h-20 rounded-2xl" />
              ) : meusAgendamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Você ainda não tem agendamentos.
                </p>
              ) : (
                meusAgendamentos.map((a) => {
                  const st = statusExibicao(
                    a.status_pagamentos_id != null ? statusNome[a.status_pagamentos_id] : null,
                  );
                  return (
                    <div key={a.id} className="rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">#{a.id}</p>
                          <p className="font-medium">{nomeModelo(a.modelo_id)}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDataCurta(a.data)} · {a.horario.slice(0, 5)} · sinal {brl(a.sinal)}
                          </p>
                        </div>
                        <Badge variant="outline" className={statusEstilo[st]}>{st}</Badge>
                      </div>
                      {st !== "Cancelado" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="mt-3 text-destructive hover:bg-destructive/10">
                              <CalendarX2 className="mr-2 size-4" /> Cancelar agendamento
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-border/70 bg-card shadow-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display text-2xl">Cancelar #{a.id}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cancelamentos com menos de 48h de antecedência podem não ter o sinal reembolsado — política em
                                definição com a profissional .
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-2xl">Manter horário</AlertDialogCancel>
                              <AlertDialogAction
                                className="rounded-2xl bg-destructive text-destructive-foreground shadow-soft"
                                onClick={() => cancelarMutation.mutate(a.id)}
                              >
                                Confirmar cancelamento
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="rounded-3xl border-border/70 p-6 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-2xl">
              <History className="size-5 text-primary" /> Histórico
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Atendimentos realizados</span><span className="font-medium">{concluidos.length}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Último atendimento</span><span className="font-medium">{ultimo?.data ? fmtDataCurta(ultimo.data) : "—"}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Modelo favorito</span><span className="font-medium">{favorito}</span></p>
            </div>
          </Card>
        </div>
      </section>

      <Dialog open={senhaAberta} onOpenChange={setSenhaAberta}>
        <DialogContent className="max-w-sm rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Alterar senha</DialogTitle>
            <DialogDescription>Sua senha é armazenada de forma criptografada (RNF01).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nova">Nova senha</Label>
              <Input id="nova" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conf">Confirmar nova senha</Label>
              <Input id="conf" type="password" value={confSenha} onChange={(e) => setConfSenha(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>
          <Button
            className="w-full gradient-primary text-primary-foreground"
            disabled={senhaMutation.isPending}
            onClick={() => senhaMutation.mutate()}
          >
            {senhaMutation.isPending ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </DialogContent>
      </Dialog>

      <Rodape />
    </div>
  );
}
