import { detectarSeparador, quebrarLinha } from "./importacao/csv";

/** BOM do Excel, por codigo: caractere invisivel nunca entra no fonte. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Importação de colaboradores por CSV (docs/TIME_04 §6).
 *
 * Formato: `matricula;nome;setor;turno`, aceitando `;` ou `,`. Reaproveita o
 * leitor de CSV do importador de perguntas — mesmo tratamento de aspas, BOM e
 * separador.
 */

export const TURNOS = ["manha", "tarde", "noite", "adm"] as const;
export type Turno = (typeof TURNOS)[number];

export const ROTULO_DO_TURNO: Record<Turno, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  adm: "Administrativo",
};

export function rotuloDoTurno(turno: string | null): string {
  if (!turno) return "—";
  return ROTULO_DO_TURNO[turno as Turno] ?? turno;
}

export type LinhaColaborador = {
  /** Número da linha no arquivo, contando o cabeçalho — é o que o técnico vê. */
  linha: number;
  matricula: string;
  nome: string;
  setor: string;
  turno: string;
  erros: string[];
};

/** Normaliza o nome da coluna: sem acento, minúsculo, sem espaço. */
function chave(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Lê o CSV e devolve uma linha por registro, com os erros de cada uma.
 *
 * Não rejeita o arquivo inteiro por causa de uma linha ruim: a tela mostra o que
 * está errado e o técnico decide. `tecnico_importar_colaboradores` também valida
 * no servidor e devolve `matricula_ou_nome_vazio` por linha.
 */
export function lerCsvColaboradores(conteudo: string): LinhaColaborador[] {
  const texto = conteudo.startsWith(BOM) ? conteudo.slice(1) : conteudo;
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length < 2) return [];

  const sep = detectarSeparador(linhas[0]!);
  const colunas = quebrarLinha(linhas[0]!, sep).map(chave);
  const indice = (nome: string) => colunas.indexOf(nome);

  const iMatricula = indice("matricula");
  const iNome = indice("nome");
  const iSetor = indice("setor");
  const iTurno = indice("turno");

  const vistas = new Set<string>();

  return linhas.slice(1).map((bruta, i) => {
    const campos = quebrarLinha(bruta, sep);
    const pegar = (idx: number) => (idx >= 0 ? (campos[idx] ?? "").trim() : "");

    const matricula = pegar(iMatricula);
    const nome = pegar(iNome);
    const turno = pegar(iTurno).toLowerCase();
    const erros: string[] = [];

    if (!matricula) erros.push("Matrícula vazia.");
    if (!nome) erros.push("Nome vazio.");
    if (turno && !TURNOS.includes(turno as Turno)) {
      erros.push(`Turno "${turno}" não existe. Use: ${TURNOS.join(", ")}.`);
    }
    if (matricula && vistas.has(matricula)) {
      erros.push("Matrícula repetida no arquivo.");
    }
    if (matricula) vistas.add(matricula);

    return { linha: i + 2, matricula, nome, setor: pegar(iSetor), turno, erros };
  });
}

/** Linhas sem erro, no formato que `tecnico_importar_colaboradores` espera. */
export function paraImportar(
  linhas: readonly LinhaColaborador[],
): { matricula: string; nome: string; setor: string; turno: string }[] {
  return linhas
    .filter((l) => l.erros.length === 0)
    .map((l) => ({ matricula: l.matricula, nome: l.nome, setor: l.setor, turno: l.turno }));
}

/** Modelo para o botão "Baixar modelo" (docs/TIME_04 §6). */
export const MODELO_CSV_COLABORADORES = [
  "matricula;nome;setor;turno",
  "1001;Carlos Souza;Manutenção;manha",
  "1002;Ana Lima;Expedição;tarde",
].join("\r\n");

export type CartaoDeAcesso = {
  colaborador_id: string;
  matricula: string;
  nome: string;
  setor: string | null;
  pin: string;
};

/** 8 cartões por folha A4 (docs/TIME_04 §6). */
export const CARTOES_POR_FOLHA = 8;

export function emFolhas<T>(itens: readonly T[], porFolha = CARTOES_POR_FOLHA): T[][] {
  const folhas: T[][] = [];
  for (let i = 0; i < itens.length; i += porFolha) {
    folhas.push(itens.slice(i, i + porFolha));
  }
  return folhas;
}
