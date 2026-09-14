let lastError: unknown = null;

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    lastError = e.error ?? e.message;
  });
}

export function consumeLastCapturedError() {
  const e = lastError;
  lastError = null;
  return e as Error | null;
}
