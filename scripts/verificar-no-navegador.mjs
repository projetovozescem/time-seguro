// Verificacao de ponta a ponta NO NAVEGADOR (Chrome headless, protocolo
// DevTools): painel do tecnico + app do colaborador, pela interface de verdade.
//
//   npm run dev                 (em outro terminal)
//   npm run test:e2e
//
// Por que existe: tsc, vitest, RLS e fluxo SQL passaram durante meses com o
// login do colaborador QUEBRADO na interface (a tela chamava a RPC com
// parametros que ela nao tem), com o menu do painel vazio e com F5 deslogando.
// Nenhum deles abre um navegador. Este abre.
//
// Pre-requisitos: servidor de dev em http://localhost:8080 (ou BASE=...), Google
// Chrome instalado (CHROME_PATH se nao estiver no caminho padrao do Windows), e
// o .env com BOOTSTRAP_EMAIL/BOOTSTRAP_SENHA. Cria dados de TESTE com prefixo
// `e2e` na empresa piloto e os remove no fim.

import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { consultar } from "./_db.mjs";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  readFileSync(resolve(raiz, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const BASE = process.env.BASE ?? "http://localhost:8080";
const porta = 9444;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";

const chrome = spawn(
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${mkdtempSync(resolve(tmpdir(), "chrome-e2e-"))}`,
    "--window-size=1280,900",
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
const erros = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) return (pend.get(d.id)(d.result ?? d.error), pend.delete(d.id));
  if (d.method === "Runtime.exceptionThrown")
    erros.push(
      "EXCECAO: " +
        (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(
          0,
          300,
        ),
    );
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error")
    erros.push(
      "console.error: " +
        d.params.args
          .map((a) => a.value ?? a.description ?? "")
          .join(" ")
          .slice(0, 400),
    );
};
const cdp = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pend.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const js = async (expr) =>
  (await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))
    .result?.value;
await cdp("Runtime.enable");
await cdp("Page.enable");

let total = 0;
let falhas = 0;
const checar = (ok, desc, detalhe = "") => {
  total++;
  if (!ok) falhas++;
  console.log(`  ${ok ? "ok   " : "FALHOU"} ${desc}${!ok && detalhe ? ` — ${detalhe}` : ""}`);
};
const ir = async (rota, espera = 7000) => {
  await cdp("Page.navigate", { url: `${BASE}${rota}` });
  await dorme(espera);
};
const preencher = (seletor, valor) =>
  js(`(() => { const el = document.querySelector(${JSON.stringify(seletor)}); if (!el) return false;
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(valor)});
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
const clicarTexto = (texto, seletor = "button") =>
  js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(seletor)})].find(x => x.innerText.trim().includes(${JSON.stringify(texto)}) && !x.disabled);
    if (!b) return false; b.click(); return true; })()`);
const texto = () => js("document.body.innerText");

const selo = Date.now().toString().slice(-8);
const MAT = `e2e${selo}`;
const NOME = `Pessoa E2E ${selo}`;

try {
  // ---------------------------------------------------------- painel
  console.log("\n--- painel: login do admin ---");
  await ir("/painel/login", 12000);
  await js(`(() => { const set = (el, v) => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v) || el.dispatchEvent(new Event('input',{bubbles:true}));
    const e = document.querySelector('input[type=email]'), p = document.querySelector('input[type=password]');
    set(e, ${JSON.stringify(env.BOOTSTRAP_EMAIL)}); e.dispatchEvent(new Event('input',{bubbles:true}));
    set(p, ${JSON.stringify(env.BOOTSTRAP_SENHA)}); p.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('button[type=submit]').click(); })()`);
  await dorme(10000);
  checar(
    (await js("location.pathname")) === "/painel",
    `login do admin leva ao painel (${await js("location.pathname")})`,
  );

  console.log("\n--- Canal de Respeito em grade ---");
  await ir("/painel/respeito");
  const respeito = JSON.parse(
    await js(`(() => { const ul = [...document.querySelectorAll('main ul, ul')].find(u => u.className.includes('grid') && u.querySelector('li button'));
      if (!ul) return JSON.stringify({ achou: false });
      const cols = getComputedStyle(ul).gridTemplateColumns.split(' ').length;
      return JSON.stringify({ achou: true, cards: ul.children.length, colunas: cols, primeiro: ul.children[0].innerText.replace(/\\n+/g,' | ').slice(0,160) }); })()`),
  );
  checar(respeito.achou, "os cards estao numa grade (<ul class=grid>)");
  checar(respeito.colunas >= 2, `a grade tem varias colunas (${respeito.colunas}) em tela larga`);
  checar(respeito.cards > 1, `ha varios cards (${respeito.cards})`);
  console.log(`       primeiro card: ${respeito.primeiro}`);
  await js(`document.querySelector('ul.grid li button').click()`);
  await dorme(1200);
  const dlg = await js(`(document.querySelector('[role=dialog]')||{}).innerText || ''`);
  checar(
    dlg.includes("Local:") && dlg.includes("Período:"),
    "clicar no card abre o detalhe num dialogo",
    dlg.slice(0, 80),
  );

  console.log("\n--- Analytics: legenda ---");
  await ir("/painel/analytics");
  const legenda = await js(
    `(document.querySelector('[aria-label="Legenda do mapa de lacunas"]')||{}).innerText || ''`,
  );
  console.log(`       legenda: ${legenda.replace(/\n+/g, " | ")}`);
  for (const t of [
    "≥ 80%",
    "Domina o tema",
    "60–79%",
    "Atenção",
    "< 60%",
    "Lacuna: priorizar treinamento",
    "Dados insuficientes",
  ])
    checar(legenda.includes(t), `legenda traz "${t}"`);
  checar(/\d+ célula/.test(legenda), "cada faixa mostra quantas celulas tem");
  const cartoes = await js(
    `document.querySelectorAll('[aria-label="Legenda do mapa de lacunas"] li').length`,
  );
  checar(cartoes === 4, `4 cartoes de legenda (${cartoes})`);

  console.log("\n--- Colaboradores: abas e Ver PIN ---");
  await ir("/painel/colaboradores");
  const abas = await js(
    `[...document.querySelectorAll('[role=tab]')].map(t => t.innerText).join(' | ')`,
  );
  checar(abas.includes("Pendentes"), `aba Pendentes existe (${abas})`);
  const linha = JSON.parse(
    await js(
      `(() => { const tr = document.querySelector('tbody tr'); return JSON.stringify({ mat: tr.cells[1].innerText.trim(), nome: tr.cells[2].innerText.trim() }); })()`,
    ),
  );
  await js(
    `[...document.querySelector('tbody tr').querySelectorAll('button')].find(b => b.title === 'Ver PIN').click()`,
  );
  await dorme(1800);
  const pinTela = await js(
    `(document.querySelector('[role=dialog] .font-mono.text-5xl')||{}).innerText || ''`,
  );
  const [{ pin_fixo: pinBanco }] = await consultar(
    `select pin_fixo from public.colaboradores where matricula = ${lit(linha.mat)} and empresa_id = (select id from public.empresas where codigo='piloto')`,
  );
  checar(/^\d{6}$/.test(pinTela), `o dialogo mostra um PIN de 6 digitos (${pinTela})`);
  checar(pinTela === pinBanco, "o PIN mostrado e o que esta no banco");
  const acoes = await js(`document.querySelector('[role=dialog]').innerText`);
  checar(
    acoes.includes("Copiar mensagem pronta") && acoes.includes("Reemitir"),
    "tem copiar mensagem e reemitir (admin)",
  );
  await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await dorme(500);

  // ---------------------------------------------------------- autocadastro
  console.log("\n--- autocadastro (pagina publica do app) ---");
  await ir("/app/cadastro?empresa=piloto", 4000);
  checar(((await texto()) ?? "").includes("Peça seu cadastro"), "a pagina de cadastro abre");
  await preencher("#nome", NOME);
  await preencher("#matricula", MAT);
  await preencher("#email", `${MAT}@empresa-teste.invalid`);
  await dorme(500);
  await clicarTexto("Enviar pedido");
  await dorme(3000);
  checar((await texto()).includes("Pedido enviado"), "o pedido e enviado");
  const [sol] = await consultar(
    `select status from public.solicitacoes_cadastro where matricula = ${lit(MAT)}`,
  );
  checar(sol?.status === "pendente", `ficou pendente no banco (${sol?.status})`);

  console.log("\n--- aprovacao no painel ---");
  await ir("/painel/colaboradores?aba=pendentes");
  const pend = await texto();
  checar(pend.includes(NOME), "o pedido aparece na aba Pendentes");
  await clicarTexto("Aprovar");
  await dorme(3500);
  const dialogoPin = await js(`(document.querySelector('[role=dialog]')||{}).innerText || ''`);
  checar(
    dialogoPin.includes(`PIN de ${NOME}`),
    "ao aprovar, o PIN abre na hora para o gestor enviar",
    dialogoPin.slice(0, 80),
  );
  const pinNovo = await js(
    `(document.querySelector('[role=dialog] .font-mono.text-5xl')||{}).innerText || ''`,
  );
  checar(/^\d{6}$/.test(pinNovo), `PIN do aprovado: ${pinNovo}`);
  const [colab] = await consultar(
    `select pin_fixo, ativo from public.colaboradores where matricula = ${lit(MAT)}`,
  );
  checar(
    colab?.pin_fixo === pinNovo && colab?.ativo === true,
    "colaborador criado, ativo e com esse PIN",
  );
  const msg = await js(
    `(async () => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Copiar mensagem pronta')); return !!b; })()`,
  );
  checar(msg === true, "ha o botao de copiar a mensagem pronta");

  // ---------------------------------------------------------- app: login real
  console.log("\n--- app do colaborador: entrar pela interface ---");
  await ir("/app/entrar?empresa=piloto", 4000);
  await preencher("#matricula", MAT);
  await preencher("#pin", "000000");
  await dorme(400);
  await clicarTexto("Entrar");
  await dorme(2500);
  checar((await texto()).includes("incorretos"), "PIN errado mostra a mensagem de erro generica");
  await preencher("#pin", pinNovo);
  await dorme(400);
  await clicarTexto("Entrar");
  await dorme(4500);
  checar(
    (await js("location.pathname")) === "/app/termo",
    `com o PIN certo entra e cai no termo (${await js("location.pathname")})`,
  );
  await js(`document.querySelector('[role=checkbox]').click()`);
  await dorme(400);
  await clicarTexto("Li e aceito");
  await dorme(4000);
  checar(
    (await js("location.pathname")) === "/app/inicio",
    `depois do termo vai ao inicio (${await js("location.pathname")})`,
  );
  const tokenSalvo = await js("localStorage.getItem('time_token')");
  checar(!!tokenSalvo, "o token da sessao fica guardado (continua logado)");

  console.log("\n--- fica logado e a raiz /app leva ao inicio ---");
  await ir("/app", 4500);
  checar(
    (await js("location.pathname")) === "/app/inicio",
    `abrir /app logado vai direto ao inicio (${await js("location.pathname")})`,
  );

  console.log("\n--- PWA no dev: manifest e ligacao ---");
  const man = await js(
    `fetch('/manifest.webmanifest').then(r => r.json()).then(j => JSON.stringify(j))`,
  );
  const j = JSON.parse(man);
  checar(
    j.name === "T.I.M.E. Seguro" && j.start_url === "/app" && j.scope === "/app",
    `manifest do T.I.M.E. (${j.name}, ${j.start_url}, ${j.scope})`,
  );
  checar(!/V\.O\.Z\.E\.S|aluno/i.test(man), "manifest sem resto do V.O.Z.E.S.");
  const link = await js(`document.querySelector('link[rel=manifest]')?.getAttribute('href')`);
  checar(link === "/manifest.webmanifest", "a pagina referencia o manifest");
} finally {
  // ---------------------------------------------------------- limpeza
  await consultar(`delete from public.solicitacoes_cadastro where matricula = ${lit(MAT)}`);
  const apagados = await consultar(
    `delete from public.colaboradores where matricula = ${lit(MAT)} returning id`,
  );
  console.log(`\n(limpeza: ${apagados.length} colaborador de teste removido)`);
}

console.log(`\nERROS DE CONSOLE (${erros.length}):`);
for (const e of [...new Set(erros)].slice(0, 8)) console.log("  " + e.slice(0, 300));
console.log(
  falhas === 0
    ? `\nE2E: ${total} verificacoes passaram.`
    : `\nE2E: ${falhas} de ${total} FALHARAM.`,
);
chrome.kill();
process.exit(falhas === 0 ? 0 : 1);
