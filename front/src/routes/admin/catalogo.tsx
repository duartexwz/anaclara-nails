import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  excluirModeloApi,
  listarAgendamentosApi,
  listarModelosApi,
  uploadFotoModeloApi,
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, Pencil, Trash2, Loader2, ImagePlus, Star, Power } from "lucide-react";
import { toast } from "sonner";

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
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const editando = form.id != null;

  const modelosQuery = useQuery({ queryKey: ["modelos"], queryFn: listarModelosApi });
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
  });

  const modelos: Modelo[] = (modelosQuery.data ?? []).map(mapModeloApi);
  const contagem = new Map<number, number>();
  for (const a of agendamentosQuery.data ?? []) {
    if (a.modelo_id != null) contagem.set(a.modelo_id, (contagem.get(a.modelo_id) ?? 0) + 1);
  }

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["modelos"] });
  };

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
        const up = await uploadFotoModeloApi(salvo.id, foto);
        await atualizarModeloApi(salvo.id, { imagem_url: up.imagem_url });
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
      title="Gestão de catálogo"
      subtitle="Inclusão (POST · RF20), edição (PATCH · RF21) e exclusão (RF22) de modelos"
      actions={
        <PrimaryButton onClick={abrirNovo}>
          <Plus className="size-4" /> Novo modelo (POST)
        </PrimaryButton>
      }
    >
      {/* Resumo */}
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
                    <Pencil className="mr-1 size-3.5" /> Editar (PATCH)
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

      {/* Modal POST / PATCH */}
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
              <Label>Foto do modelo (JPG/PNG/WEBP, até 5MB)</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-primary">
                <ImagePlus className="size-4 shrink-0" />
                <span className="truncate">
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
            className="w-full gradient-primary text-primary-foreground shadow-soft"
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
