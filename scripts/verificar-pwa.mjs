// Confere o PWA do app do colaborador no Chrome headless: manifest lido pelo
// navegador, service worker no escopo /app e erros de instalabilidade.
//
//   npm run dev                 (em outro terminal)
//   npm run test:pwa
//
// Observacao: roda contra o servidor de DESENVOLVIMENTO e registra o service
// worker na mao, porque o app so o registra em producao (`import.meta.env.DEV`).
// O build de producao do projeto e um Worker (preset cloudflare-module) e nao
// sobe localmente sem o wrangler. Instalar de fato num celular nao da para
// automatizar: fica como conferencia manual no aparelho.

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:8080";
const porta = 9555;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${mkdtempSync(resolve(tmpdir(), "chrome-pwa-"))}`,
    "--window-size=420,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let alvos;
for (let i = 0; i < 40; i++) {
  try {
    alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
    if (alvos.length) break;
  } catch {}
  await dorme(500);
}
const ws = new WebSocket(alvos.find((a) => a.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) (pend.get(d.id)(d.result ?? d.error), pend.delete(d.id));
};
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pend.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const js = async (e) =>
  (await cdp("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result
    ?.value;

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Page.navigate", { url: `${BASE}/app/entrar?empresa=enerpeixe` });
await dorme(9000);

let falhas = 0;
const checar = (ok, d, det = "") => {
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok   " : "FALHOU"} ${d}${!ok && det ? " — " + det : ""}`);
};

const man = await cdp("Page.getAppManifest");
console.log("manifest lido pelo Chrome:", man.url);
let dados = {};
try {
  dados = JSON.parse(man.data || "{}");
} catch {}
checar(man.errors?.length === 0, "o Chrome le o manifest sem erro", JSON.stringify(man.errors));
checar(dados.name === "T.I.M.E. Seguro", `nome (${dados.name})`);
checar(
  dados.start_url?.endsWith("/app") && dados.scope?.endsWith("/app"),
  `start_url e scope em /app (${dados.start_url} | ${dados.scope})`,
);
checar(dados.display === "standalone", `display standalone (${dados.display})`);
checar(
  dados.icons?.some((i) => i.purpose === "maskable"),
  "tem icone maskable",
);

const reg = await js(
  `navigator.serviceWorker.register('/sw.js', { scope: '/app' }).then(r => r.scope).catch(e => 'ERRO ' + e.message)`,
);
checar(String(reg).endsWith("/app"), `service worker registra no escopo /app (${reg})`);
await dorme(3000);
const ativo = await js(
  `navigator.serviceWorker.getRegistration('/app/').then(r => r ? (r.active ? 'ativo' : r.installing ? 'instalando' : 'sem estado') : 'nenhum')`,
);
checar(ativo === "ativo", `service worker ficou ativo (${ativo})`);
const nomeCache = await js(`caches.keys().then(k => k.join(','))`);
checar(/time-v1/.test(nomeCache), `cache do T.I.M.E. criado (${nomeCache})`);
const foraDoEscopo = await js(
  `navigator.serviceWorker.getRegistration('/painel/').then(r => r ? r.scope : 'nenhum')`,
);
checar(
  foraDoEscopo === "nenhum" || !String(foraDoEscopo).includes("/painel"),
  `o painel fica FORA do service worker (${foraDoEscopo})`,
);

const inst = await cdp("Page.getInstallabilityErrors");
const erros = (inst.installabilityErrors ?? []).map((e) => e.errorId);
console.log("   erros de instalabilidade:", erros.length ? erros.join(", ") : "nenhum");
checar(erros.length === 0, "o Chrome considera o app instalavel (sem erros de instalabilidade)");

console.log(falhas === 0 ? "\nPWA: tudo conferido." : `\nPWA: ${falhas} FALHA(S).`);
chrome.kill();
process.exit(falhas === 0 ? 0 : 1);
