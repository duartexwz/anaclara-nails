import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  CalendarPlus,
  CalendarX2,
  CheckCheck,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  listarNotificacoesApi,
  marcarTodasLidasApi,
  type NotificacaoApi,
} from "@/lib/api";
import { inscreverPush, pushAtivoLocal, pushSuportado } from "@/lib/push";

const ICONES: Record<string, typeof Bell> = {
  agendamento: CalendarPlus,
  cancelamento: CalendarX2,
  pagamento: CreditCard,
  mensagem: MessageCircle,
};

function tempoRelativo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export function SinoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<NotificacaoApi[]>([]);
  const [pushPedido, setPushPedido] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const sinoRef = useRef<HTMLButtonElement>(null);
  const naoLidasRef = useRef(0);

  const carregar = useCallback(async (avisarNovas = false) => {
    try {
      const lista = await listarNotificacoesApi();
      const ordenada = [...lista].sort((a, b) => b.id - a.id).slice(0, 20);
      const novas = ordenada.filter((n) => !n.lida).length;
      if (avisarNovas && novas > naoLidasRef.current) {
        const primeira = ordenada.find((n) => !n.lida);
        if (primeira) toast.info(primeira.titulo, { description: primeira.mensagem });
      }
      naoLidasRef.current = novas;
      setItens(ordenada);
    } catch {
      /* backend fora: sino fica quieto */
    }
  }, []);

  useEffect(() => {
    void carregar(false);
    const id = setInterval(() => void carregar(true), 30000);
    const aoFocar = () => void carregar(true);
    window.addEventListener("focus", aoFocar);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", aoFocar);
    };
  }, [carregar]);

  // Mede o sino para ancorar o painel no desktop (via portal, fora do
  // header com blur — blur aprisiona `fixed`, por isso centralizava errado).
  // Posição 100% inline: não depende do scanner do Tailwind.
  const [estiloPainel, setEstiloPainel] = useState<React.CSSProperties>({});
  useLayoutEffect(() => {
    if (!aberto) return;
    const medir = () => {
      if (window.innerWidth < 640) {
        setEstiloPainel({
          top: "50%",
          transform: "translateY(-50%)",
          left: 0,
          right: 0,
          marginLeft: "auto",
          marginRight: "auto",
          width: "calc(100vw - 2rem)",
          maxWidth: 340,
          maxHeight: "80dvh",
        });
        return;
      }
      const el = sinoRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setEstiloPainel({
        top: Math.round(r.bottom + 8),
        right: Math.round(window.innerWidth - r.right),
        width: 320,
      });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (sinoRef.current?.contains(alvo)) return;
      if (!caixaRef.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  // Oferece o push no dispositivo uma única vez por login
  useEffect(() => {
    if (!pushSuportado() || pushAtivoLocal()) return;
    setPushPedido(true);
  }, []);

  const ativarPush = async () => {
    const resultado = await inscreverPush();
    setPushPedido(false);
    if (resultado === "ok") toast.success("Notificações ativadas neste aparelho");
    else if (resultado === "negado") toast.error("Permissão de notificação negada");
    else if (resultado === "sem-chave") toast.error("Push ainda não configurado no servidor");
    else if (resultado !== "indisponivel") toast.error("Não foi possível ativar agora");
  };

  const marcarTodas = async () => {
    try {
      await marcarTodasLidasApi();
      setItens((atual) => atual.map((n) => ({ ...n, lida: true })));
      naoLidasRef.current = 0;
    } catch {
      toast.error("Não foi possível marcar como lidas");
    }
  };

  const naoLidas = itens.filter((n) => !n.lida).length;

  return (
    <div className="relative">
      <button
        ref={sinoRef}
        className="relative rounded-2xl border border-border bg-card p-2.5"
        aria-label="Notificações"
        onClick={() => setAberto((v) => !v)}
      >
        <Bell className="size-5 text-primary" />
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={caixaRef}
            className="fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card"
            style={estiloPainel}
          >
          <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
            <p className="font-display text-lg">Notificações</p>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodas}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" /> Marcar todas
              </button>
            )}
          </div>

          {pushPedido && (
            <button
              onClick={ativarPush}
              className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-gradient-primary p-3 text-left text-primary-foreground shadow-soft"
            >
              <BellRing className="size-5 shrink-0" />
              <span className="text-xs">
                <span className="block font-medium">Receber avisos neste aparelho</span>
                <span className="opacity-85">Agendamentos, pagamentos e mensagens</span>
              </span>
            </button>
          )}

          <ul className="max-h-[50dvh] min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2 sm:max-h-80 sm:flex-none">
            {itens.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma novidade por aqui.
              </li>
            )}
            {itens.map((n) => {
              const Icone = ICONES[n.tipo] ?? Bell;
              return (
                <li key={n.id}>
                  <Link
                    to="/admin/agendamentos"
                    onClick={() => setAberto(false)}
                    className={`flex gap-3 rounded-2xl p-3 transition-colors hover:bg-accent ${
                      n.lida ? "opacity-70" : "bg-accent/40"
                    }`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-primary text-primary-foreground">
                      <Icone className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{n.titulo}</span>
                        {!n.lida && (
                          <span className="size-1.5 shrink-0 rounded-full bg-secondary" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {n.mensagem}
                      </span>
                      {tempoRelativo(n.created_at) && (
                        <span className="block text-[11px] text-muted-foreground/70">
                          {tempoRelativo(n.created_at)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="shrink-0 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground sm:px-5 sm:py-2.5">
            Atualizado agora · {naoLidas} não lida{naoLidas === 1 ? "" : "s"}
          </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
