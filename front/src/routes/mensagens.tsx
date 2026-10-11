import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { PageTitle } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { ApiError, enviarMensagemApi, listarMensagensApi } from "@/lib/api";
import { inscreverPush, pushAtivoLocal, pushSuportado } from "@/lib/push";
import { Send, Loader2, BellRing } from "lucide-react";
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
    queryFn: () => listarMensagensApi(),
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

  // Ordem cronológica (conversa): admin à esquerda, você à direita.
  const mensagens = [...(mensagensQuery.data ?? [])].sort((a, b) => a.id - b.id);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [mensagens.length]);

  return (
    <div className="min-h-screen">
      <Cabecalho />
      <PageTitle eyebrow="Comunicação" title="Mensagens">
        Pedidos de antecipação ou remarcação da Ana Clara chegam aqui (RF16).
      </PageTitle>
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
          <div
            ref={threadRef}
            className="max-h-[32rem] space-y-3 overflow-y-auto rounded-3xl border border-border/70 bg-card p-4 shadow-card sm:p-6"
          >
            {mensagens.map((m) =>
              m.remetente === "admin" ? (
                <div key={m.id} className="mr-auto max-w-[85%]">
                  <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-secondary">
                    Ana Clara
                  </p>
                  <div className="rounded-2xl rounded-tl-md bg-muted/70 p-3.5 text-sm">
                    <p>{m.texto}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="ml-auto max-w-[85%]">
                  <p className="mb-1 text-right text-[0.7rem] font-medium uppercase tracking-wider text-primary">
                    Você
                  </p>
                  <div className="rounded-2xl rounded-tr-md gradient-primary p-3.5 text-sm text-primary-foreground shadow-soft">
                    <p>{m.texto}</p>
                  </div>
                </div>
              ),
            )}
          </div>
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
