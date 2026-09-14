/**
 * PWA — registro do Service Worker, fluxo de atualização e instalabilidade.
 * O SW (/sw.js) cuida de cache offline + Web Push; aqui vai só o lado cliente.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptAdiado: BeforeInstallPromptEvent | null = null;
let ouvindoInstalacao = false;

function observarPromptInstalacao() {
  if (ouvindoInstalacao || typeof window === "undefined") return;
  ouvindoInstalacao = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptAdiado = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa:instalavel"));
  });
}

export function podeInstalar(): boolean {
  return promptAdiado !== null;
}

export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function solicitarInstalacao(): Promise<boolean> {
  if (!promptAdiado) return false;
  await promptAdiado.prompt();
  const { outcome } = await promptAdiado.userChoice;
  promptAdiado = null;
  return outcome === "accepted";
}

async function registrarSW(
  aoAtualizar: () => void,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registro =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
    // Há versão nova esperando? Oferece atualização imediata.
    if (registro.waiting) {
      aoAtualizar();
    }
    registro.addEventListener("updatefound", () => {
      const novo = registro.installing;
      if (!novo) return;
      novo.addEventListener("statechange", () => {
        if (novo.state === "installed" && navigator.serviceWorker.controller) {
          aoAtualizar();
        }
      });
    });
    let recarregado = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recarregado) return;
      recarregado = true;
      window.location.reload();
    });
    return registro;
  } catch {
    return null;
  }
}

/** Monta no RootComponent: registra o SW e avisa quando há versão nova. */
export function PwaUpdater() {
  const [, setVersao] = useState(0);
  useEffect(() => {
    observarPromptInstalacao();
    let ativo = true;
    void registrarSW(() => {
      if (!ativo) return;
      setVersao((v) => v + 1);
      toast("Nova versão disponível", {
        description: "Atualize para receber as novidades.",
        action: {
          label: "Atualizar",
          onClick: () => {
            navigator.serviceWorker
              .getRegistration()
              .then((r) => r?.waiting?.postMessage({ type: "SKIP_WAITING" }));
          },
        },
        duration: Infinity,
      });
    });
    return () => {
      ativo = false;
    };
  }, []);
  return null;
}

/** Hook p/ exibir botão "Instalar app" quando o navegador permitir. */
export function useInstalavel(): boolean {
  const [instalavel, setInstalavel] = useState(
    () => promptAdiado !== null && !estaInstalado(),
  );
  useEffect(() => {
    observarPromptInstalacao();
    const atualizar = () =>
      setInstalavel(promptAdiado !== null && !estaInstalado());
    atualizar();
    window.addEventListener("pwa:instalavel", atualizar);
    return () => window.removeEventListener("pwa:instalavel", atualizar);
  }, []);
  return instalavel;
}
