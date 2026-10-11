import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminShell,
  Card,
} from "@/components/admin/AdminShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  enviarMensagemApi,
  listarClientesApi,
  listarMensagensApi,
  listarUsuariosApi,
  marcarMensagemLidaApi,
  type MensagemApi,
} from "@/lib/api";
import { ArrowLeft, Loader2, MessageCircle, Search, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens por cliente — Painel Ana Clara Nails" },
      {
        name: "description",
        content:
          "Conversas privadas com cada cliente: selecione e responda (RF16).",
      },
    ],
  }),
  component: MensagensAdmin,
});

type Conversa = {
  chave: string;
  clienteId: number | null;
  usuarioId: number | null;
  nome: string;
  detalhe: string;
  itens: MensagemApi[];
  ultima: MensagemApi;
  naoLidas: number;
};

const iniciais = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

function MensagensAdmin() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [chaveSel, setChaveSel] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const marcadasRef = useRef<Set<number>>(new Set());
  const threadRef = useRef<HTMLDivElement>(null);

  const mensagensQuery = useQuery({
    queryKey: ["mensagens"],
    queryFn: () => listarMensagensApi(),
    refetchInterval: 5000,
  });
  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientesApi(),
  });
  const usuariosQuery = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listarUsuariosApi(),
  });

  const nomeCliente = (id: number | null) =>
    (clientesQuery.data ?? []).find((c) => c.id === id)?.nome ?? null;
  const nomeUsuario = (id: number | null) =>
    (usuariosQuery.data ?? []).find((u) => u.id === id)?.nome ?? null;

  const conversas = useMemo<Conversa[]>(() => {
    const mapa = new Map<string, MensagemApi[]>();
    for (const m of mensagensQuery.data ?? []) {
      const chave =
        m.cliente_id != null
          ? `c:${m.cliente_id}`
          : m.usuario_id != null
            ? `u:${m.usuario_id}`
            : `m:${m.id}`;
      const lista = mapa.get(chave) ?? [];
      lista.push(m);
      mapa.set(chave, lista);
    }
    const lista: Conversa[] = [];
    for (const [chave, itens] of mapa) {
      const ordenadas = [...itens].sort((a, b) => a.id - b.id);
      const primeira = ordenadas[0]!;
      const clienteId = primeira.cliente_id ?? null;
      const usuarioId = primeira.usuario_id ?? null;
      const nome =
        (clienteId != null ? nomeCliente(clienteId) : null) ??
        (usuarioId != null ? nomeUsuario(usuarioId) : null) ??
        "Sem vínculo";
      lista.push({
        chave,
        clienteId,
        usuarioId,
        nome,
        detalhe:
          clienteId != null
            ? `Cliente #${clienteId}`
            : usuarioId != null
              ? "Sessão sem cadastro"
              : "Sem sessão vinculada",
        itens: ordenadas,
        ultima: ordenadas[ordenadas.length - 1]!,
        naoLidas: ordenadas.filter((m) => !m.lida && m.remetente !== "admin")
          .length,
      });
    }
    return lista.sort((a, b) => b.ultima.id - a.ultima.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagensQuery.data, clientesQuery.data, usuariosQuery.data]);

  const filtradas = conversas.filter(
    (c) =>
      busca === "" || c.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  const sel = conversas.find((c) => c.chave === chaveSel) ?? null;

  // Ao abrir a conversa, marca as recebidas como lidas (só uma vez cada).
  useEffect(() => {
    if (!sel) return;
    const pendentes = sel.itens.filter(
      (m) => !m.lida && m.remetente !== "admin" && !marcadasRef.current.has(m.id),
    );
    if (pendentes.length === 0) return;
    for (const m of pendentes) marcadasRef.current.add(m.id);
    void (async () => {
      await Promise.allSettled(pendentes.map((m) => marcarMensagemLidaApi(m.id)));
      void queryClient.invalidateQueries({ queryKey: ["mensagens"] });
    })();
  }, [sel?.chave, mensagensQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rola a conversa para a última mensagem.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [sel?.chave, sel?.itens.length]);

  const enviarMutation = useMutation({
    mutationFn: (novoTexto: string) => {
      if (!sel) throw new ApiError(400, "Selecione uma conversa.");
      return enviarMensagemApi({
        texto: novoTexto,
        remetente: "admin",
        cliente_id: sel.clienteId,
        usuario_id: sel.usuarioId,
      });
    },
    onSuccess: () => {
      setTexto("");
      void queryClient.invalidateQueries({ queryKey: ["mensagens"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível enviar.");
    },
  });

  const responder = () => {
    if (!texto.trim()) {
      toast.error("Escreva a mensagem antes de enviar");
      return;
    }
    enviarMutation.mutate(texto.trim());
  };

  const podeResponder = sel != null && (sel.clienteId != null || sel.usuarioId != null);

  const listaEl = (
    <Card className="!p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente"
          className="h-11 rounded-2xl pl-10"
        />
      </div>
      {mensagensQuery.isPending ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : mensagensQuery.isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Não foi possível carregar as mensagens.
        </p>
      ) : filtradas.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma conversa ainda.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtradas.map((c) => (
            <li key={c.chave}>
              <button
                onClick={() => setChaveSel(c.chave)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  sel?.chave === c.chave
                    ? "border-primary bg-accent/60 shadow-card"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Avatar className="bg-gradient-primary text-primary-foreground">
                  <AvatarFallback className="bg-transparent text-primary-foreground">
                    {iniciais(c.nome)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.nome}</span>
                    {c.naoLidas > 0 && (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[0.65rem] font-medium text-primary-foreground">
                        {c.naoLidas}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.ultima.remetente === "admin" ? "Você: " : ""}
                    {c.ultima.texto}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const threadEl = (
    <Card className="flex min-h-[28rem] flex-col">
      {!sel ? (
        <p className="m-auto rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
          Selecione uma conversa para ver as mensagens.
        </p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => setChaveSel(null)}
              className="rounded-xl border border-border p-2 md:hidden"
              aria-label="Voltar às conversas"
            >
              <ArrowLeft className="size-4" />
            </button>
            <Avatar className="bg-gradient-primary text-primary-foreground">
              <AvatarFallback className="bg-transparent text-primary-foreground">
                {iniciais(sel.nome)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-display text-xl">{sel.nome}</p>
              <p className="text-xs text-muted-foreground">{sel.detalhe}</p>
            </div>
          </div>
          <div ref={threadRef} className="max-h-[32rem] flex-1 space-y-3 overflow-y-auto pr-1">
            {sel.itens.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${
                  m.remetente === "admin"
                    ? "ml-auto bg-gradient-primary text-primary-foreground shadow-soft"
                    : "bg-muted/70"
                }`}
              >
                <p>{m.texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder={`Responder para ${sel.nome.split(" ")[0]}...`}
              className="rounded-xl"
              disabled={!podeResponder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  responder();
                }
              }}
            />
            {!podeResponder && (
              <p className="text-xs text-muted-foreground">
                Sem sessão vinculada — não há como responder esta conversa.
              </p>
            )}
            <Button
              className="w-full gradient-primary text-primary-foreground"
              disabled={!podeResponder || enviarMutation.isPending}
              onClick={responder}
            >
              {enviarMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Enviar mensagem
            </Button>
          </div>
        </>
      )}
    </Card>
  );

  return (
    <AdminShell
      title="Mensagens por cliente"
      subtitle="Conversas privadas com cada cliente — selecione e responda (RF16)"
    >
      {/* Mobile: lista ou conversa; desktop: lado a lado */}
      <div className="grid gap-6 md:hidden">
        {sel ? threadEl : listaEl}
      </div>
      <div className="hidden gap-6 md:grid md:grid-cols-[20rem_1fr]">
        {listaEl}
        {threadEl}
      </div>
    </AdminShell>
  );
}
