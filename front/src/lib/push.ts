/**
 * Web Push no dispositivo logado da admin.
 * Registra o service worker, pede permissão, assina com a chave VAPID
 * do backend e salva a inscrição via API.
 */
import { getVapidKeyApi, salvarPushSubscriptionApi } from "./api";

function base64ParaUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const crua = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binaria = window.atob(crua);
  const buffer = new ArrayBuffer(binaria.length);
  const saida = new Uint8Array(buffer);
  for (let i = 0; i < binaria.length; i++) saida[i] = binaria.charCodeAt(i);
  return saida;
}

export function pushSuportado(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permissaoPush(): NotificationPermission | "indisponivel" {
  if (!pushSuportado()) return "indisponivel";
  return Notification.permission;
}

/**
 * Inscreve o dispositivo atual. Retorna 'ok' | 'negado' | 'indisponivel' | 'sem-chave'.
 * Idempotente no backend (endpoint UNIQUE).
 */
export async function inscreverPush(): Promise<
  "ok" | "negado" | "indisponivel" | "sem-chave" | "falha"
> {
  if (!pushSuportado()) return "indisponivel";
  if (Notification.permission === "denied") return "negado";
  if (Notification.permission === "default") {
    const resposta = await Notification.requestPermission();
    if (resposta !== "granted") return "negado";
  }
  const vapidKey = await getVapidKeyApi();
  if (!vapidKey) return "sem-chave";
  try {
    const registro = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ParaUint8(vapidKey),
    });
    const json = inscricao.toJSON();
    const p256dh = json.keys?.["p256dh"] ?? "";
    const auth = json.keys?.["auth"] ?? "";
    if (!p256dh || !auth) return "falha";
    await salvarPushSubscriptionApi({
      endpoint: inscricao.endpoint,
      p256dh,
      auth,
    });
    try {
      localStorage.setItem("ana-clara-push", "1");
    } catch {
      /* sem storage */
    }
    return "ok";
  } catch {
    return "falha";
  }
}

export function pushAtivoLocal(): boolean {
  try {
    return localStorage.getItem("ana-clara-push") === "1";
  } catch {
    return false;
  }
}
