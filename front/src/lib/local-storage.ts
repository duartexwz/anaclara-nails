/**
 * Gerenciador de armazenamento local (localStorage) para a Ana Clara Nails.
 * Armazena e recupera os dados mais usados no site (sessão do usuário, modelos do catálogo,
 * dados do cliente) para carregamento instantâneo e offline/fast-boot (RNF05).
 */

export const STORAGE_KEYS = {
  USER: "ana-clara-user",
  ACCESS_TOKEN: "ana-clara-access",
  REFRESH_TOKEN: "ana-clara-refresh",
  MODELOS: "ana-clara-cache-modelos",
  STATUS: "ana-clara-cache-status",
  CLIENTE: "ana-clara-cache-cliente",
  AUTO_RELOAD: "ana-clara-auto-reload",
} as const;

interface CacheEnvelope<T> {
  data: T;
  timestamp: number;
  ttlMs?: number;
}

export function salvarItem<T>(chave: string, valor: T, ttlMs?: number): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: CacheEnvelope<T> = {
      data: valor,
      timestamp: Date.now(),
      ttlMs,
    };
    localStorage.setItem(chave, JSON.stringify(envelope));
  } catch (err) {
    console.warn(`[localStorage] Falha ao salvar chave ${chave}:`, err);
  }
}

export function obterItem<T>(chave: string, padrao: T | null = null): T | null {
  if (typeof window === "undefined") return padrao;
  try {
    const raw = localStorage.getItem(chave);
    if (!raw) return padrao;
    const parsed = JSON.parse(raw) as CacheEnvelope<T> | T;
    // Suporte tanto para dados puros quanto para envelope com TTL
    if (parsed && typeof parsed === "object" && "timestamp" in parsed && "data" in parsed) {
      const envelope = parsed as CacheEnvelope<T>;
      if (envelope.ttlMs && Date.now() - envelope.timestamp > envelope.ttlMs) {
        localStorage.removeItem(chave);
        return padrao;
      }
      return envelope.data;
    }
    return parsed as T;
  } catch {
    return padrao;
  }
}

export function removerItem(chave: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(chave);
  } catch {
    /* ignore */
  }
}

export function limparCacheGeral(): void {
  if (typeof window === "undefined") return;
  try {
    removerItem(STORAGE_KEYS.USER);
    removerItem(STORAGE_KEYS.ACCESS_TOKEN);
    removerItem(STORAGE_KEYS.REFRESH_TOKEN);
    removerItem(STORAGE_KEYS.CLIENTE);
    // Preserva modelos e status pois são públicos
  } catch {
    /* ignore */
  }
}
