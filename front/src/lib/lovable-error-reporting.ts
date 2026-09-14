export function reportLovableError(error: unknown, context?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.error("[lovable-error]", error, context);
  }
}
