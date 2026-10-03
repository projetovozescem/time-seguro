import { podeAcessar, type Papel } from "@/hooks/usePerfil";

/**
 * Menu do painel em 7 seções (pedido de simplificação, 02/10/2026; antes eram
 * 14 itens soltos). Cada seção agrupa telas que já existiam, mostradas como
 * abas no topo: as URLs não mudaram, então link salvo continua valendo.
 *
 * `minimo` e `soComite` repetem as regras do menu antigo. São só experiência de
 * uso: quem protege os dados é o RLS.
 */
export type Aba = {
  rotulo: string;
  rota: RotaDoPainel;
  minimo: Papel;
  soComite?: boolean;
};

export type Secao = {
  emoji: string;
  rotulo: string;
  abas: readonly Aba[];
};

export type RotaDoPainel =
  | "/painel"
  | "/painel/colaboradores"
  | "/painel/campanhas"
  | "/painel/perguntas"
  | "/painel/eventos"
  | "/painel/ranking"
  | "/painel/certificados"
  | "/painel/relatos"
  | "/painel/respeito"
  | "/painel/analytics"
  | "/painel/relatorios"
  | "/painel/materiais"
  | "/tv"
  | "/painel/configuracoes";

export const SECOES: readonly Secao[] = [
  { emoji: "🏠", rotulo: "Início", abas: [{ rotulo: "Início", rota: "/painel", minimo: "cipa" }] },
  {
    emoji: "👷",
    rotulo: "Colaboradores",
    abas: [{ rotulo: "Colaboradores", rota: "/painel/colaboradores", minimo: "cipa" }],
  },
  {
    emoji: "🏆",
    rotulo: "Campanhas",
    abas: [
      { rotulo: "Campanhas", rota: "/painel/campanhas", minimo: "cipa" },
      { rotulo: "Perguntas", rota: "/painel/perguntas", minimo: "tecnico" },
      { rotulo: "Eventos", rota: "/painel/eventos", minimo: "cipa" },
      { rotulo: "Ranking", rota: "/painel/ranking", minimo: "cipa" },
      { rotulo: "Certificados", rota: "/painel/certificados", minimo: "cipa" },
    ],
  },
  {
    emoji: "📢",
    rotulo: "Relatos",
    abas: [
      { rotulo: "Relatos", rota: "/painel/relatos", minimo: "cipa" },
      { rotulo: "Canal de Respeito", rota: "/painel/respeito", minimo: "cipa", soComite: true },
    ],
  },
  {
    emoji: "📈",
    rotulo: "Resultados",
    abas: [
      { rotulo: "Painel", rota: "/painel/analytics", minimo: "cipa" },
      { rotulo: "Relatórios", rota: "/painel/relatorios", minimo: "cipa" },
      { rotulo: "Materiais", rota: "/painel/materiais", minimo: "tecnico" },
    ],
  },
  { emoji: "📺", rotulo: "Modo TV", abas: [{ rotulo: "Modo TV", rota: "/tv", minimo: "tecnico" }] },
  {
    emoji: "⚙️",
    rotulo: "Configurações",
    abas: [{ rotulo: "Configurações", rota: "/painel/configuracoes", minimo: "admin" }],
  },
];

export type QuemVe = { papel: Papel | undefined; comite: boolean };

export function abaVisivel(aba: Aba, quem: QuemVe): boolean {
  return podeAcessar(quem.papel, aba.minimo) && (!aba.soComite || quem.comite);
}

/** Seções com ao menos uma aba visível; cada uma só com as abas visíveis. */
export function secoesVisiveis(quem: QuemVe): Secao[] {
  return SECOES.map((s) => ({ ...s, abas: s.abas.filter((a) => abaVisivel(a, quem)) })).filter(
    (s) => s.abas.length > 0,
  );
}

/** A aba da rota atual: a de prefixo mais longo (`/painel/campanhas/123` → Campanhas). */
export function abaDaRota(pathname: string): Aba | undefined {
  const caminho = pathname.replace(/\/+$/, "") || "/";
  let melhor: Aba | undefined;
  for (const s of SECOES)
    for (const a of s.abas)
      if (
        (caminho === a.rota || caminho.startsWith(a.rota + "/")) &&
        (!melhor || a.rota.length > melhor.rota.length)
      )
        melhor = a;
  return melhor;
}

export function secaoDaRota(pathname: string): Secao | undefined {
  const aba = abaDaRota(pathname);
  return aba && SECOES.find((s) => s.abas.includes(aba));
}
