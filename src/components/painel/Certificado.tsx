import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { TimeLogo } from "@/components/TimeLogo";
import { formatarData } from "@/lib/datas";

export type DadosCertificado = {
  codigo: string;
  tipo: string;
  titulo: string;
  nome: string;
  setor: string | null;
  empresa: string;
  campanha: string;
  inicio: string | null;
  fim: string | null;
  carga_minutos: number | null;
  emitido_em: string;
  assinatura: string;
};

/** "90 min" → "1 hora e 30 minutos" (docs/TIME_09 §5). */
export function cargaEmTexto(minutos: number | null): string {
  if (!minutos || minutos <= 0) return "";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const partes: string[] = [];
  if (horas > 0) partes.push(`${horas} hora${horas > 1 ? "s" : ""}`);
  if (resto > 0) partes.push(`${resto} minuto${resto > 1 ? "s" : ""}`);
  return partes.join(" e ");
}

/**
 * Modelo do certificado em A4 paisagem (docs/TIME_09 §5).
 *
 * Renderiza em pixels fixos (1123×794, que é A4 a 96 dpi) porque o html2canvas
 * captura o que está na tela: um layout responsivo sairia de tamanho diferente
 * em cada monitor.
 */
export const Certificado = forwardRef<HTMLDivElement, { dados: DadosCertificado }>(
  function Certificado({ dados }, ref) {
    const carga = cargaEmTexto(dados.carga_minutos);
    const url =
      typeof window === "undefined"
        ? `/verificar/${dados.codigo}`
        : `${window.location.origin}/verificar/${dados.codigo}`;

    const texto =
      dados.tipo === "conclusao"
        ? `concluiu a trilha de capacitação da campanha ${dados.campanha}${
            carga ? `, com carga horária de ${carga}` : ""
          }, na plataforma T.I.M.E. Seguro.`
        : `conquistou destaque na campanha ${dados.campanha}${
            dados.inicio && dados.fim
              ? `, realizada de ${formatarData(dados.inicio)} a ${formatarData(dados.fim)}`
              : ""
          }, pelo compromisso com a segurança e o respeito no ambiente de trabalho.`;

    return (
      <div
        ref={ref}
        style={{ width: 1123, height: 794 }}
        className="relative flex flex-col bg-white p-14"
      >
        {/* Faixa zebrada discreta nos cantos — identidade de segurança. */}
        <div className="faixa-seguranca absolute inset-x-0 top-0" />
        <div className="faixa-seguranca absolute inset-x-0 bottom-0" />

        <header className="flex items-start justify-between">
          <TimeLogo tamanho="lg" />
          <p className="text-right text-sm text-texto-suave">
            {dados.empresa}
            <span className="block">{dados.campanha}</span>
          </p>
        </header>

        <div className="mt-10 flex flex-1 flex-col justify-center">
          <p className="font-display text-4xl font-extrabold text-marinho">{dados.titulo}</p>

          <p className="mt-8 max-w-4xl text-2xl leading-relaxed text-texto">
            Certificamos que <strong className="font-bold">{dados.nome}</strong>
            {dados.setor && <>, do setor {dados.setor}</>}, {texto}
          </p>
        </div>

        <footer className="flex items-end justify-between">
          <div>
            <p className="w-72 border-t border-texto pt-2 text-base text-texto">
              {dados.assinatura}
            </p>
            <p className="text-sm text-texto-suave">Técnico de Segurança do Trabalho</p>
            <p className="mt-3 text-sm text-texto-suave">
              Emitido em {formatarData(dados.emitido_em)}
            </p>
          </div>

          <div className="flex items-end gap-4">
            <p className="max-w-xs text-xs leading-snug text-texto-suave">
              Trilha complementar: não substitui os treinamentos formais obrigatórios das Normas
              Regulamentadoras. Verifique a autenticidade pelo código.
            </p>
            <div className="text-center">
              <QRCodeSVG value={url} size={96} level="M" />
              <p className="mt-1 font-mono text-xs text-marinho">{dados.codigo}</p>
            </div>
          </div>
        </footer>
      </div>
    );
  },
);
