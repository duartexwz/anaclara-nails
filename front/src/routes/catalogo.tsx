import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FotoModelo } from "@/components/foto-modelo";
import { listarModelosApi } from "@/lib/api";
import { categorias, brl, mapModeloApi, type Modelo } from "@/lib/dados";
import { Search, Clock, CalendarHeart } from "lucide-react";

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

function Catalogo() {
  const [categoria, setCategoria] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Modelo | null>(null);
  const navigate = useNavigate();
  const modelosQuery = useQuery({
    queryKey: ["modelos"],
    queryFn: listarModelosApi,
  });
  const modelos = (modelosQuery.data ?? []).map(mapModeloApi).filter((m) => m.ativo);

  const lista = modelos.filter(
    (m) =>
      (categoria === "Todos" || m.categoria === categoria) &&
      m.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      <Cabecalho />

      <section className="gradient-soft">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Catálogo</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Todos os modelos</h1>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Clique em um modelo para escolhê-lo e seguir direto para o agendamento.
          </p>
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

      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        {modelosQuery.isPending ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-3xl" />
            ))}
          </div>
        ) : modelosQuery.isError ? (
            <p className="py-10 text-center text-muted-foreground sm:py-16">
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
          <p className="py-10 text-center text-muted-foreground sm:py-16">Nenhum modelo encontrado.</p>
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
              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-muted/60 p-4 text-sm min-[480px]:grid-cols-3 min-[480px]:text-center">
                <div className="flex items-center justify-between gap-2 min-[480px]:block">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-medium">{brl(selecionado.preco)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 min-[480px]:block">
                  <p className="text-xs text-muted-foreground">Sinal (50%)</p>
                  <p className="font-medium text-primary">{brl(selecionado.preco / 2)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 min-[480px]:block">
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="font-medium">{selecionado.duracao}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 min-[420px]:flex-row">
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

      <Rodape />
    </div>
  );
}