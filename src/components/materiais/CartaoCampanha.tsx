import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { urlDaTurma, type Turma } from "@/lib/vozes";

/** URL da raiz do app do aluno — para onde aponta o QR do card neutro. */
function urlEntradaAluno(): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/aluno`;
}

/*
 * O material é renderizado no tamanho real fora da tela e capturado com
 * html2canvas, então a imagem sai fiel ao que se vê no preview.
 *
 * Dentro da área capturada só entram emoji, texto e formas em CSS — o
 * html2canvas rasteriza isso de forma confiável, enquanto SVG inline
 * (os ícones do lucide, por exemplo) às vezes sai faltando.
 */
export type FormatoMaterial = "16:9" | "a4";

/** Escala máxima do preview; em telas estreitas ela diminui (ver `ajustar`). */
const ESCALA_BASE = 0.33;

const DIMENSOES: Record<
  FormatoMaterial,
  { largura: number; altura: number; escalaCaptura: number }
> = {
  // 16:9 sai em 1920x1080 (Full HD), tamanho ideal para postar e projetar.
  "16:9": { largura: 1920, altura: 1080, escalaCaptura: 1 },
  // A4 sai em 2480x3508, que dá os 300dpi esperados para impressão.
  a4: { largura: 1240, altura: 1754, escalaCaptura: 2 },
};

const PASSOS = [
  { emoji: "📷", titulo: "Escaneie", texto: "Aponte a câmera para o QR Code" },
  { emoji: "💬", titulo: "Responda", texto: "Todas as perguntas, hoje!" },
  { emoji: "🏆", titulo: "Pontue", texto: "10 pontos por resposta certa" },
];

export function CartaoCampanha({
  turma,
  formato,
  aoPronto,
}: {
  /** Sem turma, o card fica neutro: sem selo de turma, QR aponta para /aluno. */
  turma?: Turma;
  formato: FormatoMaterial;
  /** Entrega ao componente pai a função de captura, para ele gerar o PNG (ex.: compartilhar). */
  aoPronto?: (gerarPng: () => Promise<Blob | null>) => void;
}) {
  const alvoRef = useRef<HTMLDivElement>(null);
  const escalaRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);
  const [escala, setEscala] = useState(ESCALA_BASE);
  const url = turma ? urlDaTurma(turma.id) : urlEntradaAluno();
  const { largura, altura, escalaCaptura } = DIMENSOES[formato];
  const paisagem = formato === "16:9";
  const nomeArquivo = turma
    ? `vozes-turma-${turma.nome}-${paisagem ? "16x9" : "a4"}.png`
    : `vozes-campanha-${paisagem ? "16x9" : "a4"}.png`;

  // O preview encolhe junto com a tela para caber no celular do professor.
  useEffect(() => {
    function ajustar() {
      const w = wrapperRef.current?.parentElement?.clientWidth ?? window.innerWidth;
      const pad = window.innerWidth < 640 ? 16 : 48;
      const disponivel = Math.max(280, w - pad);
      setEscala(Math.min(ESCALA_BASE, disponivel / largura));
    }
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [largura]);

  /*
   * O preview mostra o card reduzido com `transform: scale()`, mas o
   * html2canvas mede o alvo com getBoundingClientRect — ou seja, já reduzido —
   * e mesmo assim desenha os estilos em tamanho natural. A arte saía estourada
   * para fora do quadro.
   *
   * A saída é tirar a escala do caminho durante a captura: o div que escala vai
   * para fora da tela em tamanho natural, medimos ali, e devolvemos tudo no
   * lugar. Como a caixa de preview mantém o tamanho próprio, a página não pisca
   * nem dá salto de layout. Isso vale para qualquer escala, inclusive as
   * menores que o ajuste responsivo acima produz no celular.
   */
  async function capturar() {
    const elemento = alvoRef.current;
    const escalador = escalaRef.current;
    if (!elemento || !escalador) return null;
    const { default: html2canvas } = await import("html2canvas");

    const estiloOriginal = escalador.getAttribute("style") ?? "";
    escalador.style.transform = "none";
    escalador.style.position = "fixed";
    escalador.style.top = "0";
    escalador.style.left = "-99999px";

    try {
      return await html2canvas(elemento, {
        scale: escalaCaptura,
        backgroundColor: "#4B0082",
        width: largura,
        height: altura,
        windowWidth: largura,
        windowHeight: altura,
        scrollX: 0,
        scrollY: 0,
        useCORS: true,
        logging: false,
      });
    } finally {
      escalador.setAttribute("style", estiloOriginal);
    }
  }

  async function gerarPng(): Promise<Blob | null> {
    const canvas = await capturar();
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  // Expõe a captura para quem usa o componente (ex.: tela de compartilhar do aluno).
  useEffect(() => {
    aoPronto?.(gerarPng);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aoPronto é estável na prática; evita loop se o pai não memoizar
  }, []);

  async function baixarPNG() {
    if (gerando) return;
    setGerando(true);
    try {
      const canvas = await capturar();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = nomeArquivo;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagem gerada!");
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  async function imprimir() {
    const canvas = await capturar();
    if (!canvas) return;
    const titulo = turma ? `V.O.Z.E.S. — Turma ${turma.nome}` : "V.O.Z.E.S.";
    const janela = window.open("", "_blank", "width=900,height=1000");
    if (!janela) return;
    janela.document.write(
      `<html><head><title>${titulo}</title>
       <style>@page{size:${paisagem ? "A4 landscape" : "A4"};margin:0}
       body{margin:0}img{width:100%;display:block}</style>
       </head><body><img src="${canvas.toDataURL("image/png")}" /></body></html>`,
    );
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 400);
  }

  /* ---------- blocos reaproveitados pelos dois formatos ---------- */

  const marca = (
    <div style={{ textAlign: paisagem ? "left" : "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          background: "rgba(255,255,255,0.12)",
          border: "2px solid rgba(255,255,255,0.25)",
          borderRadius: 999,
          padding: "10px 26px",
        }}
      >
        <span style={{ fontSize: 34, lineHeight: 1 }}>💜</span>
        <span
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontSize: 30,
            fontWeight: 700,
            color: "#EAD1F7",
            letterSpacing: "0.08em",
          }}
        >
          CAMPANHA 2026
        </span>
      </div>

      <h1
        style={{
          fontFamily: "Outfit, system-ui, sans-serif",
          fontSize: paisagem ? 118 : 96,
          fontWeight: 800,
          color: "#FFFFFF",
          margin: "22px 0 0",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        V.O.Z.E.S.
      </h1>
      <p
        style={{
          fontSize: paisagem ? 30 : 27,
          color: "#EAD1F7",
          margin: "16px 0 0",
          lineHeight: 1.45,
          maxWidth: paisagem ? 620 : "none",
        }}
      >
        Valorização, Orientação e Zelo pela Existência das Mulheres
      </p>
    </div>
  );

  const cartaoQR = (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 32,
        padding: paisagem ? "34px 34px 26px" : "30px 30px 24px",
        textAlign: "center",
      }}
    >
      <QRCodeCanvas
        value={url}
        size={paisagem ? 330 : 340}
        fgColor="#4B0082"
        bgColor="#FFFFFF"
        level="M"
      />
      <div
        style={{
          marginTop: 22,
          background: "linear-gradient(135deg,#7030A0 0%,#9B59B6 100%)",
          borderRadius: 999,
          padding: "12px 30px",
          display: "inline-block",
        }}
      >
        <span
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontSize: 36,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "0.02em",
          }}
        >
          {turma ? `TURMA ${turma.nome}` : "ESCOLHA SUA TURMA"}
        </span>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 22, color: "#6B7280" }}>
        {turma ? turma.serie : "Escaneie e participe pela sua turma"}
      </p>
    </div>
  );

  const passos = (
    <div
      style={{
        display: "flex",
        flexDirection: paisagem ? "column" : "row",
        gap: paisagem ? 16 : 18,
        width: "100%",
      }}
    >
      {PASSOS.map((p, i) => (
        <div
          key={p.titulo}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: paisagem ? "row" : "column",
            alignItems: "center",
            gap: paisagem ? 18 : 10,
            background: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.18)",
            borderRadius: 22,
            padding: paisagem ? "18px 24px" : "22px 16px",
            textAlign: paisagem ? "left" : "center",
          }}
        >
          <div
            style={{
              width: 62,
              height: 62,
              flexShrink: 0,
              borderRadius: 999,
              background: "rgba(234,209,247,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              lineHeight: 1,
            }}
          >
            {p.emoji}
          </div>
          <div>
            <p
              style={{
                fontFamily: "Outfit, system-ui, sans-serif",
                fontSize: 27,
                fontWeight: 700,
                color: "#FFFFFF",
                margin: 0,
              }}
            >
              {i + 1}. {p.titulo}
            </p>
            <p style={{ fontSize: 21, color: "#EAD1F7", margin: "3px 0 0", lineHeight: 1.3 }}>
              {p.texto}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const hashtag = (
    <div
      style={{
        display: "inline-block",
        background: "linear-gradient(135deg,#F1C40F 0%,#E67E22 100%)",
        borderRadius: 999,
        padding: "14px 38px",
      }}
    >
      <span
        style={{
          fontFamily: "Outfit, system-ui, sans-serif",
          fontSize: 34,
          fontWeight: 800,
          color: "#3B1A00",
          letterSpacing: "-0.01em",
        }}
      >
        #VozesQueProtegem
      </span>
    </div>
  );

  const rodape = (
    <div
      style={{
        borderTop: "2px solid rgba(255,255,255,0.18)",
        paddingTop: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        fontSize: 21,
        color: "#EAD1F7",
      }}
    >
      <span>CEM de Gurupi · Campanha 2026</span>
      <span>📞 Denuncie: 180 · Emergência: 190</span>
    </div>
  );

  const fundo = {
    width: largura,
    height: altura,
    boxSizing: "border-box" as const,
    fontFamily: "Figtree, system-ui, sans-serif",
    background:
      "radial-gradient(circle at 82% 12%, rgba(155,89,182,0.55) 0%, transparent 45%), linear-gradient(145deg,#4B0082 0%,#7030A0 62%,#9B59B6 100%)",
    display: "flex",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center overflow-x-auto rounded-2xl border border-border bg-muted/40 p-2 sm:p-4">
        {/* A caixa mantém o tamanho reduzido; só o div interno é escalado — e é
            ele que sai de cena durante a captura (ver `capturar`). */}
        <div
          ref={wrapperRef}
          className="origin-top"
          style={{ minWidth: largura * escala, width: largura * escala, height: altura * escala }}
        >
          <div
            ref={escalaRef}
            style={{ transform: `scale(${escala})`, transformOrigin: "top left" }}
          >
            {paisagem ? (
              <div
                ref={alvoRef}
                style={{ ...fundo, alignItems: "center", padding: "72px 84px", gap: 76 }}
              >
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: "100%",
                  }}
                >
                  {marca}
                  {passos}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {hashtag}
                    {rodape}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>{cartaoQR}</div>
              </div>
            ) : (
              <div
                ref={alvoRef}
                style={{
                  ...fundo,
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "72px 68px",
                  gap: 40,
                }}
              >
                {marca}
                {cartaoQR}
                {passos}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 24,
                    width: "100%",
                  }}
                >
                  {hashtag}
                  {rodape}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => void baixarPNG()} disabled={gerando}>
          <Download className="size-4" /> {gerando ? "Gerando…" : "Baixar PNG"}
        </Button>
        <Button variant="outline" onClick={() => void imprimir()}>
          <Printer className="size-4" /> Imprimir
        </Button>
      </div>
    </div>
  );
}
