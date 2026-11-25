/* Andamo — Service Worker: Web Push, cache estratégico e página offline. */
const VERSION = "v1";
const STATIC_CACHE = `andamo-static-${VERSION}`;
const SCOPE = self.registration.scope; // ex.: https://usuario.github.io/TaskFlow/
const PRECACHE = ["offline.html", "favicon.svg", "icon.svg", "manifest.webmanifest"].map((p) => new URL(p, SCOPE).toString());

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("andamo-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Respostas da API nunca são guardadas (dados privados): passam direto.
  if (url.origin !== self.location.origin) return;

  // Navegação: rede primeiro; sem conexão, versão em cache do app ou a página offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(new URL("./", SCOPE).toString(), copy));
          return res;
        })
        .catch(async () => (await caches.match(new URL("./", SCOPE).toString())) || caches.match(PRECACHE[0])),
    );
    return;
  }

  // Arquivos versionados do build (/assets/*-hash.js|css): cache primeiro.
  if (url.pathname.includes("/assets/") || PRECACHE.includes(url.toString())) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// ---------------------------------------------------------------- Web Push
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Andamo", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Andamo", {
      body: data.body || "",
      icon: new URL("icon.svg", SCOPE).toString(),
      badge: new URL("favicon.svg", SCOPE).toString(),
      tag: data.tag,
      data: { url: data.url || "/app/notificacoes" },
    }),
  );
});

// Clique: foca uma aba aberta do Andamo (ou abre uma) já na tarefa/projeto da notificação.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = `${SCOPE}#${event.notification.data?.url || "/app"}`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(SCOPE) && "focus" in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
