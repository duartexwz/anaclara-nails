import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FotoModelo } from "@/components/foto-modelo";
import { ApiError, criarModeloApi, uploadFotoModeloApi, atualizarModeloApi, listarModelosApi } from "@/lib/api";
import { categorias, brl, mapModeloApi, duracaoParaApi, type Modelo } from "@/lib/dados";
import { Search, Clock, CalendarHeart, Plus, Loader2, Star, Power, ImagePlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo de modelos de unha — Ana Clara Nails" },
      {
        name: "description",
        content:
          "Veja todos os modelos de unha disponíveis, com valores, duração e sinal de 50%. Clique no modelo para agendar.",
      },
      { property: "og:title", content: "Catálogo de modelos de unha — Ana Clara Nails" },
      { property: "og:description", content: "Modelos clássicos, nail art, festa e noivas com valores e duração." },
    ],
  }),
  component: Catalogo,
});

type FormModelo = {
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

function Catalogo() {
  const [categoria, setCategoria] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Modelo | null>(null);
  const [abertoNovo, setAbertoNovo] = useState(false);
  const [form, setForm] = useState<FormModelo>(vazio);
  const [foto, setFoto] = useState<File | null>(null);
  const { ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modelosQuery = useQuery({ queryKey: ["modelos"], queryFn: listarModelosApi });
  const modelos = (modelosQuery.data ?? []).map(mapModeloApi).filter((m) => m.ativo);

  const lista = modelos.filter(
    (m) =>
      (categoria === "Todos" || m.categoria === categoria) &&
      m.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  const salvarNovo = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim() || !form.preco) {
        throw new ApiError(400, "Preencha ao menos nome e valor do modelo.");
      }
      const preco = Number(form.preco.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      if (preco <= 0) throw new ApiError(400, "Informe um valor válido.");
      const duracaoApi = duracaoParaApi(form.duracao);
      if (!duracaoApi) throw new ApiError(400, "Duração inválida.");
      const dados = {
        nome: form.nome.trim(),
        categoria: form.categoria,
        valor_total: preco,
        duracao: duracaoApi,
        descricao: form.descricao.trim() || "Novo modelo do catálogo.",
        ativo: form.ativo,
        destaque: form.destaque,
      };
      const salvo = await criarModeloApi(dados);
      if (foto) {
        const up = await uploadFotoModeloApi(salvo.id, foto);
        await atualizarModeloApi(salvo.id, { imagem_url: up.imagem_url });
      }
      return salvo;
    },
    onSuccess: () => {
      toast.success("Modelo publicado no catálogo");
      setAbertoNovo(false);
      setForm(vazio);
      setFoto(null);
      void queryClient.invalidateQueries({ queryKey: ["modelos"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    },
  });

  return (
    <div className="min-h-screen">
      <Cabecalho />

      <section className="gradient-soft">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-secondary">Catálogo</p>
              <h1 className="mt-2 font-display text-4xl">Todos os modelos</h1>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Clique em um modelo para escolhê-lo e seguir direto para o agendamento.
              </p>
            </div>
            {ehAdmin && (
              <Button onClick={() => setAbertoNovo(true)}>
                <Plus className="mr-2 size-4" /> Novo modelo
              </Button>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar modelo"
                className="h-11 rounded-full bg-card pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoria(c)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    categoria === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        {modelosQuery.isPending ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-3xl" />
            ))}
          </div>
        ) : modelosQuery.isError ? (
          <p className="py-16 text-center text-muted-foreground">
            Não foi possível carregar o catálogo. Verifique sua conexão e recarregue.
          </p>
        ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((m) => (
            <button key={m.id} onClick={() => setSelecionado(m)} className="text-left">
              <Card className="group h-full overflow-hidden rounded-3xl border-border/70 p-0 shadow-card transition hover:-translate-y-1 hover:shadow-soft">
                <FotoModelo
                  src={m.imagem}
                  alt={m.nome}
                  className="aspect-square w-full"
                  imgClassName="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl">{m.nome}</h2>
                    <Badge variant="secondary" className="bg-accent text-accent-foreground">{m.categoria}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{m.descricao}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-display text-lg text-primary">{brl(m.preco)}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5" /> {m.duracao}
                    </span>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
        )}
        {!modelosQuery.isPending && !modelosQuery.isError && lista.length === 0 && (
          <p className="py-16 text-center text-muted-foreground">Nenhum modelo encontrado.</p>
        )}
      </section>

      <Dialog open={!!selecionado} onOpenChange={(o) => !o && setSelecionado(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          {selecionado && (
            <>
              <FotoModelo
                src={selecionado.imagem}
                alt={selecionado.nome}
                className="aspect-[4/3] w-full rounded-2xl"
                imgClassName="aspect-[4/3] w-full rounded-2xl object-cover"
              />
              <DialogHeader className="text-left">
                <DialogTitle className="font-display text-2xl">{selecionado.nome}</DialogTitle>
                <DialogDescription>{selecionado.descricao}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/60 p-4 text-center text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-medium">{brl(selecionado.preco)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sinal (50%)</p>
                  <p className="font-medium text-primary">{brl(selecionado.preco / 2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="font-medium">{selecionado.duracao}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setSelecionado(null)}>
                  Voltar ao catálogo
                </Button>
                <Button
                  className="flex-1 gradient-primary text-primary-foreground"
                  onClick={() => navigate({ to: "/agendamento", search: { modelo: String(selecionado.id) } })}
                >
                  <CalendarHeart className="mr-2 size-4" /> Escolher e agendar
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Já tem horário em mente? Veja também a{" "}
                <Link to="/agendamento" className="text-primary hover:underline">
                  tela de agendamento
                </Link>
                .
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={abertoNovo} onOpenChange={(o) => { setAbertoNovo(false); if (!o) { setForm(vazio); setFoto(null); } }}>
        <DialogContent className="max-w-lg rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Novo modelo (POST)</DialogTitle>
            <DialogDescription>O sinal é sempre 50% do valor e recalcula sozinho.</DialogDescription>
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
            disabled={salvarNovo.isPending}
            onClick={() => salvarNovo.mutate()}
          >
            {salvarNovo.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Publicar modelo (POST)
          </Button>
        </DialogContent>
      </Dialog>

      <Rodape />
    </div>
  );
}
