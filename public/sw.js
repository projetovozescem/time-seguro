/*
 * Service worker do app do colaborador (T.I.M.E. Seguro).
 *
 * Propositalmente mínimo e conservador: um service worker agressivo demais
 * deixaria colaboradores presos numa versão quebrada do app. As regras são:
 *   - só mexe em requisições GET da mesma origem (as chamadas ao Supabase,
 *     que são de outra origem, nunca passam pelo cache);
 *   - navegações: rede primeiro, cache como rede de segurança offline;
 *   - assets versionados do build: cache primeiro, porque o nome já muda a
 *     cada deploy.
 *
 * Suba a VERSAO para descartar o cache antigo num próximo deploy.
 */

const VERSAO = "time-v1";
const CACHE = `${VERSAO}-cache`;

self.addEventListener("install", (evento) => {
  // Assume o controle já na primeira visita, sem esperar as abas fecharem.
  self.skipWaiting();
  evento.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Assets do build podem ser servidos do cache direto porque o nome já carrega
 * o hash do conteúdo (ex.: /assets/CartaoCampanha-C8Xw44Iq.js) e muda a cada
 * deploy. É este o caminho que o Vite/TanStack gera na pasta de saída.
 */
function ehAssetVersionado(url) {
  return url.pathname.startsWith("/assets/");
}

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  // Outra origem (Supabase, fontes do Google) segue direto para a rede.
  if (url.origin !== self.location.origin) return;

  if (requisicao.mode === "navigate") {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(requisicao);
          const cache = await caches.open(CACHE);
          cache.put(requisicao, resposta.clone());
          return resposta;
        } catch {
          // Offline: devolve a última versão vista desta página, ou a entrada do app.
          const cache = await caches.open(CACHE);
          return (await cache.match(requisicao)) ?? (await cache.match("/app")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (ehAssetVersionado(url)) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const salvo = await cache.match(requisicao);
        if (salvo) return salvo;
        const resposta = await fetch(requisicao);
        if (resposta.ok) cache.put(requisicao, resposta.clone());
        return resposta;
      })(),
    );
  }
});
