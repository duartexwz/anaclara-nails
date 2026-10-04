import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { PageTitle } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FotoModelo } from "@/components/foto-modelo";
import { ModalPagamento } from "@/components/modal-pagamento";
import { useAuth } from "@/lib/auth";
import {
  ApiError,
  excluirAgendamentoApi,
  listarAgendamentosApi,
  listarClientesApi,
  listarModelosApi,
  listarStatusApi,
} from "@/lib/api";
import {
  brl,
  fmtDataCurta,
  mapModeloApi,
  statusEstilo,
  statusExibicao,
} from "@/lib/dados";
import { CalendarDays, Clock, CreditCard, CalendarX2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/meus-agendamentos")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos — Ana Clara Nails" },
      {
        name: "description",
        content: "Acompanhe seus próximos horários, pague o sinal e veja o histórico.",
      },
      { property: "og:title", content: "Meus agendamentos — Ana Clara Nails" },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),
  component: MeusAgendamentos,
});

function MeusAgendamentos() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [pagamentoAgId, setPagamentoAgId] = useState<number | null>(null);

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
  const fotoModelo = (id: number | null) => modelos.find((m) => m.id === id)?.imagem ?? null;

  const meus = (agendamentosQuery.data ?? []).filter(
    (a) => cliente != null && a.cliente_id === cliente.id,
  );
  const comStatus = meus.map((a) => ({
    ...a,
    st: statusExibicao(
      a.status_pagamentos_id != null ? statusNome[a.status_pagamentos_id] : null,
    ),
  }));
  const proximos = comStatus.filter((a) => a.st !== "Cancelado" && a.st !== "Concluído");
  const historico = comStatus.filter((a) => a.st === "Cancelado" || a.st === "Concluído");

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

  const agPagar = meus.find((a) => a.id === pagamentoAgId) ?? null;

  return (
    <div className="min-h-screen">
      <Cabecalho />
      <PageTitle eyebrow="Minha agenda" title="Meus agendamentos" />

      <div className="mx-auto max-w-4xl space-y-10 px-4 pb-16">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Próximos</h2>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/agendamento">Novo agendamento</Link>
            </Button>
          </div>
          <div className="space-y-4">
            {agendamentosQuery.isPending ? (
              <Skeleton className="h-28 rounded-3xl" />
            ) : proximos.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Nenhum horário marcado.{" "}
                <Link to="/agendamento" className="font-medium text-primary hover:underline">
                  Agendar agora
                </Link>
              </Card>
            ) : (
              proximos.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-border sm:flex-row sm:items-center"
                >
                  <FotoModelo
                    src={fotoModelo(a.modelo_id)}
                    alt={nomeModelo(a.modelo_id)}
                    className="h-24 w-24 shrink-0 rounded-2xl"
                    imgClassName="h-24 w-24 rounded-2xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-semibold text-primary">
                        {nomeModelo(a.modelo_id)}
                      </h3>
                      <Badge variant="outline" className={statusEstilo[a.st]}>{a.st}</Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-4" />
                        {fmtDataCurta(a.data)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-4" />
                        {a.horario.slice(0, 5)}
                      </span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-primary">{brl(a.sinal)}</p>
                  </div>
                  <div className="flex gap-2 sm:flex-col">
                    {a.st === "Aguardando sinal" && (
                      <Button
                        size="sm"
                        className="flex-1 rounded-full gradient-primary text-primary-foreground shadow-soft sm:flex-none"
                        onClick={() => setPagamentoAgId(a.id)}
                      >
                        <CreditCard className="mr-1 size-3.5" /> Pagar sinal
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 rounded-full text-destructive hover:bg-destructive/10 sm:flex-none"
                        >
                          <CalendarX2 className="mr-1 size-3.5" /> Cancelar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-border/70 bg-card shadow-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display text-2xl">
                            Cancelar #{a.id}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Cancelamentos com menos de 48h de antecedência podem não ter o
                            sinal reembolsado.
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
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl">Histórico</h2>
          <div className="divide-y divide-border rounded-3xl bg-card ring-1 ring-border">
            {historico.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nada por aqui ainda.</p>
            ) : (
              historico.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary">{nomeModelo(a.modelo_id)}</p>
                    <p className="text-muted-foreground">
                      {fmtDataCurta(a.data)} · {a.horario.slice(0, 5)}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusEstilo[a.st]}>{a.st}</Badge>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Rodape />

      {agPagar && (
        <ModalPagamento
          open={pagamentoAgId != null}
          onOpenChange={(o) => {
            if (!o) setPagamentoAgId(null);
          }}
          modelo={nomeModelo(agPagar.modelo_id)}
          valor={agPagar.sinal * 2}
          data={fmtDataCurta(agPagar.data)}
          hora={agPagar.horario.slice(0, 5)}
          agendamentoId={agPagar.id}
          email={usuario?.email ?? ""}
          onConfirmado={() => {
            setPagamentoAgId(null);
            void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
          }}
        />
      )}
    </div>
  );
}
