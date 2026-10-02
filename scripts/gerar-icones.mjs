// Gera os ícones do PWA do T.I.M.E. Seguro (docs/TIME_10 §1: escudo + sigla).
//
// Os que vieram do V.O.Z.E.S. eram o coração roxo da campanha. Desenhado por
// código (poligono + supersampling) para não depender de ferramenta de imagem:
// o `fast-png` já é dependência do projeto (vem do html2canvas/jspdf).
//
//   node scripts/gerar-icones.mjs
//
// Escreve em public/: icon-192.png, icon-512.png, icon-maskable-512.png,
// apple-touch-icon.png e favicon.ico.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
import { encode } from "fast-png";

const MARINHO = [0x0b, 0x3c, 0x5d];
const MARINHO_ESCURO = [0x07, 0x2a, 0x42];
const AMARELO = [0xff, 0xc4, 0x00];

// ---- forma do escudo, numa grade de 24x24 (a mesma do ShieldCheck do app) ----
function cubica(p0, p1, p2, p3, n = 16) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

const ESCUDO = [
  [12, 2.5],
  [20, 5.2],
  [20, 11],
  ...cubica([20, 11], [20, 16.5], [16.2, 19.8], [12, 21.7]),
  ...cubica([12, 21.7], [7.8, 19.8], [4, 16.5], [4, 11]),
  [4, 5.2],
];
const CHECK = [
  [8.2, 12.2],
  [11, 15],
  [16, 9.6],
];
const ALTURA_DO_ESCUDO = 21.7 - 2.5;

function dentro(poligono, x, y) {
  let d = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function distSegmento(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function noCheck(x, y, largura) {
  return (
    distSegmento(x, y, CHECK[0], CHECK[1]) <= largura / 2 ||
    distSegmento(x, y, CHECK[1], CHECK[2]) <= largura / 2
  );
}

/**
 * Desenha um ícone `tam` x `tam`.
 * `cantos` arredonda o quadrado (ícone "any"); o maskable é sangrado até a
 * borda e o escudo fica na zona segura (o sistema recorta num círculo).
 */
function desenhar(tam, { cantos, alturaDoEscudo }) {
  const dados = new Uint8Array(tam * tam * 4);
  const escala = (tam * alturaDoEscudo) / ALTURA_DO_ESCUDO; // pixels por unidade da grade
  const ox = tam / 2 - 12 * escala;
  const oy = tam / 2 - ((2.5 + 21.7) / 2) * escala;
  const raio = cantos * tam;
  const SS = 3; // 3x3 amostras por pixel: borda suave

  for (let py = 0; py < tam; py++) {
    for (let px = 0; px < tam; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;

          // quadrado arredondado
          let visivel = true;
          if (raio > 0) {
            const cx = x < raio ? raio : x > tam - raio ? tam - raio : x;
            const cy = y < raio ? raio : y > tam - raio ? tam - raio : y;
            visivel = Math.hypot(x - cx, y - cy) <= raio;
          }
          if (!visivel) continue;

          // fundo: degradê marinho na diagonal
          const k = (x + y) / (2 * tam);
          let cor = MARINHO.map((c, i) => c + (MARINHO_ESCURO[i] - c) * k);

          const gx = (x - ox) / escala;
          const gy = (y - oy) / escala;
          if (dentro(ESCUDO, gx, gy)) cor = noCheck(gx, gy, 2.4) ? MARINHO : AMARELO;

          r += cor[0];
          g += cor[1];
          b += cor[2];
          a += 255;
        }
      }
      const n = SS * SS;
      const i = (py * tam + px) * 4;
      // média só dos pixels visíveis (cor sem pré-multiplicar), alpha pela cobertura
      const cobertos = a / 255 || 1;
      dados[i] = Math.round(r / cobertos);
      dados[i + 1] = Math.round(g / cobertos);
      dados[i + 2] = Math.round(b / cobertos);
      dados[i + 3] = Math.round(a / n);
    }
  }
  return encode({ width: tam, height: tam, data: dados, channels: 4, depth: 8 });
}

/** ICO com um PNG dentro (aceito desde o Windows Vista e por todo navegador). */
function ico(png, lado) {
  const cab = Buffer.alloc(22);
  cab.writeUInt16LE(0, 0);
  cab.writeUInt16LE(1, 2); // tipo: ícone
  cab.writeUInt16LE(1, 4); // quantidade
  cab[6] = lado;
  cab[7] = lado;
  cab.writeUInt16LE(1, 10); // planos
  cab.writeUInt16LE(32, 12); // bits por pixel
  cab.writeUInt32LE(png.length, 14);
  cab.writeUInt32LE(22, 18);
  return Buffer.concat([cab, Buffer.from(png)]);
}

const publico = (nome) => resolve(raiz, "public", nome);

writeFileSync(publico("icon-512.png"), desenhar(512, { cantos: 0.22, alturaDoEscudo: 0.6 }));
writeFileSync(publico("icon-192.png"), desenhar(192, { cantos: 0.22, alturaDoEscudo: 0.6 }));
// Maskable: o sistema recorta num círculo de 80% — o escudo precisa caber nele.
writeFileSync(publico("icon-maskable-512.png"), desenhar(512, { cantos: 0, alturaDoEscudo: 0.46 }));
// iOS arredonda sozinho: entregar quadrado, sem cantos.
writeFileSync(publico("apple-touch-icon.png"), desenhar(180, { cantos: 0, alturaDoEscudo: 0.56 }));
writeFileSync(publico("favicon.ico"), ico(desenhar(48, { cantos: 0.2, alturaDoEscudo: 0.64 }), 48));

console.log("ícones do T.I.M.E. gravados em public/");
