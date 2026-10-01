/**
 * Exportação de evidências da campanha: CSV para os dados brutos e PDF para o
 * relatório visual do painel de Analytics.
 */

export type LinhaCSV = Record<string, string | number | boolean | null | undefined>;

function celula(valor: LinhaCSV[string]): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Aspas, vírgulas e quebras de linha exigem o campo entre aspas, com as aspas duplicadas.
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Serializa linhas em CSV. A primeira linha vira o cabeçalho. */
export function montarCSV(linhas: LinhaCSV[]): string {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]!);
  const cabecalho = colunas.map(celula).join(",");
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c])).join(","));
  return [cabecalho, ...corpo].join("\r\n");
}

/** BOM que faz o Excel reconhecer o CSV como UTF-8. */
const BOM_UTF8 = "\uFEFF";

function baixarTexto(nome: string, conteudo: string) {
  // BOM UTF-8 para o Excel abrir os acentos corretamente.
  const blob = new Blob([BOM_UTF8, conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome.endsWith(".csv") ? nome : `${nome}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Baixa uma tabela única como CSV. */
export function baixarCSV(nome: string, linhas: LinhaCSV[]) {
  baixarTexto(nome, montarCSV(linhas));
}

/** Baixa várias tabelas num só CSV, separadas por um título de seção. */
export function baixarCSVCompleto(nome: string, secoes: { titulo: string; linhas: LinhaCSV[] }[]) {
  const partes = secoes.map(({ titulo, linhas }) => {
    const tabela = linhas.length > 0 ? montarCSV(linhas) : "(sem registros)";
    return `# ${titulo}\r\n${tabela}`;
  });
  baixarTexto(nome, partes.join("\r\n\r\n"));
}

/**
 * Captura um elemento da tela e gera um PDF A4 retrato, quebrando em várias
 * páginas quando o conteúdo é mais alto que uma página.
 */
export async function exportarPDF(elemento: HTMLElement, nome: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(elemento, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();

  // A imagem ocupa toda a largura; a altura cresce proporcionalmente.
  const alturaTotal = (canvas.height * larguraPagina) / canvas.width;
  const imagem = canvas.toDataURL("image/jpeg", 0.92);

  let restante = alturaTotal;
  let deslocamento = 0;
  while (restante > 0) {
    // Deslocar a imagem para cima a cada página revela a faixa seguinte.
    pdf.addImage(imagem, "JPEG", 0, -deslocamento, larguraPagina, alturaTotal);
    restante -= alturaPagina;
    deslocamento += alturaPagina;
    if (restante > 0) pdf.addPage();
  }

  pdf.save(nome.endsWith(".pdf") ? nome : `${nome}.pdf`);
}
