import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { obterItem, salvarItem, STORAGE_KEYS } from "@/lib/local-storage";

const INTERVALO_MS = 60_000; // 1 minuto (60 segundos)

/**
 * Componente de auto reload a cada 1 minuto (60s).
 * Mantém todos os dados do site (agendamentos, mensagens, catálogo e status)
 * perfeitamente atualizados e sincronizados em segundo plano com UI fluida,
 * sem resetar formulários nem atrapalhar a digitação do usuário.
 */
export function AutoReloader() {
  const queryClient = useQueryClient();
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Salva o timestamp da última checagem no localStorage
    salvarItem(STORAGE_KEYS.AUTO_RELOAD, { timestamp: Date.now() });

    const recarregar = () => {
      const agora = Date.now();
      setUltimaAtualizacao(agora);
      salvarItem(STORAGE_KEYS.AUTO_RELOAD, { timestamp: agora });
      void queryClient.invalidateQueries();
    };

    timerRef.current = setInterval(recarregar, INTERVALO_MS);

    // Quando o usuário volta à aba do navegador após mais de 1 minuto, atualiza imediatamente
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") {
        const salvo = obterItem<{ timestamp: number }>(STORAGE_KEYS.AUTO_RELOAD);
        const tempoDecorrido = salvo?.timestamp ? Date.now() - salvo.timestamp : INTERVALO_MS;
        if (tempoDecorrido >= INTERVALO_MS) {
          recarregar();
        }
      }
    };

    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [queryClient]);

  return null;
}
