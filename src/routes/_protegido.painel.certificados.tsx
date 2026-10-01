import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileImage, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Certificado, type DadosCertificado } from "@/components/painel/Certificado";
import { usePerfil } from "@/hooks/usePerfil";
import { useCampanhas } from "@/hooks/useCampanhas";
import { baixarCsv, montarCsv } from "@/lib/eventos";
import { formatarData } from "@/lib/datas";

type CertificadoLinha = {
  id: string;
  tipo: string;
  titulo: string;
  codigo: string;
  carga_minutos: number | null;
  emitido_em: string;
  campanha_id: string;
  colaboradores: { nome: string; matricula: string; setores: { nome: string } | null } | null;
};

function useCertificados() {
  return useQuery({
    queryKey: ["certificados"],
    queryFn: async (): Promise<CertificadoLinha[]> => {
      const { data, error } = await supabase
        .from("certificados")
        .select(
          `id, tipo, titulo, codigo, carga_minutos, emitido_em, campanha_id,
           colaboradores ( nome, matricula, setores ( nome ) )`,
        )
        .order("emitido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CertificadoLinha[];
    },
  });
}

/** Certificados emitidos (docs/TIME_04 §12 e TIME_09 §5). */
function Certificados() {
  const { data: perfil } = usePerfil();
  const { data: certificados = [], isLoading } = useCertificados();
  const { data: campanhas = [] } = useCampanhas();

  const [assinatura, setAssinatura] = useState("");
  const [paraImprimir, setParaImprimir] = useState<DadosCertificado | null>(null);
  const [gerando, setGerando] = useState<"png" | "pdf" | null>(null);
  const modelo = useRef<HTMLDivElement>(null);

  const nomeDaCampanha = new Map(campanhas.map((c) => [c.id, c]));

  function preparar(c: CertificadoLinha) {
    const campanha = nomeDaCampanha.get(c.campanha_id);
    setParaImprimir({
      codigo: c.codigo,
      tipo: c.tipo,
      titulo: c.titulo,
      nome: c.colaboradores?.nome ?? "—",
      setor: c.colaboradores?.setores?.nome ?? null,
      empresa: perfil?.empresa.nome ?? "",
      campanha: campanha?.nome ?? "",
      inicio: campanha?.inicio ?? null,
      fim: campanha?.fim ?? null,
      carga_minutos: c.carga_minutos,
      emitido_em: c.emitido_em,
      assinatura: assinatura.trim() || (perfil?.nome ?? ""),
    });
  }

  /**
   * Gera no navegador (docs/TIME_09 §5). html2canvas e jspdf entram por import
   * dinâmico: são pesados e só fazem falta aqui.
   */
  async function gerar(formato: "png" | "pdf") {
    if (!modelo.current || !paraImprimir) return;
    setGerando(formato);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(modelo.current, { scale: 2, backgroundColor: "#ffffff" });

      if (formato === "png") {
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `certificado-${paraImprimir.codigo}.png`;
        a.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1123, 794] });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 1123, 794);
        pdf.save(`certificado-${paraImprimir.codigo}.pdf`);
      }
      toast.success(`Certificado gerado em ${formato.toUpperCase()}.`);
    } catch {
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setGerando(null);
    }
  }

  function exportar() {
    baixarCsv(
      `certificados-${new Date().toISOString().slice(0, 10)}.csv`,
      montarCsv(
        [
          "codigo",
          "tipo",
          "titulo",
          "colaborador",
          "matricula",
          "setor",
          "carga_minutos",
          "emitido_em",
        ],
        certificados.map((c) => [
          c.codigo,
          c.tipo,
          c.titulo,
          c.colaboradores?.nome ?? "",
          c.colaboradores?.matricula ?? "",
          c.colaboradores?.setores?.nome ?? "",
          c.carga_minutos ?? "",
          formatarData(c.emitido_em),
        ]),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Certificados</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {isLoading ? "Carregando…" : `${certificados.length} emitido(s)`}. Os certificados são
            emitidos quando a campanha é encerrada.
          </p>
        </div>
        <Button variant="outline" onClick={exportar} disabled={certificados.length === 0}>
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </Button>
      </header>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-superficie p-4 sm:max-w-md">
        <Label htmlFor="assinatura">Nome na assinatura</Label>
        <Input
          id="assinatura"
          value={assinatura}
          onChange={(e) => setAssinatura(e.target.value)}
          placeholder={perfil?.nome ?? "Técnico de SST"}
        />
        <p className="text-xs text-texto-suave">
          Aparece sobre a linha de assinatura do certificado.
        </p>
      </div>

      {!isLoading && certificados.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          Nenhum certificado ainda. Encerre uma campanha para emiti-los.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {certificados.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-borda bg-superficie p-4"
          >
            <div className="min-w-48 flex-1">
              <p className="font-medium text-texto">{c.titulo}</p>
              <p className="mt-0.5 text-xs text-texto-suave">
                {c.colaboradores?.nome ?? "—"}
                {c.colaboradores?.setores?.nome && ` · ${c.colaboradores.setores.nome}`} ·{" "}
                {formatarData(c.emitido_em)}
              </p>
              <p className="mt-0.5 font-mono text-xs text-marinho">{c.codigo}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => preparar(c)}>
              Abrir modelo
            </Button>
          </li>
        ))}
      </ul>

      {paraImprimir && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-marinho">{paraImprimir.codigo}</h2>
            <Button size="sm" onClick={() => gerar("png")} disabled={gerando !== null}>
              {gerando === "png" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              <FileImage className="size-4" aria-hidden />
              PNG
            </Button>
            <Button size="sm" onClick={() => gerar("pdf")} disabled={gerando !== null}>
              {gerando === "pdf" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              <FileText className="size-4" aria-hidden />
              PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setParaImprimir(null)}>
              Fechar
            </Button>
          </div>

          {/* O modelo é capturado como está, então rola em vez de encolher. */}
          <div className="overflow-x-auto rounded-2xl border border-borda bg-muted p-4">
            <Certificado ref={modelo} dados={paraImprimir} />
          </div>
        </section>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/certificados")({
  component: Certificados,
});
