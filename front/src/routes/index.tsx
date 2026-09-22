import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { AuthModais, type ModoAuth } from "@/components/auth-modais";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FotoModelo } from "@/components/foto-modelo";
import { listarModelosApi } from "@/lib/api";
import { mapModeloApi, brl } from "@/lib/dados";
import heroImg from "@/assets/hero-nails.jpg";
// Foto da profissional: reutiliza o ensaio do estúdio até o upload oficial.
import profissionalImg from "@/assets/hero-nails.jpg";
import { Sparkles, CalendarHeart, Star, ArrowRight, CreditCard, Clock, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ana Clara Nails — Agendamento de nail design online" },
      {
        name: "description",
        content:
          "Catálogo de modelos de unha, agendamento online com sinal de 50% e acompanhamento do seu horário com a nail designer Ana Clara.",
      },
      { property: "og:title", content: "Ana Clara Nails — Agendamento de nail design online" },
      {
        property: "og:description",
        content: "Escolha seu modelo, reserve o horário e confirme com o sinal de 50%.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<ModoAuth>("login");
  const { entrar, cadastrar } = useAuth();
  const modelosQuery = useQuery({
    queryKey: ["modelos"],
    queryFn: listarModelosApi,
  });
  const destaques = (modelosQuery.data ?? [])
    .map(mapModeloApi)
    .filter((m) => m.ativo && m.destaque)
    .slice(0, 3);

  return (
    <div className="min-h-screen">
      <Cabecalho />

      <section className="gradient-soft">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:py-14 md:grid-cols-2 md:py-20">
          <div>
            <Badge variant="outline" className="border-primary/40 bg-card/70 text-primary">
              <Sparkles className="mr-1 size-3" /> Agenda de setembro aberta
            </Badge>
            <h1 className="mt-5 font-display text-3xl leading-tight sm:text-5xl">
              Unhas que combinam <span className="text-gradient">com você</span>
            </h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              Escolha um modelo do catálogo, reserve o horário e confirme com o sinal de 50%. Simples,
              rápido e sem troca de mensagens para marcar.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="w-full gradient-primary text-primary-foreground shadow-soft sm:w-auto">
                <Link to="/agendamento">
                  <CalendarHeart className="mr-2 size-4" /> Realizar agendamento
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-primary/40 text-primary sm:w-auto">
                <Link to="/catalogo">Catálogo completo</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Star className="size-4 text-secondary" /> Atendimento personalizado</span>
              <span className="flex items-center gap-2"><Clock className="size-4 text-secondary" /> Atendimento de seg a sex</span>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImg}
              alt="Esmaltes lilás e lavanda sobre mármore em estúdio de nail design"
              width={1400}
              height={1100}
              fetchPriority="high"
              decoding="async"
              className="w-full rounded-[2rem] object-cover shadow-soft"
            />
            <Card className="absolute -bottom-6 left-4 w-56 rounded-2xl border-border/70 bg-card/95 p-4 shadow-card backdrop-blur">
              <p className="text-xs text-muted-foreground">Sinal para confirmar</p>
              <p className="font-display text-2xl text-primary">50%</p>
              <p className="text-xs text-muted-foreground">do valor do modelo escolhido</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">Modelos em destaque</p>
            <h2 className="mt-2 font-display text-3xl">Escolhidos pelas clientes</h2>
          </div>
          <Link to="/catalogo" className="flex items-center gap-1 text-sm text-primary hover:underline">
            Ver catálogo completo <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modelosQuery.isPending &&
            [0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-3xl" />
            ))}
          {modelosQuery.isError && (
            <p className="py-8 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">
              Não foi possível carregar os modelos. Verifique sua conexão e recarregue.
            </p>
          )}
          {destaques.map((m) => (
            <Card key={m.id} className="group overflow-hidden rounded-3xl border-border/70 p-0 shadow-card">
              <div className="overflow-hidden">
                <FotoModelo
                  src={m.imagem}
                  alt={m.nome}
                  className="aspect-square w-full"
                  imgClassName="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">{m.nome}</h3>
                  <Badge variant="secondary" className="bg-accent text-accent-foreground">{m.categoria}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{m.descricao}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="font-display text-lg text-primary">{brl(m.preco)}</p>
                    <p className="text-xs text-muted-foreground">Sinal {brl(m.preco / 2)} · {m.duracao}</p>
                  </div>
                  <Button asChild size="sm" className="gradient-primary text-primary-foreground">
                    <Link to="/agendamento" search={{ modelo: String(m.id) }}>Agendar</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Card className="grid items-center gap-8 overflow-hidden rounded-[2rem] border-border/70 p-0 md:grid-cols-[0.8fr_1fr]">
          <img
            src={profissionalImg}
            alt="Ana Clara, nail designer, em seu estúdio"
            width={900}
            height={1100}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary">A profissional</p>
            <h2 className="mt-2 font-display text-3xl">Oi, eu sou a Ana Clara</h2>
            <p className="mt-4 text-muted-foreground">
              Sou nail designer iniciante, apaixonada pelo cuidado com as mãos e dedicada a entregar um acabamento impecável desde o primeiro atendimento. Trabalho com foco na saúde das suas unhas naturais e no estudo detalhado da sua anatomia para garantir um resultado lindo, confortável e duradouro.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { icone: Heart, titulo: "100%", texto: "de dedicação e cuidado" },
                { icone: Sparkles, titulo: "Técnica", texto: "atualizada" },
                { icone: CreditCard, titulo: "Pix e cartão", texto: "para o sinal" },
              ].map((item) => (
                <div key={item.titulo} className="rounded-2xl bg-muted/60 p-4">
                  <item.icone className="size-4 text-primary" />
                  <p className="mt-2 font-display text-lg">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="rounded-[2rem] gradient-primary px-6 py-8 text-center text-primary-foreground shadow-soft sm:px-8 sm:py-12">
          <h2 className="font-display text-3xl">Pronta para o próximo esmalte?</h2>
          <p className="mx-auto mt-3 max-w-md text-primary-foreground/85">
            Faça login, escolha o modelo e garanta seu horário em quatro etapas.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              className="bg-card text-primary hover:bg-card/90"
              onClick={() => {
                setModo("login");
                setAberto(true);
              }}
            >
              Entrar na minha conta
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                setModo("cadastro");
                setAberto(true);
              }}
            >
              Criar conta
            </Button>
          </div>
        </div>
      </section>

      <Rodape />
      <AuthModais open={aberto} modo={modo} onOpenChange={setAberto} onModo={setModo} onEntrar={entrar} onCadastrar={cadastrar} />
    </div>
  );
}