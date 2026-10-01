import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Analytics } from "@/hooks/useAnalytics";
import { baixarCSVCompleto, exportarPDF } from "@/lib/exportar";
import { hojeISO, pontuacaoTotal } from "@/lib/vozes";

export function ExportarRelatorio({
  dados,
  alvoPDF,
}: {
  dados: Analytics;
  alvoPDF: React.RefObject<HTMLDivElement | null>;
}) {
  const [gerando, setGerando] = useState(false);

  function exportarCSV() {
    const { turmas, perguntas, respostas, quizzes, quizRespostas, compartilhamentos, acessos } =
      dados;

    baixarCSVCompleto(`vozes-dados-completos-${hojeISO()}`, [
      {
        titulo: "Turmas",
        linhas: turmas.map((t) => ({
          id: t.id,
          nome: t.nome,
          serie: t.serie,
          quantidade_alunos: t.quantidade_alunos ?? 0,
          pontuacao_qrcode: t.pontuacao_qrcode ?? 0,
          pontuacao_quiz_tv: t.pontuacao_quiz_tv ?? 0,
          pontuacao_compartilhamento: t.pontuacao_compartilhamento ?? 0,
          pontuacao_total: pontuacaoTotal(t),
          status: t.status,
        })),
      },
      {
        titulo: "Perguntas",
        linhas: perguntas.map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          alternativa_a: p.alternativa_a,
          alternativa_b: p.alternativa_b,
          alternativa_c: p.alternativa_c,
          alternativa_d: p.alternativa_d,
          resposta_correta: p.resposta_correta,
          status: p.status,
        })),
      },
      {
        titulo: "Respostas dos alunos (QR Code)",
        linhas: respostas.map((r) => ({
          turma: dados.nomeDaTurma(r.turma_id),
          pergunta_id: r.pergunta_id,
          alternativa_escolhida: r.alternativa_escolhida,
          acertou: r.acertou,
          tempo_resposta_ms: r.tempo_resposta_ms ?? 0,
          dispositivo: r.dispositivo,
          data: r.data,
          hora: r.hora,
        })),
      },
      {
        titulo: "Sessões de Quiz TV",
        linhas: quizzes.map((q) => ({
          id: q.id,
          turma: dados.nomeDaTurma(q.turma_id),
          total_perguntas: q.total_perguntas,
          acertos: q.acertos,
          erros: q.erros,
          pontuacao: q.pontuacao,
          tempo_total_ms: q.tempo_total_ms ?? 0,
          data: q.data,
        })),
      },
      {
        titulo: "Respostas do Quiz TV",
        linhas: quizRespostas.map((r) => ({
          quiz_tv_id: r.quiz_tv_id,
          turma: dados.nomeDaTurma(r.turma_id),
          pergunta_id: r.pergunta_id,
          ordem: r.ordem,
          alternativa_escolhida: r.alternativa_escolhida,
          acertou: r.acertou,
          tempo_resposta_ms: r.tempo_resposta_ms ?? 0,
        })),
      },
      {
        titulo: "Compartilhamentos",
        linhas: compartilhamentos.map((c) => ({
          turma: dados.nomeDaTurma(c.turma_id),
          plataforma: c.plataforma,
          data: c.data,
          hora: c.hora,
        })),
      },
      {
        titulo: "Acessos via QR Code",
        linhas: acessos.map((a) => ({
          turma: dados.nomeDaTurma(a.turma_id),
          acao: a.acao,
          pontuou: a.pontuou,
          dispositivo: a.dispositivo,
          data: a.data,
          hora: a.hora,
        })),
      },
    ]);
    toast.success("CSV completo baixado!");
  }

  async function gerarPDF() {
    const elemento = alvoPDF.current;
    if (!elemento || gerando) return;
    setGerando(true);
    toast.info("Gerando o relatório… isso leva alguns segundos.");
    try {
      await exportarPDF(elemento, `vozes-relatorio-${hojeISO()}`);
      toast.success("Relatório PDF gerado!");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => void gerarPDF()} disabled={gerando}>
        <FileDown className="size-4" /> {gerando ? "Gerando…" : "Exportar relatório PDF"}
      </Button>
      <Button variant="outline" onClick={exportarCSV}>
        <FileSpreadsheet className="size-4" /> Exportar CSV completo
      </Button>
    </div>
  );
}
