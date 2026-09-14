/* Ana Clara Nails — PWA: cache offline + Web Push da admin.
 * Estratégias:
 *  - Navegações: NetworkFirst (conteúdo sempre fresco; cai p/ cache offline)
 *  - Imagens e fontes: CacheFirst (imutáveis, resposta instantânea)
 *  - JS/CSS da app: StaleWhileRevalidate (rápido e sempre atualiza)
 *  - GETs da API: StaleWhileRevalidate (dados carregados mesmo offline)
 *  - POST/PUT/DELETE e terceiros (ex.: Mercado Pago): direto à rede
 */
const VERSAO = "v1";
const CACHE_PAGINAS = `ana-clara-paginas-${VERSAO}`;
const CACHE_IMAGENS = `ana-clara-imagens-${VERSAO}`;
const CACHE_ESTATICOS = `ana-clara-estaticos-${VERSAO}`;
const CACHE_API = `ana-clara-api-${VERSAO}`;
const TODOS_CACHES = [CACHE_PAGINAS, CACHE_IMAGENS, CACHE_ESTATICOS, CACHE_API];

const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

const PAGINA_OFFLINE = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ana Clara Nails — Offline</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f1fd;color:#3b3470;
display:grid;place-items:center;min-height:100dvh;margin:0;text-align:center;padding:24px}
.card{background:#fff;border-radius:24px;padding:32px;max-width:340px;box-shadow:0 18px 40px -24px #6959CD73}
h1{font-size:22px;margin:0 0 8px}p{font-size:14px;color:#6b6580}
button{margin-top:16px;background:linear-gradient(135deg,#6959CD,#836FFF);color:#fff;
border:0;border-radius:14px;padding:12px 24px;font-size:14px;cursor:pointer}</style></head>
<body><div class="card"><h1>Você está offline</h1>
<p>Verifique sua conexão. Seus dados salvos continuam disponíveis.</p>
<button onclick="location.reload()">Tentar novamente</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((c) => c.startsWith("ana-clara-") && !TODOS_CACHES.includes(c))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function somenteLeitura(request) {
  return request.method === "GET";
}

async function redePrimeiro(request, cacheNome, fallbackOffline) {
  const cache = await caches.open(cacheNome);
  try {
    const resposta = await fetch(request);
    if (resposta && (resposta.ok || resposta.type === "opaque")) {
      cache.put(request, resposta.clone()).catch(() => {});
    }
    return resposta;
  } catch {
    const emCache = await cache.match(request);
    if (emCache) return emCache;
    if (fallbackOffline) {
      return new Response(PAGINA_OFFLINE, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    throw new Error("offline");
  }
}

async function cachePrimeiro(request, cacheNome) {
  const cache = await caches.open(cacheNome);
  const emCache = await cache.match(request);
  if (emCache) return emCache;
  const resposta = await fetch(request);
  if (resposta && (resposta.ok || resposta.type === "opaque")) {
    cache.put(request, resposta.clone()).catch(() => {});
  }
  return resposta;
}

async function rapidoERevalidado(request, cacheNome) {
  const cache = await caches.open(cacheNome);
  const emCache = await cache.match(request);
  const busca = fetch(request)
    .then((resposta) => {
      if (resposta && (resposta.ok || resposta.type === "opaque")) {
        cache.put(request, resposta.clone()).catch(() => {});
      }
      return resposta;
    })
    .catch(() => undefined);
  if (emCache) {
    // Revalida em segundo plano sem atrasar a resposta.
    if (busca && busca.catch) busca.catch(() => {});
    return emCache;
  }
  return busca;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!somenteLeitura(request)) return;
  const url = new URL(request.url);

  // Navegação entre telas: tenta a rede, usa o cache offline se cair.
  if (request.mode === "navigate") {
    event.respondWith(redePrimeiro(request, CACHE_PAGINAS, true));
    return;
  }

  // API (mesma origem): rápida via cache, revalida em segundo plano.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(rapidoERevalidado(request, CACHE_API));
    return;
  }

  // Imagens e fontes (inclui Google Fonts): cache primeiro.
  const ehMidia =
    request.destination === "image" ||
    request.destination === "font" ||
    url.hostname === "fonts.gstatic.com";
  if (ehMidia) {
    event.respondWith(cachePrimeiro(request, CACHE_IMAGENS));
    return;
  }

  // JS/CSS/assets da própria origem: rápido e sempre atualiza.
  if (
    url.origin === self.location.origin &&
    (request.destination === "script" ||
      request.destination === "style" ||
      url.pathname.startsWith("/assets/"))
  ) {
    event.respondWith(rapidoERevalidado(request, CACHE_ESTATICOS));
    return;
  }
  // Demais casos (Mercado Pago, etc.): segue direto para a rede.
});

/* ------------------------- Web Push da admin ------------------------- */
self.addEventListener("push", (event) => {
  let dados = { title: "Ana Clara Nails", body: "", agendamento_id: null };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    if (event.data) dados.body = event.data.text();
  }
  const titulo = dados.title || "Ana Clara Nails";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "Novidade na sua agenda.",
      icon: "/icon-192.png",
      badge: "/icon-32.png",
      tag: dados.agendamento_id
        ? `agendamento-${dados.agendamento_id}`
        : "ana-clara-nails",
      renotify: true,
      data: { url: "/admin/agendamentos" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((janelas) => {
        for (const j of janelas) {
          if ("focus" in j) {
            j.navigate(url);
            return j.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
