import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminShell,
  Card,
  Pill,
  PrimaryButton,
} from "@/components/admin/AdminShell";
import { categorias, brl, mapModeloApi, duracaoParaApi, type Modelo } from "@/lib/dados";
import { FotoModelo } from "@/components/foto-modelo";
import {
  ApiError,
  atualizarModeloApi,
  criarModeloApi,
  criarNailDesignApi,
  excluirModeloApi,
  excluirNailDesignApi,
  listarAgendamentosApi,
  listarModelosApi,
  listarNailDesignsApi,
  otimizarImagemParaUpload,
  uploadFotoModeloApi,
  type NailDesignApi,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Loader2, ImagePlus, Star, Power, Sparkles, Shield, User, Phone, IdCard } from "lucide-react";
import { toast } from "sonner";
import { mascararCpf, mascararTelefone } from "@/lib/masks";

export const Route = createFileRoute("/admin/catalogo")({
  head: () => ({
    meta: [
      { title: "Gestão de catálogo — Painel Ana Clara Nails" },
      {
        name: "description",
        content:
          "Cadastro (POST), edição (PATCH) e exclusão de modelos do catálogo com sinal de 50% (RF20, RF21, RF22).",
      },
    ],
  }),
  component: CatalogoAdmin,
});

type FormModelo = {
  id?: number;
  nome: string;
  categoria: string;
  preco: string;
  duracao: string;
  descricao: string;
  ativo: boolean;
  destaque: boolean;
};

const vazio: FormModelo = {
  nome: "",
  categoria: "Nail art",
  preco: "",
  duracao: "1h30",
  descricao: "",
  ativo: true,
  destaque: false,
};

function CatalogoAdmin() {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormModelo>(vazio);
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"modelos" | "profissionais">("modelos");

  // Estado para cadastro de Nail Design
  const [nailDesignAberto, setNailDesignAberto] = useState(false);
  const [ndNome, setNdNome] = useState("");
  const [ndCpf, setNdCpf] = useState("");
  const [ndTelefone, setNdTelefone] = useState("");
  const [ndEhAdmin, setNdEhAdmin] = useState(false);
  const [ndEmail, setNdEmail] = useState("");
  const [ndSenha, setNdSenha] = useState("");
  const [excluirNdId, setExcluirNdId] = useState<number | null>(null);

  // Miniatura local da foto escolhida (sem subir nada ainda).
  useEffect(() => {
    if (!foto) {
      setPrevia(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const modelosQuery = useQuery({ queryKey: ["modelos"], queryFn: listarModelosApi });
  const nailDesignsQuery = useQuery({ queryKey: ["nail-designs"], queryFn: listarNailDesignsApi });
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
  });

  const modelos: Modelo[] = (modelosQuery.data ?? []).map(mapModeloApi);
  const nailDesigns: NailDesignApi[] = nailDesignsQuery.data ?? [];
  const contagem = new Map<number, number>();
  for (const a of agendamentosQuery.data ?? []) {
    if (a.modelo_id != null) contagem.set(a.modelo_id, (contagem.get(a.modelo_id) ?? 0) + 1);
  }

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["modelos"] });
    void queryClient.invalidateQueries({ queryKey: ["nail-designs"] });
  };

  const salvarNailDesignMutation = useMutation({
    mutationFn: async () => {
      if (!ndNome.trim()) {
        throw new ApiError(400, "Preencha o nome da profissional.");
      }
      const cpfLimpo = ndCpf.replace(/\D/g, "");
      if (cpfLimpo.length !== 11) {
        throw new ApiError(400, "CPF inválido. Informe os 11 dígitos.");
      }
      if (ndEhAdmin) {
        if (!ndEmail.trim() || !ndSenha) {
          throw new ApiError(400, "Para perfil administrador, informe e-mail e senha.");
        }
        if (ndSenha.length < 8) {
          throw new ApiError(400, "A senha deve ter no mínimo 8 caracteres.");
        }
      }
      return criarNailDesignApi({
        nome: ndNome.trim(),
        cpf: cpfLimpo,
        telefone: ndTelefone.trim() || "Não informado",
        eh_admin: ndEhAdmin,
        email: ndEhAdmin ? ndEmail.trim() : undefined,
        password: ndEhAdmin ? ndSenha : undefined,
      });
    },
    onSuccess: () => {
      toast.success(
        ndEhAdmin
          ? "Nail design e acesso administrativo criados com sucesso!"
          : "Nail design cadastrada com sucesso!"
      );
      setNailDesignAberto(false);
      setNdNome("");
      setNdCpf("");
      setNdTelefone("");
      setNdEhAdmin(false);
      setNdEmail("");
      setNdSenha("");
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível cadastrar a nail design.");
    },
  });

  const excluirNailDesignMutation = useMutation({
    mutationFn: (id: number) => excluirNailDesignApi(id),
    onSuccess: () => {
      toast.success("Nail design removida com sucesso");
      setExcluirNdId(null);
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível remover a profissional.");
    },
  });

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim() || !form.preco) {
        throw new ApiError(400, "Preencha ao menos nome e valor do modelo.");
      }
      const preco =
        Number(form.preco.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      if (preco <= 0) throw new ApiError(400, "Informe um valor válido.");
      const duracaoApi = duracaoParaApi(form.duracao);
      if (!duracaoApi) {
        throw new ApiError(400, "Duração inválida. Ex.: 1h30, 1h ou 45min.");
      }
      const dados = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        valor_total: preco,
        duracao: duracaoApi,
        descricao: form.descricao.trim() || "Novo modelo do catálogo.",
        ativo: form.ativo,
        destaque: form.destaque,
      };
      const salvo = editando
        ? await atualizarModeloApi(form.id!, dados)
        : await criarModeloApi(dados);
      if (foto) {
        // O upload já grava imagem_url no modelo (uploads_service);
        // a foto é otimizada no aparelho antes de subir.
        const otimizada = await otimizarImagemParaUpload(foto);
        await uploadFotoModeloApi(salvo.id, otimizada);
      }
      return salvo;
    },
    onSuccess: (_, __) => {
      toast.success(
        editando ? "Modelo atualizado com sucesso" : "Modelo publicado no catálogo",
      );
      setAberto(false);
      setForm(vazio);
      setFoto(null);
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    },
  });

  const excluirMutation = useMutation({
    mutationFn: (id: number) => excluirModeloApi(id),
    onSuccess: () => {
      toast.success("Modelo excluído do catálogo");
      setExcluirId(null);
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível excluir.");
    },
  });

  const abrirNovo = () => {
    setForm(vazio);
    setFoto(null);
    setAberto(true);
  };

  const abrirEditar = (m: Modelo) => {
    setForm({
      id: m.id,
      nome: m.nome,
      categoria: m.categoria,
      preco: String(m.preco).replace(".", ","),
      duracao: m.duracao,
      descricao: m.descricao,
      ativo: m.ativo,
      destaque: m.destaque,
    });
    setFoto(null);
    setAberto(true);
  };

  const alternarMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { ativo?: boolean } }) =>
      atualizarModeloApi(id, patch),
    onSuccess: () => {
      toast.success("Visibilidade atualizada");
      invalidar();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível atualizar.");
    },
  });

  const sinal = (Number(form.preco.replace(/[^\d.,]/g, "").replace(",", ".")) || 0) / 2;

  return (
    <AdminShell
      title="Catálogo & Profissionais"
      subtitle="Gerencie os modelos do catálogo e a equipe de nail designers"
      actions={
        <div className="flex items-center gap-2">
          {abaAtiva === "modelos" ? (
            <PrimaryButton onClick={abrirNovo}>
              <Plus className="size-4" /> Novo modelo
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => setNailDesignAberto(true)}>
              <Plus className="size-4" /> Nova profissional
            </PrimaryButton>
          )}
        </div>
      }
    >
      <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as "modelos" | "profissionais")}>
        <div className="mb-6 flex items-center justify-between">
          <TabsList className="bg-card border border-border/70 p-1 rounded-2xl h-11">
            <TabsTrigger value="modelos" className="rounded-xl px-4 py-2 text-xs sm:text-sm flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Modelos ({modelos.length})
            </TabsTrigger>
            <TabsTrigger value="profissionais" className="rounded-xl px-4 py-2 text-xs sm:text-sm flex items-center gap-2">
              <User className="size-4 text-secondary" /> Nail Designers ({nailDesigns.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="modelos" className="space-y-6">
          {/* Resumo Modelos */}
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              { rotulo: "Modelos publicados", valor: String(modelos.filter((m) => m.ativo).length) },
              { rotulo: "Em destaque na Home", valor: String(modelos.filter((m) => m.destaque && m.ativo).length) },
              {
                rotulo: "Agendamentos (total)",
                valor: String(
                  [...contagem.values()].reduce((s, q) => s + q, 0),
                ),
              },
              { rotulo: "Ticket médio", valor: brl(modelos.reduce((s, m) => s + m.preco, 0) / Math.max(modelos.length, 1)) },
            ].map((r) => (
              <Card key={r.rotulo} className="flex items-baseline justify-between">
                <p className="text-sm text-muted-foreground">{r.rotulo}</p>
                <p className="font-display text-2xl text-primary">{r.valor}</p>
              </Card>
            ))}
          </section>

          {/* Grade de modelos */}
          {modelosQuery.isPending ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-3xl" />
              ))}
            </div>
          ) : modelosQuery.isError ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar o catálogo. Verifique sua conexão.
              </p>
            </Card>
          ) : modelos.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Nenhum modelo cadastrado. Use “Novo modelo” para começar.
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {modelos.map((m) => (
                <Card key={m.id} className="!p-0 overflow-hidden">
                  <div className="relative">
                    <FotoModelo
                      src={m.imagem}
                      alt={m.nome}
                      className="aspect-[4/3] w-full"
                      imgClassName={`aspect-[4/3] w-full object-cover ${m.ativo ? "" : "opacity-50 grayscale"}`}
                    />
                    <div className="absolute left-3 top-3 flex gap-2">
                      {m.destaque && (
                        <Badge className="bg-gradient-primary text-primary-foreground">
                          <Star className="mr-1 size-3" /> Destaque
                        </Badge>
                      )}
                      {!m.ativo && <Badge variant="secondary">Oculto</Badge>}
                    </div>
                    <span className="absolute right-3 top-3 rounded-full bg-card/90 px-3 py-1 font-display text-base text-primary shadow-card">
                      {brl(m.preco)}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xl">{m.nome}</h3>
                      <Pill label={m.categoria} tone="primary" />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{m.descricao}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Sinal {brl(m.preco / 2)} · {m.duracao} · {contagem.get(m.id) ?? 0} agendamentos
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" className="gradient-primary flex-1 text-primary-foreground" onClick={() => abrirEditar(m)}>
                        <Pencil className="mr-1 size-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title={m.ativo ? "Ocultar do catálogo" : "Mostrar no catálogo"}
                        disabled={alternarMutation.isPending}
                        onClick={() => alternarMutation.mutate({ id: m.id, patch: { ativo: !m.ativo } })}
                      >
                        <Power className="size-3.5" />
                      </Button>
                      <AlertDialog
                        open={excluirId === m.id}
                        onOpenChange={(o) => !o && setExcluirId(null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" title="Excluir modelo" onClick={() => setExcluirId(m.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border-border/70 bg-card shadow-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-display text-2xl">Excluir “{m.nome}”?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O modelo sai do catálogo e não poderá mais ser escolhido em novos agendamentos.
                              Agendamentos já confirmados são mantidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-2xl">Manter</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-2xl bg-destructive text-destructive-foreground shadow-soft"
                              onClick={() => excluirMutation.mutate(m.id)}
                            >
                              Excluir modelo
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profissionais" className="space-y-6">
          <Card className="!p-0 overflow-hidden">
            {nailDesignsQuery.isPending ? (
              <div className="space-y-3 p-6">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))}
              </div>
            ) : nailDesignsQuery.isError ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                Não foi possível carregar as profissionais. Verifique sua conexão.
              </p>
            ) : nailDesigns.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">Nenhuma nail design cadastrada ainda.</p>
                <Button onClick={() => setNailDesignAberto(true)} className="gradient-primary text-primary-foreground shadow-soft">
                  <Plus className="mr-2 size-4" /> Adicionar primeira profissional
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-4 font-medium">Nome</th>
                      <th className="px-4 py-4 font-medium">CPF</th>
                      <th className="px-4 py-4 font-medium">Telefone</th>
                      <th className="px-6 py-4 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nailDesigns.map((nd) => (
                      <tr key={nd.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-full bg-gradient-primary text-[10px] text-primary-foreground font-display">
                            {nd.nome.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{nd.nome}</span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{mascararCpf(nd.cpf)}</td>
                        <td className="px-4 py-4 text-muted-foreground">{mascararTelefone(nd.telefone)}</td>
                        <td className="px-6 py-4 text-right">
                          <AlertDialog
                            open={excluirNdId === nd.id}
                            onOpenChange={(o) => !o && setExcluirNdId(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:bg-destructive/10 rounded-xl"
                                title="Excluir profissional"
                                onClick={() => setExcluirNdId(nd.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-border/70 bg-card shadow-card">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display text-2xl">Remover “{nd.nome}”?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A profissional será desvinculada do sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="rounded-2xl bg-destructive text-destructive-foreground shadow-soft"
                                  onClick={() => excluirNailDesignMutation.mutate(nd.id)}
                                >
                                  Remover profissional
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Adicionar Nail Design */}
      <Dialog open={nailDesignAberto} onOpenChange={setNailDesignAberto}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Adicionar Nail Design
            </DialogTitle>
            <DialogDescription>
              Cadastre uma nova profissional e decida se ela terá acesso administrativo ao painel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo da profissional</Label>
              <Input
                value={ndNome}
                onChange={(e) => setNdNome(e.target.value)}
                placeholder="Ex.: Larissa Santos"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input
                value={ndCpf}
                onChange={(e) => setNdCpf(mascararCpf(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={ndTelefone}
                onChange={(e) => setNdTelefone(mascararTelefone(e.target.value))}
                placeholder="(61) 98888-7777"
                inputMode="tel"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Opção se profissional será Administrador ou não */}
            <div className="rounded-2xl border border-primary/20 bg-accent/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <Shield className="size-4 text-primary" /> Tornar Administradora?
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Permite fazer login no painel e gerenciar agendamentos e catálogo.
                  </p>
                </div>
                <Switch
                  checked={ndEhAdmin}
                  onCheckedChange={setNdEhAdmin}
                />
              </div>

              {ndEhAdmin && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail de acesso administrativo</Label>
                    <Input
                      type="email"
                      value={ndEmail}
                      onChange={(e) => setNdEmail(e.target.value)}
                      placeholder="larissa@admin.com"
                      className="h-10 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha de acesso (mínimo 8 caracteres)</Label>
                    <Input
                      type="password"
                      value={ndSenha}
                      onChange={(e) => setNdSenha(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full gradient-primary text-primary-foreground shadow-soft rounded-full py-5"
            disabled={salvarNailDesignMutation.isPending}
            onClick={() => salvarNailDesignMutation.mutate()}
          >
            {salvarNailDesignMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Cadastrar profissional
          </Button>
        </DialogContent>
      </Dialog>

      {/* Modal POST / PATCH Modelo */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">
              {editando ? "Editar modelo (PATCH)" : "Novo modelo (POST)"}
            </DialogTitle>
            <DialogDescription>
              O sinal é sempre 50% do valor (RN01) e recalcula sozinho.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome do modelo</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Aura Rosé"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.filter((c) => c !== "Todos").map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duração</Label>
              <Input
                value={form.duracao}
                onChange={(e) => setForm({ ...form, duracao: e.target.value })}
                placeholder="1h30"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
                placeholder="140"
                inputMode="decimal"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sinal (50% · automático)</Label>
              <Input value={brl(sinal)} readOnly className="h-11 rounded-xl bg-muted font-medium text-primary" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
                placeholder="Acabamento, técnica, inspiração..."
                className="rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              <span className="flex items-center gap-2"><Star className="size-4 text-secondary" /> Destaque na Home</span>
              <Switch checked={form.destaque} onCheckedChange={(v) => setForm({ ...form, destaque: v })} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              <span className="flex items-center gap-2"><Power className="size-4 text-primary" /> Visível no catálogo</span>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Foto do modelo (otimizada sozinha · JPG/PNG/WEBP)</Label>
              {previa && (
                <img
                  src={previa}
                  alt="Prévia da foto escolhida"
                  className="h-28 w-full rounded-2xl border border-border/70 object-cover"
                />
              )}
              <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-primary">
                <ImagePlus className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {foto ? foto.name : "Escolher arquivo..."}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <Button
            className="w-full rounded-full gradient-primary text-primary-foreground shadow-soft"
            disabled={salvarMutation.isPending}
            onClick={() => salvarMutation.mutate()}
          >
            {salvarMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {editando ? "Salvar alterações (PATCH)" : "Publicar modelo (POST)"}
          </Button>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
