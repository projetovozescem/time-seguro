import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePerfil } from "@/hooks/usePerfil";
import { useTemas } from "@/hooks/usePerguntas";
import { Comparativo } from "@/components/painel/Comparativo";
import { MaisOpcoes } from "@/components/painel/MaisOpcoes";
import { useCampanhas, useLicoes } from "@/hooks/useCampanhas";
import { useSetores } from "@/hooks/useEventos";
import {
  ASSINATURAS,
  AVISO_OBRIGATORIO,
  ROTULO_DA_SITUACAO,
  agregarCanal,
  cargaEmHoras,
  resumir,
  situacaoDe,
  type LinhaEvidencia,
} from "@/lib/relatorio";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { ROTULO_DO_STATUS } from "@/lib/campanha";
import { rotuloDoStatusDenuncia } from "@/lib/respeito";

/** Evidência de treinamento de uma campanha, opcionalmente filtrada por setor. */
function useEvidencia(campanhaId: string | null, setorId: string) {
  return useQuery({
    queryKey: ["evidencia", campanhaId, setorId],
    enabled: campanhaId !== null,
    queryFn: async (): Promise<LinhaEvidencia[]> => {
      if (!campanhaId) return [];

      const { data: licoes, error: erroLicoes } = await supabase
        .from("licoes")
        .select("id, titulo, carga_minutos")
        .eq("campanha_id", campanhaId);
      if (erroLicoes) throw erroLicoes;

      const ids = (licoes ?? []).map((l) => l.id as string);
      if (ids.length === 0) return [];
      const tituloDaLicao = new Map(
        (licoes ?? []).map((l) => [l.id as string, l.titulo as string]),
      );

      const { data, error } = await supabase
        .from("progresso_licoes")
        .select(
          `licao_id, melhor_nota, tentativas, aprovado_em, conteudo_concluido_em,
           colaboradores ( matricula, nome, setor_id, setores ( nome ) )`,
        )
        .in("licao_id", ids);
      if (error) throw error;

      return (data ?? [])
        .map((p) => {
          const c = p.colaboradores as unknown as {
            matricula: string;
            nome: string;
            setor_id: string | null;
            setores: { nome: string } | null;
          } | null;
          return {
            matricula: c?.matricula ?? "—",
            nome: c?.nome ?? "—",
            setor: c?.setores?.nome ?? "—",
            setor_id: c?.setor_id ?? null,
            licao: tituloDaLicao.get(p.licao_id as string) ?? "—",
            concluido_em: (p.aprovado_em as string | null) ?? null,
            nota: (p.melhor_nota as number | null) ?? null,
            tentativas: (p.tentativas as number) ?? 0,
            situacao: situacaoDe(p.aprovado_em as string | null),
          };
        })
        .filter((l) => !setorId || l.setor_id === setorId)
        .map(({ setor_id: _ignorado, ...linha }) => linha);
    },
  });
}

/** Presença nos eventos do período (docs/TIME_09 §2.4). */
function usePresencaDoPeriodo(campanhaId: string | null) {
  return useQuery({
    queryKey: ["presenca-relatorio", campanhaId],
    enabled: campanhaId !== null,
    queryFn: async () => {
      if (!campanhaId) return [];
      const { data: eventos, error } = await supabase
        .from("eventos")
        .select("id, titulo, tipo, inicio")
        .eq("campanha_id", campanhaId)
        .order("inicio");
      if (error) throw error;

      const comPresentes = [];
      for (const e of eventos ?? []) {
        const { count } = await supabase
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .eq("evento_id", e.id);
        comPresentes.push({ ...e, presentes: count ?? 0 });
      }
      return comPresentes;
    },
  });
}

/**
 * Agregado do Canal de Respeito para o relatório CIPA+A.
 *
 * Seleciona SÓ `recebida_em` e `status`. Nem a descrição nem o protocolo entram
 * na consulta — o dado sensível não sai do banco (docs/TIME_09 §2).
 */
function useAgregadoDoCanal(habilitado: boolean) {
  return useQuery({
    queryKey: ["canal-agregado"],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("denuncias_assedio")
        .select("recebida_em, status");
      if (error) throw error;
      return agregarCanal((data ?? []) as { recebida_em: string; status: string }[]);
    },
  });
}

function Relatorios() {
  const { data: perfil } = usePerfil();
  const { data: temas = [] } = useTemas();
  const { data: campanhas = [] } = useCampanhas();
  const { data: setores = [] } = useSetores();

  const [campanhaId, setCampanhaId] = useState<string | null>(null);
  const [setorId, setSetorId] = useState("");
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (campanhaId || campanhas.length === 0) return;
    setCampanhaId((campanhas.find((c) => c.status === "ativa") ?? campanhas[0]!).id);
  }, [campanhas, campanhaId]);

  const campanha = campanhas.find((c) => c.id === campanhaId) ?? null;
  const { data: linhas = [], isLoading } = useEvidencia(campanhaId, setorId);
  const { data: licoes = [] } = useLicoes(campanhaId ?? "");
  const { data: presenca = [] } = usePresencaDoPeriodo(campanhaId);
  const { data: canal = [] } = useAgregadoDoCanal(Boolean(perfil?.comite_assedio));

  const cargaPorLicao = useMemo(
    () => new Map(licoes.map((l) => [l.titulo, l.carga_minutos])),
    [licoes],
  );
  const resumo = useMemo(() => resumir(linhas, cargaPorLicao), [linhas, cargaPorLicao]);

  function exportarCsv() {
    baixarCsv(
      `evidencia-${campanha?.nome ?? "campanha"}.csv`,
      montarCsv(
        ["matricula", "nome", "setor", "licao", "concluido_em", "nota", "tentativas", "situacao"],
        linhas.map((l) => [
          l.matricula,
          l.nome,
          l.setor,
          l.licao,
          l.concluido_em ? formatarData(l.concluido_em) : "",
          l.nota ?? "",
          l.tentativas,
          ROTULO_DA_SITUACAO[l.situacao],
        ]),
      ),
    );
  }

  /** PDF com jspdf, montado por texto — não é captura de tela. */
  async function gerarPdf(comCanal: boolean) {
    if (!campanha) return;
    setGerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const largura = pdf.internal.pageSize.getWidth();
      const altura = pdf.internal.pageSize.getHeight();
      const margem = 40;
      let y = margem;

      const rodape = () => {
        const pagina = pdf.getCurrentPageInfo().pageNumber;
        pdf.setFontSize(7);
        pdf.setTextColor(110);
        const linhasAviso = pdf.splitTextToSize(AVISO_OBRIGATORIO, largura - margem * 2);
        pdf.text(linhasAviso, margem, altura - 46);
        pdf.text(`Página ${pagina}`, largura - margem, altura - 18, { align: "right" });
        pdf.setTextColor(0);
      };

      const novaPaginaSePreciso = (espaco: number) => {
        if (y + espaco < altura - 70) return;
        rodape();
        pdf.addPage();
        y = margem;
      };

      // 1. Cabeçalho
      pdf.setFontSize(16);
      pdf.text(
        comCanal
          ? "Relatório de Prevenção ao Assédio (CIPA+A)"
          : "Relatório de Evidência de Treinamento",
        margem,
        y,
      );
      y += 20;
      pdf.setFontSize(10);
      pdf.text(perfil?.empresa.nome ?? "", margem, y);
      y += 14;
      pdf.text(
        `Campanha: ${campanha.nome} · ${formatarData(campanha.inicio)} a ${formatarData(campanha.fim)}`,
        margem,
        y,
      );
      y += 14;
      pdf.text(
        `Emitido em ${formatarDataHora(new Date().toISOString())} por ${perfil?.nome ?? ""}`,
        margem,
        y,
      );
      y += 24;

      // 2. Resumo
      pdf.setFontSize(12);
      pdf.text("Resumo", margem, y);
      y += 16;
      pdf.setFontSize(10);
      for (const texto of [
        `Colaboradores no escopo: ${resumo.colaboradores}`,
        `Concluintes de todas as lições: ${resumo.concluintes} (${resumo.percentualConclusao}%)`,
        `Nota média: ${resumo.notaMedia ?? "—"}`,
        `Carga horária da trilha: ${cargaEmHoras(resumo.cargaTotalMinutos)}`,
      ]) {
        pdf.text(texto, margem, y);
        y += 13;
      }
      y += 12;

      // 3. Tabela por lição
      pdf.setFontSize(12);
      pdf.text("Participação por lição", margem, y);
      y += 16;
      pdf.setFontSize(8);
      pdf.text(
        "Matrícula   Nome                    Setor            Lição            Conclusão   Nota  Situação",
        margem,
        y,
      );
      y += 12;

      for (const l of linhas) {
        novaPaginaSePreciso(14);
        const texto = [
          l.matricula.padEnd(11).slice(0, 11),
          l.nome.padEnd(23).slice(0, 23),
          l.setor.padEnd(16).slice(0, 16),
          l.licao.padEnd(16).slice(0, 16),
          (l.concluido_em ? formatarData(l.concluido_em) : "—").padEnd(11),
          String(l.nota ?? "—").padEnd(5),
          ROTULO_DA_SITUACAO[l.situacao],
        ].join(" ");
        pdf.text(texto, margem, y);
        y += 11;
      }
      y += 14;

      // 4. Presença em eventos
      if (presenca.length > 0) {
        novaPaginaSePreciso(60);
        pdf.setFontSize(12);
        pdf.text("Presença em eventos", margem, y);
        y += 16;
        pdf.setFontSize(9);
        for (const e of presenca) {
          novaPaginaSePreciso(14);
          pdf.text(
            `${formatarData(e.inicio)}  ${e.tipo.toUpperCase()}  ${e.titulo}  —  ${e.presentes} presente(s)`,
            margem,
            y,
          );
          y += 12;
        }
        y += 14;
      }

      // Canal de Respeito: só agregado, e só para o comitê.
      if (comCanal && canal.length > 0) {
        novaPaginaSePreciso(80);
        pdf.setFontSize(12);
        pdf.text("Canal de Respeito — números agregados", margem, y);
        y += 14;
        pdf.setFontSize(8);
        pdf.text(
          "Somente quantidade por mês e status. Este relatório não contém protocolo, categoria nem conteúdo de denúncia.",
          margem,
          y,
        );
        y += 16;
        pdf.setFontSize(9);
        for (const a of canal) {
          novaPaginaSePreciso(14);
          pdf.text(`${a.mes}  ${rotuloDoStatusDenuncia(a.status)}  —  ${a.quantidade}`, margem, y);
          y += 12;
        }
        y += 14;
      }

      // 5. Assinaturas
      novaPaginaSePreciso(90);
      y += 20;
      pdf.setFontSize(10);
      for (const papel of ASSINATURAS) {
        pdf.line(margem, y, margem + 200, y);
        y += 12;
        pdf.text(papel, margem, y);
        y += 34;
      }

      rodape();
      pdf.save(
        `${comCanal ? "relatorio-cipa-a" : "evidencia-treinamento"}-${campanha.nome.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`,
      );
      toast.success("Relatório gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Relatórios</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-borda bg-superficie p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campanha-relatorio">Campanha</Label>
          <select
            id="campanha-relatorio"
            value={campanhaId ?? ""}
            onChange={(e) => setCampanhaId(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({ROTULO_DO_STATUS[c.status]})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setor-relatorio">Setor</Label>
          <select
            id="setor-relatorio"
            value={setorId}
            onChange={(e) => setSetorId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { r: "Colaboradores", v: resumo.colaboradores },
          { r: "Concluintes", v: `${resumo.concluintes} (${resumo.percentualConclusao}%)` },
          { r: "Nota média", v: resumo.notaMedia ?? "—" },
          { r: "Carga da trilha", v: cargaEmHoras(resumo.cargaTotalMinutos) },
        ].map((n) => (
          <div key={n.r} className="rounded-2xl border border-borda bg-superficie p-4">
            <dt className="text-xs uppercase tracking-wide text-texto-suave">{n.r}</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums text-marinho">
              {n.v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => gerarPdf(false)} disabled={gerando || !campanha}>
          {gerando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          <FileText className="size-4" aria-hidden />
          Evidência de treinamento (PDF)
        </Button>
        <MaisOpcoes
          opcoes={[
            {
              rotulo: "Mesmos dados em CSV",
              icone: <Download aria-hidden />,
              aoClicar: exportarCsv,
              desabilitado: linhas.length === 0,
            },
          ]}
        />
        {perfil?.comite_assedio && (
          <Button
            variant="outline"
            onClick={() => gerarPdf(true)}
            disabled={gerando || !campanha}
            className="border-respeito text-respeito"
          >
            <Lock className="size-4" aria-hidden />
            Relatório CIPA+A (PDF)
          </Button>
        )}
      </div>

      {perfil?.comite_assedio && (
        <p className="text-xs text-texto-suave">
          O relatório CIPA+A serve de evidência da capacitação periódica exigida pela Lei
          14.457/2022. Do Canal de Respeito ele leva <strong>só</strong> a quantidade por mês e
          status — nunca protocolo, categoria ou conteúdo.
        </p>
      )}

      {isLoading && <p className="text-sm text-texto-suave">Carregando…</p>}

      {!isLoading && linhas.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          Nenhum progresso de lição nesta campanha ainda. Publique lições na trilha e o relatório
          passa a ter conteúdo.
        </p>
      )}

      {linhas.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-texto-suave">
                <th className="p-3">Matrícula</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Setor</th>
                <th className="p-3">Lição</th>
                <th className="p-3">Conclusão</th>
                <th className="p-3 text-right">Nota</th>
                <th className="p-3 text-right">Tentativas</th>
                <th className="p-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-b border-borda last:border-0">
                  <td className="p-3 tabular-nums">{l.matricula}</td>
                  <td className="p-3">{l.nome}</td>
                  <td className="p-3 text-texto-suave">{l.setor}</td>
                  <td className="p-3 text-texto-suave">{l.licao}</td>
                  <td className="p-3">{l.concluido_em ? formatarData(l.concluido_em) : "—"}</td>
                  <td className="p-3 text-right tabular-nums">{l.nota ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums text-texto-suave">{l.tentativas}</td>
                  <td className="p-3">
                    <span
                      className={
                        l.situacao === "aprovado" ? "font-semibold text-verde" : "text-texto-suave"
                      }
                    >
                      {ROTULO_DA_SITUACAO[l.situacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <hr className="border-borda" />

      <Comparativo
        campanhas={campanhas}
        nomeDoSetor={(id) => setores.find((s) => s.id === id)?.nome ?? "Setor removido"}
        nomeDoTema={(id) => temas.find((t) => t.id === id)?.nome ?? "Tema removido"}
        nomeDaEmpresa={perfil?.empresa.nome ?? ""}
      />
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/relatorios")({
  component: Relatorios,
});
