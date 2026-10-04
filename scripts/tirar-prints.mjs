// Tira print de TODAS as telas e subtelas (painel, janelas, Modo TV, app do
// colaborador e paginas publicas) e grava em docs/telas/ com nomes numerados
// (1-Tela_Login.png, 2-Tela_Inicio.png, ...), na ordem em que sao fotografadas.
//
//   npm run dev                 (em outro terminal)
//   npm run prints
//
// Quase tudo e so leitura: navega, clica em abas e ABRE janelas sem salvar. As
// unicas gravacoes, todas pequenas e de proposito:
//   - "Imprimir cartoes" registra a consulta do PIN (acessos_pin);
//   - o check-in na TV gira o codigo do evento (tecnico_rotacionar_codigo);
//   - entrar no app do colaborador cria uma sessao (como qualquer login).
// Nunca responde quiz, envia relato, salva pontuacao nem confirma formulario.
//
// Pre-requisitos: servidor em http://localhost:8080 (ou BASE=...), Google Chrome
// (CHROME_PATH se nao estiver no caminho padrao) e .env com BOOTSTRAP_EMAIL/SENHA.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { consultar } from "./_db.mjs";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(raiz, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE = process.env.BASE ?? "http://localhost:8080";
const EMPRESA = process.env.EMPRESA ?? "enerpeixe";
const PASTA = resolve(raiz, "docs/telas");
mkdirSync(PASTA, { recursive: true });
// Recomeca do zero: so apaga os PNG numerados que este script cria.
for (const f of readdirSync(PASTA)) if (/^\d+-Tela_.*\.png$/.test(f)) rmSync(resolve(PASTA, f));

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
  if (d.id && pend.has(d.id)) {
    pend.get(d.id)(d.result ?? d.error);
    pend.delete(d.id);
  }
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
const tamanho = (largura, altura, celular) =>
  cdp("Emulation.setDeviceMetricsOverride", {
    width: largura,
    height: altura,
    deviceScaleFactor: celular ? 2 : 1,
    mobile: celular,
  });

const problemas = [];
let numero = 0;
const feitos = [];

// ---------------------------------------------------------------- ajudantes
async function abrir(rota, esperado) {
  await cdp("Page.navigate", { url: BASE + rota });
  for (let i = 0; i < 40; i++) {
    await dorme(500);
    const t = (await js("document.body.innerText")) ?? "";
    if ((!esperado || t.includes(esperado)) && !t.includes("Carregando")) {
      await dorme(1200);
      return true;
    }
  }
  return false;
}

/**
 * Clica (com mouse de verdade, no centro) no 1o elemento visivel cujo texto,
 * title ou aria-label contem `texto`. `.click()` nao basta: os menus do Radix so
 * abrem com pointerdown.
 */
async function clicar(texto, seletor = "button, [role=tab], [role=menuitem], a") {
  const ponto = await js(`(() => {
    const t = ${JSON.stringify(texto)};
    const el = [...document.querySelectorAll(${JSON.stringify(seletor)})].find((x) =>
      !x.disabled && x.offsetParent !== null &&
      ((x.innerText || '').trim().includes(t) || (x.getAttribute('title') || '').includes(t) || (x.getAttribute('aria-label') || '').includes(t)));
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!ponto) return false;
  await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: ponto.x, y: ponto.y });
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: ponto.x,
    y: ponto.y,
    button: "left",
    clickCount: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: ponto.x,
    y: ponto.y,
    button: "left",
    clickCount: 1,
  });
  await dorme(1800);
  return true;
}

async function escape() {
  for (const type of ["keyDown", "keyUp"])
    await cdp("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
  await dorme(700);
}

/** `soVisivel`: janelas e menus (o fundo escuro cobre so a area visivel). */
async function print(nome, soVisivel = false) {
  numero += 1;
  const arquivo = `${numero}-Tela_${nome}.png`;
  const { data } = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: !soVisivel,
    fromSurface: true,
  });
  const caminho = resolve(PASTA, arquivo);
  writeFileSync(caminho, Buffer.from(data, "base64"));
  const kb = Math.round(statSync(caminho).size / 1024);
  feitos.push(arquivo);
  console.log(`  ${kb < 15 ? "SUSPEITO" : "ok      "} ${arquivo} (${kb} KB)`);
  if (kb < 15) problemas.push(`${arquivo}: arquivo muito pequeno`);
}

/** Abre a rota e fotografa. `antes` (opcional) mexe na tela antes do print. */
async function tela(nome, rota, esperado, antes) {
  if (!(await abrir(rota, esperado))) {
    problemas.push(`${nome}: "${esperado}" nao apareceu em ${rota}`);
    return false;
  }
  if (antes && (await antes()) === false) {
    problemas.push(`${nome}: acao da tela nao encontrou o elemento`);
    return false;
  }
  await print(nome);
  return true;
}

/** Na pagina atual: faz `acao` (abre janela/aba), fotografa e fecha. */
async function janela(nome, acao, fechar = true) {
  const ok = await acao();
  if (ok === false) {
    problemas.push(`${nome}: elemento nao encontrado`);
    return;
  }
  await print(nome, true);
  if (fechar) await escape();
}

const aba = (texto) => () => clicar(texto, "[role=tab], button, a");

async function entrarNoPainel() {
  await js(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); };
    set(document.querySelector('input[type=email]'), ${JSON.stringify(env.BOOTSTRAP_EMAIL)});
    set(document.querySelector('input[type=password]'), ${JSON.stringify(env.BOOTSTRAP_SENHA)});
    document.querySelector('button[type=submit]').click(); })()`);
  await dorme(10000);
  return (await js("location.pathname")) === "/painel";
}

// Dados so para montar enderecos (leitura).
const [empresa] = await consultar(`select id from public.empresas where codigo = '${EMPRESA}'`);
const [dados] = await consultar(`select
  (select id from public.licoes where empresa_id = '${empresa.id}' order by ordem limit 1) as licao,
  (select id from public.locais where empresa_id = '${empresa.id}' order by nome limit 1) as local,
  (select id from public.eventos where empresa_id = '${empresa.id}' order by inicio limit 1) as evento,
  (select codigo from public.certificados where empresa_id = '${empresa.id}' limit 1) as certificado`);
const [colab] = await consultar(`select matricula, nome, pin_fixo from public.colaboradores
  where empresa_id = '${empresa.id}' and ativo and lgpd_aceite_em is not null order by matricula limit 1`);

try {
  console.log("Prints em", PASTA);

  // ================================================================ PAINEL
  await tamanho(1440, 900, false);
  await tela("Login", "/painel/login", "Entrar");
  if (!(await entrarNoPainel())) throw new Error("login do painel nao entrou");

  await tela("Inicio", "/painel", "Início");

  // --- Colaboradores
  await tela("Colaboradores", "/painel/colaboradores", "Colaboradores");
  await janela("Colaboradores_Novo_Colaborador", () => clicar("Novo", "button"));
  await janela("Colaboradores_Ver_PIN", () => clicar("Ver PIN", "tbody tr button"));
  await janela(
    "Colaboradores_Menu_da_Linha",
    () => clicar("Mais opções", "tbody tr button"),
    false,
  );
  await janela("Colaboradores_Editar", () => clicar("Editar", "[role=menuitem]"));
  await abrir("/painel/colaboradores", "Colaboradores");
  await janela("Colaboradores_Mais_Opcoes", () => clicar("Mais opções", "header button"), false);
  await janela("Colaboradores_Importar_CSV", () => clicar("Importar lista", "[role=menuitem]"));
  await tela("Colaboradores_Pendentes", "/painel/colaboradores", "Pendentes", aba("Pendentes"));
  await tela(
    "Setores_e_Locais",
    "/painel/colaboradores",
    "Setores e locais",
    aba("Setores e locais"),
  );
  await janela("Setores_Novo_Setor", () => clicar("Novo setor", "button"));
  await janela("Setores_Novo_Local", () => clicar("Novo local", "button"));
  await janela("Setores_Etiqueta_do_Local", () => clicar("tiqueta", "button, a"));

  // --- Cartoes (marca 3 pessoas e pede os cartoes, como o usuario faria)
  await abrir("/painel/colaboradores", "Colaboradores");
  await js(
    `[...document.querySelectorAll('tbody tr [role=checkbox]')].slice(0, 3).forEach(c => c.click())`,
  );
  await dorme(600);
  if (await clicar("Imprimir cartões", "button")) {
    await dorme(4000);
    await print("Cartoes_de_Acesso");
  } else problemas.push("Cartoes_de_Acesso: botao Imprimir cartoes nao encontrado");

  // --- Campanhas
  await tela("Campanhas", "/painel/campanhas", "Outubro Rosa");
  await janela("Campanhas_Nova_Campanha", () => clicar("Nova campanha", "button"));
  await janela("Campanhas_Editar_Campanha", () => clicar("Editar", "main li button"));
  if (await abrir("/painel/campanhas", "Foco Total na NR-1")) {
    const href = await js(
      `[...document.querySelectorAll('main ul > li')].find(x => x.innerText.includes('Foco Total na NR-1'))?.querySelector('a')?.getAttribute('href') ?? ''`,
    );
    if (href) {
      await tela("Campanha_Detalhe", href, "Foco Total na NR-1");
    } else problemas.push("Campanha_Detalhe: link Abrir nao encontrado");
  }

  // --- Perguntas
  await tela("Perguntas", "/painel/perguntas", "pergunta(s)");
  await janela("Perguntas_Nova_Pergunta", () => clicar("Nova pergunta", "button"));
  await janela("Perguntas_Mais_Opcoes", () => clicar("Mais opções", "header button"), false);
  await escape();
  await tela("Importar_Perguntas", "/painel/perguntas/importar", "mport");

  // --- Eventos
  await tela("Eventos", "/painel/eventos", "Eventos");
  await janela("Eventos_Novo_Evento", () => clicar("Novo evento", "button"));
  await janela("Eventos_Presenca", () => clicar("Presença", "button"));
  await janela("Eventos_Menu_do_Evento", () => clicar("Mais opções", "main li button"));

  // --- Ranking e Certificados
  await tela("Ranking_Individual", "/painel/ranking", "Ranking");
  await tela("Ranking_por_Setor", "/painel/ranking", "Ranking", aba("Setor"));
  await tela("Certificados", "/painel/certificados", "emitido");

  // --- Relatos e Canal de Respeito
  await tela("Relatos", "/painel/relatos", "relato(s)");
  await janela("Relatos_Detalhe_do_Relato", () =>
    js(
      `(() => { const b = [...document.querySelectorAll('main button')].find(x => x.innerText.trim().length > 30 && !x.closest('header')); if (!b) return false; b.click(); return true; })()`,
    ),
  );
  await tela("Canal_de_Respeito", "/painel/respeito", "denúncia(s)");
  await janela("Canal_de_Respeito_Detalhe", () => clicar("", "ul.grid li button"));

  // --- Resultados
  await tela("Resultados_Visao_Geral", "/painel/analytics", "Visão geral");
  await tela(
    "Resultados_Mapa_de_Lacunas",
    "/painel/analytics",
    "Mapa de lacunas",
    aba("Mapa de lacunas"),
  );
  await janela("Resultados_Detalhe_da_Celula", () => clicar("resp.", "main button"));
  await tela("Resultados_Perguntas", "/painel/analytics", "Perguntas", aba("Perguntas"));
  await tela("Resultados_Relatos", "/painel/analytics", "Relatos", async () => {
    await clicar("Relatos", "[role=tab], button");
  });
  await tela("Resultados_Engajamento", "/painel/analytics", "Engajamento", aba("Engajamento"));
  await tela("Relatorios", "/painel/relatorios", "Colaboradores");
  await tela("Materiais", "/painel/materiais", "cartaz");

  // --- Modo TV (painel)
  await tela("Modo_TV", "/tv", "TV");
  if (await clicar("Iniciar", "button")) {
    await dorme(3500);
    await print("Modo_TV_Jogo");
  } else problemas.push("Modo_TV_Jogo: botao Iniciar nao encontrado");
  if (dados.evento) await tela("Modo_TV_Check-in", `/tv/checkin/${dados.evento}`, "");

  await tela("Configuracoes", "/painel/configuracoes", "Configurações");

  // ============================================== PAGINAS PUBLICAS (sem login)
  await tela("Publica_Canal_de_Respeito", `/respeito/${EMPRESA}`, "");
  await tela("Publica_Material_NR1", `/m/${EMPRESA}/nr1`, "");
  if (dados.certificado)
    await tela("Publica_Verificar_Certificado", `/verificar/${dados.certificado}`, "");
  else console.log("  (sem certificado emitido: tela /verificar nao fotografada)");

  // ============================================== APP DO COLABORADOR (celular)
  await tamanho(420, 900, true);
  await tela("App_Entrar", `/app/entrar?empresa=${EMPRESA}`, "Entrar");
  await tela("App_Cadastro", `/app/cadastro?empresa=${EMPRESA}`, "");
  // entra com matricula + PIN reais do banco (so leitura do PIN)
  await abrir(`/app/entrar?empresa=${EMPRESA}`, "Entrar");
  await js(`(() => { const set = (id, v) => { const el = document.querySelector(id); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); };
    if (document.querySelector('#codigo')) set('#codigo', ${JSON.stringify(EMPRESA)});
    set('#matricula', ${JSON.stringify(colab.matricula)}); set('#pin', ${JSON.stringify(colab.pin_fixo)}); })()`);
  await clicar("Entrar", "button[type=submit], button");
  await dorme(8000);
  const rotaApp = await js("location.pathname");
  if (!rotaApp.startsWith("/app/") || rotaApp === "/app/entrar") {
    problemas.push(`App: login do colaborador nao entrou (${rotaApp})`);
  } else {
    await tela("App_Inicio", "/app/inicio", "");
    await tela("App_Quiz", "/app/quiz", "");
    await tela("App_Trilha", "/app/trilha", "");
    if (dados.licao) await tela("App_Licao_da_Trilha", `/app/trilha/${dados.licao}`, "");
    await tela("App_Relatar", "/app/relatar", "");
    await tela("App_Meus_Relatos", "/app/relatos", "");
    await tela("App_Check-in", "/app/checkin", "");
    if (dados.local) await tela("App_Local_QR", `/app/local/${dados.local}`, "");
    await tela("App_Perfil", "/app/perfil", "");
    await tela("App_Termo_LGPD", "/app/termo", "");
  }
} catch (e) {
  console.error(e);
  problemas.push("interrompido: " + (e?.message ?? e));
} finally {
  chrome.kill();
}

console.log(`\n${feitos.length} print(s) em docs/telas.`);
if (problemas.length) {
  console.log(`${problemas.length} PROBLEMA(S):`);
  for (const p of problemas) console.log("  -", p);
}
process.exit(problemas.length === 0 ? 0 : 1);
