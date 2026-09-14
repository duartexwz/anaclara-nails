export function renderErrorPage(message = "Algo não saiu como esperado.") {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Ana Clara Nails</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f3ff;color:#3d3491"><div style="text-align:center"><h1>Ana Clara Nails</h1><p>${message}</p><a href="/">Voltar ao início</a></div></body></html>`;
}
