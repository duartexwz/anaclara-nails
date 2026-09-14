import { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (!caixaRef.current?.contains(e.target as Node)) setAberto(false);
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
    <div className="relative" ref={caixaRef}>
      <button
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

      {aberto && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card">
          <div className="flex items-center justify-between px-5 py-4">
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

          <ul className="max-h-80 space-y-1 overflow-y-auto px-2 pb-2">
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
          <p className="border-t border-border/60 px-5 py-2.5 text-[11px] text-muted-foreground">
            Atualizado agora · {naoLidas} não lida{naoLidas === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}
