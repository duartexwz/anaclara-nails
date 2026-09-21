import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ApiError, enviarMensagemApi, listarMensagensApi } from "@/lib/api";
import { inscreverPush, pushAtivoLocal, pushSuportado } from "@/lib/push";
import { MessageCircle, Send, Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — Ana Clara Nails" },
      {
        name: "description",
        content:
          "Receba e responda mensagens sobre antecipação ou remarcação de horário (RF16).",
      },
    ],
  }),
  component: Mensagens,
});

function Mensagens() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [resposta, setResposta] = useState("");
  const [pushPedido, setPushPedido] = useState(false);

  // Oferece o push no aparelho uma única vez (respostas da Ana Clara chegam na hora)
  useEffect(() => {
    if (!usuario || !pushSuportado() || pushAtivoLocal()) return;
    setPushPedido(true);
  }, [usuario]);

  const ativarPush = async () => {
    const resultado = await inscreverPush();
    setPushPedido(false);
    if (resultado === "ok") toast.success("Avisos ativados neste aparelho");
    else if (resultado === "negado") toast.error("Permissão de notificação negada");
    else if (resultado === "sem-chave") toast.error("Push ainda não configurado no servidor");
    else if (resultado !== "indisponivel") toast.error("Não foi possível ativar agora");
  };

  const mensagensQuery = useQuery({
    queryKey: ["mensagens"],
    queryFn: listarMensagensApi,
    enabled: !!usuario,
    refetchInterval: 5000,
  });

  const enviarMutation = useMutation({
    mutationFn: (texto: string) =>
      enviarMensagemApi({ texto, remetente: "cliente" }),
    onSuccess: () => {
      setResposta("");
      toast.success("Mensagem enviada");
      void queryClient.invalidateQueries({ queryKey: ["mensagens"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar.");
    },
  });

  const mensagens = [...(mensagensQuery.data ?? [])].sort((a, b) => b.id - a.id);

  return (
    <div className="min-h-screen">
      <Cabecalho />
      <section className="gradient-soft">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Comunicação</p>
          <h1 className="mt-2 font-display text-4xl">Mensagens</h1>
          <p className="mt-3 text-muted-foreground">
            Pedidos de antecipação ou remarcação da Ana Clara chegam aqui (RF16).
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        {mensagensQuery.isPending ? (
          <>
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </>
        ) : mensagensQuery.isError ? (
          <Card className="rounded-3xl border-border/70 p-6 text-center text-sm text-muted-foreground shadow-card">
            Não foi possível carregar as mensagens. Verifique sua conexão.
          </Card>
        ) : mensagens.length === 0 ? (
          <Card className="rounded-3xl border-border/70 p-6 text-center text-sm text-muted-foreground shadow-card">
            Nenhuma mensagem por enquanto.
          </Card>
        ) : (
          mensagens.map((m) => (
            <Card key={m.id} className="rounded-3xl border-border/70 p-6 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <MessageCircle className="size-3.5 text-secondary" />
                  {m.remetente === "admin" ? "Ana Clara" : "Você"}
                </p>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  #{m.id}
                </Badge>
              </div>
              <p className="mt-3 text-sm">{m.texto}</p>
            </Card>
          ))
        )}
        <Card className="rounded-3xl border-border/70 p-6 shadow-card">
          <div className="space-y-1.5">
            <Textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={2}
              placeholder="Escrever para Ana Clara..."
              className="rounded-xl"
            />
          </div>
          {pushPedido && (
            <button
              onClick={ativarPush}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl gradient-primary p-3 text-left text-primary-foreground shadow-soft"
            >
              <BellRing className="size-5 shrink-0" />
              <span className="text-xs">
                <span className="block font-medium">Receber respostas neste aparelho</span>
                <span className="opacity-85">Avisamos quando a Ana Clara responder</span>
              </span>
            </button>
          )}
          <Button
            className="mt-3 w-full gradient-primary text-primary-foreground"
            disabled={enviarMutation.isPending}
            onClick={() => {
              if (!resposta.trim()) {
                toast.error("Escreva sua mensagem");
                return;
              }
              enviarMutation.mutate(resposta.trim());
            }}
          >
            {enviarMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Enviar
          </Button>
        </Card>
      </section>
      <Rodape />
    </div>
  );
}
