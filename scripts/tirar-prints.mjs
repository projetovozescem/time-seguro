// Tira print de todas as telas do painel, logado como o admin do .env, e grava
// em docs/telas/ com nomes numerados (1-Tela_Login.png, 2-Tela_Inicio.png, ...).
//
//   npm run dev                 (em outro terminal)
//   npm run prints
//
// So le: navega, clica em abas e fotografa. Nao cria nem altera dado nenhum.
// Pre-requisitos: servidor em http://localhost:8080 (ou BASE=...), Google Chrome
// (CHROME_PATH se nao estiver no caminho padrao) e .env com BOOTSTRAP_EMAIL/SENHA.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(raiz, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE = process.env.BASE ?? "http://localhost:8080";
const PASTA = resolve(raiz, "docs/telas");
mkdirSync(PASTA, { recursive: true });

const porta = 9558;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${mkdtempSync(resolve(tmpdir(), "chrome-prints-"))}`,
    "--hide-scrollbars",
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
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

const falhas = [];

/** Abre a rota e espera ate o texto esperado aparecer e o "Carregando" sumir. */
async function abrir(rota, esperado) {
  await cdp("Page.navigate", { url: BASE + rota });
  for (let i = 0; i < 40; i++) {
    await dorme(500);
    const t = (await js("document.body.innerText")) ?? "";
    if (t.includes(esperado) && !t.includes("Carregando")) {
      await dorme(1200);
      return true;
    }
  }
  return false;
}

async function clicarAba(texto) {
  const ok = await js(`(() => { const b = [...document.querySelectorAll('[role=tab], button')]
    .find(x => x.innerText.trim().includes(${JSON.stringify(texto)})); if (!b) return false; b.click(); return true; })()`);
  await dorme(2500);
  return ok;
}

async function print(arquivo) {
  const { data } = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  const caminho = resolve(PASTA, arquivo);
  writeFileSync(caminho, Buffer.from(data, "base64"));
  const kb = Math.round(statSync(caminho).size / 1024);
  console.log(`  ${kb < 20 ? "SUSPEITO" : "ok      "} ${arquivo} (${kb} KB)`);
  if (kb < 20) falhas.push(`${arquivo}: arquivo muito pequeno`);
}

async function tela(arquivo, rota, esperado, aba) {
  const carregou = await abrir(rota, esperado);
  if (carregou && aba && !(await clicarAba(aba))) {
    falhas.push(`${arquivo}: aba "${aba}" nao encontrada`);
    return;
  }
  if (!carregou) {
    falhas.push(`${arquivo}: "${esperado}" nao apareceu em ${rota}`);
    return;
  }
  await print(arquivo);
}

try {
  console.log("Prints em", PASTA);
  // 1 - login, antes de entrar
  await tela("1-Tela_Login.png", "/painel/login", "Entrar");

  // entra
  await js(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); };
    set(document.querySelector('input[type=email]'), ${JSON.stringify(env.BOOTSTRAP_EMAIL)});
    set(document.querySelector('input[type=password]'), ${JSON.stringify(env.BOOTSTRAP_SENHA)});
    document.querySelector('button[type=submit]').click(); })()`);
  await dorme(10000);
  if ((await js("location.pathname")) !== "/painel") {
    console.error("Login nao entrou no painel (" + (await js("location.pathname")) + ").");
    throw new Error("login");
  }

  await tela("2-Tela_Inicio.png", "/painel", "Início");
  await tela("3-Tela_Colaboradores.png", "/painel/colaboradores", "Colaboradores");
  await tela(
    "4-Tela_Colaboradores_Pendentes.png",
    "/painel/colaboradores",
    "Pendentes",
    "Pendentes",
  );
  await tela(
    "5-Tela_Setores_e_Locais.png",
    "/painel/colaboradores",
    "Setores e locais",
    "Setores e locais",
  );
  await tela("6-Tela_Cartoes_de_Acesso.png", "/painel/colaboradores/cartoes", "cart");
  await tela("7-Tela_Campanhas.png", "/painel/campanhas", "Outubro Rosa");

  // detalhe: segue o link "Abrir" da campanha ativa (NR-1)
  if (await abrir("/painel/campanhas", "Foco Total na NR-1")) {
    const href = await js(`(() => { const li = [...document.querySelectorAll('main ul > li')]
      .find(x => x.innerText.includes('Foco Total na NR-1')); return li?.querySelector('a')?.getAttribute('href') ?? ''; })()`);
    if (href) await tela("8-Tela_Campanha_Detalhe.png", href, "Foco Total na NR-1");
    else falhas.push("8-Tela_Campanha_Detalhe.png: link Abrir nao encontrado");
  }

  await tela("9-Tela_Perguntas.png", "/painel/perguntas", "pergunta(s)");
  await tela("10-Tela_Importar_Perguntas.png", "/painel/perguntas/importar", "mport");
  await tela("11-Tela_Eventos.png", "/painel/eventos", "Eventos");
  await tela("12-Tela_Ranking.png", "/painel/ranking", "Ranking");
  await tela("13-Tela_Certificados.png", "/painel/certificados", "emitido");
  await tela("14-Tela_Relatos.png", "/painel/relatos", "relato(s)");
  await tela("15-Tela_Canal_de_Respeito.png", "/painel/respeito", "denúncia(s)");
  await tela("16-Tela_Resultados.png", "/painel/analytics", "Mapa de lacunas", "Mapa de lacunas");
  await tela("17-Tela_Relatorios.png", "/painel/relatorios", "Colaboradores");
  await tela("18-Tela_Materiais.png", "/painel/materiais", "cartaz");
  await tela("19-Tela_Modo_TV.png", "/tv", "TV");
  await tela("20-Tela_Configuracoes.png", "/painel/configuracoes", "Configurações");
} catch (e) {
  if (e.message !== "login") console.error(e);
  falhas.push("interrompido: " + e.message);
} finally {
  chrome.kill();
}

console.log(
  falhas.length === 0 ? "\nTodos os prints foram salvos." : `\n${falhas.length} PROBLEMA(S):`,
);
for (const f of falhas) console.log("  -", f);
process.exit(falhas.length === 0 ? 0 : 1);
