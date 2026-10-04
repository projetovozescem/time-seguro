import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCampanhaAtiva, usePerfil } from "@/hooks/usePerfil";
import { formatarData } from "@/lib/datas";
import { ICONES_MATERIAL, caminhoDoMaterial, lerBlocos } from "@/lib/materiais";

/**
 * Cartazes para imprimir (docs/TIME_04 §13).
 *
 * Tamanho em pixel FIXO: o html2canvas captura o que está na tela, então um
 * layout responsivo sairia de um tamanho diferente a cada janela. A 96 dpi,
 * A4 retrato ≈ 794×1123 px e 16:9 de TV ≈ 1280×720 px.
 */
const FORMATOS = {
  a4: { rotulo: "A4 (impressão)", largura: 794, altura: 1123 },
  tv: { rotulo: "16:9 (TV e projetor)", largura: 1280, altura: 720 },
} as const;
type Formato = keyof typeof FORMATOS;

/** Escala de captura: 2 já dá qualidade de impressão sem estourar a memória. */
const ESCALA = 2;

/**
 * Origem do site (https://dominio) para montar o endereco dos QR Codes.
 *
 * Vem de `useEffect` e nao de `window` no render: o servidor nao tem `window`, e
 * calcular na renderizacao gera um QR diferente no servidor e no navegador (aviso
 * de hidratacao). Antes de montar, o QR usa o caminho relativo.
 */
function useOrigem(): string {
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);
  return origem;
}

function useBaixarPng(nomeBase: string) {
  const alvo = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);

  async function baixar() {
    if (!alvo.current) return;
    setGerando(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(alvo.current, {
        scale: ESCALA,
        backgroundColor: "#ffffff",
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${nomeBase}.png`;
      a.click();
      toast.success("Cartaz baixado.");
    } catch {
      toast.error("Não foi possível gerar o cartaz.");
    } finally {
      setGerando(false);
    }
  }

  return { alvo, gerando, baixar };
}

function CartazEntreNoTime({ empresa, formato }: { empresa: string; formato: Formato }) {
  const { data: campanha } = useCampanhaAtiva();
  const { alvo, gerando, baixar } = useBaixarPng(`cartaz-entre-no-time-${formato}`);
  const { largura, altura } = FORMATOS[formato];
  const paisagem = formato === "tv";

  const origem = useOrigem();
  const url = `${origem}/app/entrar`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-marinho">Entre no T.I.M.E.</h2>
        <Button onClick={baixar} disabled={gerando}>
          {gerando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Baixar PNG
        </Button>
      </div>

      <div className="overflow-auto rounded-2xl border border-borda bg-muted p-4">
        <div
          ref={alvo}
          style={{ width: largura, height: altura }}
          className="flex flex-col bg-white"
        >
          <div className="faixa-seguranca" style={{ height: 14 }} />

          <div
            className={`flex flex-1 ${paisagem ? "flex-row items-center gap-10 px-16" : "flex-col items-center gap-8 px-12"} py-10 text-center`}
          >
            <div className={paisagem ? "flex-1 text-left" : ""}>
              <p className="text-base font-bold uppercase tracking-[0.2em] text-texto-suave">
                {empresa}
              </p>
              <p className="mt-3 font-display text-6xl font-extrabold leading-none text-marinho">
                ENTRE NO T.I.M.E.
              </p>
              <p className="mt-4 font-display text-3xl font-bold text-texto">
                Treinar · Identificar · Mobilizar · Evoluir
              </p>

              <ol
                className={`mt-8 flex ${paisagem ? "flex-col gap-3" : "flex-row justify-center gap-8"} text-left`}
              >
                {[
                  ["1", "Escaneie", "com a câmera do celular"],
                  ["2", "Aprenda", "perguntas rápidas todo dia"],
                  ["3", "Pontue", "suba no ranking do seu setor"],
                ].map(([n, titulo, detalhe]) => (
                  <li key={n} className="flex items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amarelo font-display text-2xl font-extrabold text-texto">
                      {n}
                    </span>
                    <span>
                      <span className="block font-display text-2xl font-bold text-marinho">
                        {titulo}
                      </span>
                      <span className="block text-lg text-texto-suave">{detalhe}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl border-4 border-marinho p-4">
                <QRCodeSVG value={url} size={paisagem ? 260 : 300} level="M" />
              </div>
              <p className="text-lg font-semibold text-texto">
                Use sua matrícula e o PIN do seu cartão
              </p>
            </div>
          </div>

          {campanha && (
            <div className="bg-marinho px-12 py-5 text-center">
              <p className="font-display text-3xl font-extrabold text-amarelo">{campanha.nome}</p>
              <p className="mt-1 text-xl text-white">
                De {formatarData(campanha.inicio)} a {formatarData(campanha.fim)}
                {campanha.premiacao && ` · ${campanha.premiacao}`}
              </p>
            </div>
          )}

          <div className="faixa-seguranca" style={{ height: 14 }} />
        </div>
      </div>
    </section>
  );
}

function CartazRespeito({ empresa, codigo }: { empresa: string; codigo: string }) {
  const { alvo, gerando, baixar } = useBaixarPng("cartaz-canal-de-respeito");
  const { largura, altura } = FORMATOS.a4;

  const origem = useOrigem();
  const url = `${origem}/respeito/${codigo}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-respeito">Canal de Respeito</h2>
        <Button onClick={baixar} disabled={gerando}>
          {gerando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Baixar PNG
        </Button>
      </div>

      <p className="text-sm text-texto-suave">
        Cole no banheiro, no vestiário e no mural — lugares onde a pessoa está sozinha. O QR abre
        uma página sem login e sem registro de quem entrou.
      </p>

      <div className="overflow-auto rounded-2xl border border-borda bg-muted p-4">
        <div
          ref={alvo}
          style={{ width: largura, height: altura }}
          className="flex flex-col items-center gap-6 bg-white px-12 py-12 text-center"
        >
          <p className="text-base font-bold uppercase tracking-[0.2em] text-texto-suave">
            {empresa}
          </p>
          <p className="font-display text-5xl font-extrabold leading-tight text-respeito">
            CANAL DE RESPEITO
          </p>
          <p className="font-display text-3xl font-bold text-texto">
            Sofreu ou viu assédio? Fale sem dizer quem você é.
          </p>

          <div className="rounded-2xl border-4 border-respeito p-5">
            <QRCodeSVG value={url} size={300} level="M" fgColor="#6a1b9a" />
          </div>

          <ul className="flex flex-col gap-2 text-xl text-texto">
            <li>Não pede nome, matrícula nem login.</li>
            <li>Não registra a hora nem de qual aparelho veio.</li>
            <li>Você recebe um código para acompanhar a resposta.</li>
          </ul>

          <div className="mt-auto w-full rounded-2xl bg-respeito/10 px-6 py-5">
            <p className="font-display text-2xl font-bold text-respeito">
              Também pode ligar, de graça
            </p>
            <p className="mt-2 text-2xl text-texto">
              <strong>180</strong> Central da Mulher · <strong>100</strong> Direitos Humanos ·{" "}
              <strong>190</strong> Polícia
            </p>
          </div>

          <div className="faixa-seguranca w-full" />
        </div>
      </div>
    </section>
  );
}

/**
 * Cartaz do material informativo (tabela `materiais`, migration 0011): textos
 * curtos do banco + QR para a página pública com o mesmo conteúdo.
 */
function CartazMaterial({ empresa, codigo }: { empresa: string; codigo: string }) {
  const { data: materiais = [] } = useQuery({
    queryKey: ["materiais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais")
        .select("id, slug, titulo, subtitulo, blocos, campanhas ( nome )")
        .eq("publicado", true)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [escolhido, setEscolhido] = useState<string>("");
  const material = materiais.find((m) => m.id === escolhido) ?? materiais[0];

  const { alvo, gerando, baixar } = useBaixarPng(`cartaz-${material?.slug ?? "material"}`);
  const { largura, altura } = FORMATOS.a4;
  const origem = useOrigem();

  if (!material) return null;

  const blocos = lerBlocos(material.blocos);
  const url = `${origem}${caminhoDoMaterial(codigo, material.slug)}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-marinho">
          Material da campanha: {material.titulo}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {materiais.length > 1 && (
            <select
              aria-label="Escolher material"
              value={material.id}
              onChange={(e) => setEscolhido(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {materiais.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" asChild>
            <a href={caminhoDoMaterial(codigo, material.slug)} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              Ver página do QR
            </a>
          </Button>
          <Button onClick={baixar} disabled={gerando}>
            {gerando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Baixar PNG
          </Button>
        </div>
      </div>

      <p className="text-sm text-texto-suave">
        Cole no refeitório, na portaria e perto dos pontos de DDS. O QR abre, sem login, uma página
        com estes mesmos textos.
      </p>

      <div className="overflow-auto rounded-2xl border border-borda bg-muted p-4">
        <div
          ref={alvo}
          style={{ width: largura, height: altura }}
          className="flex flex-col bg-white"
        >
          <div className="faixa-seguranca" style={{ height: 14 }} />

          <div className="bg-marinho px-12 py-8 text-white">
            <p className="text-base font-bold uppercase tracking-[0.2em] text-white/75">
              {empresa}
            </p>
            <p className="mt-2 font-display text-6xl font-extrabold leading-none text-amarelo">
              {material.titulo.toUpperCase()}
            </p>
            {material.subtitulo && (
              <p className="mt-3 font-display text-2xl font-bold">{material.subtitulo}</p>
            )}
          </div>

          <div className="grid flex-1 grid-cols-2 content-start gap-4 px-10 py-7">
            {blocos.map((b, i) => {
              const Icone = ICONES_MATERIAL[b.icone];
              return (
                <div key={i} className="flex gap-3 rounded-2xl border-2 border-borda p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amarelo text-marinho">
                    <Icone className="size-7" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-xl font-bold leading-tight text-marinho">
                      {b.titulo}
                    </p>
                    <p className="mt-1 text-base leading-snug text-texto">{b.texto}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-8 bg-fundo px-10 py-6">
            <div className="rounded-2xl border-4 border-marinho bg-white p-3">
              <QRCodeSVG value={url} size={190} level="M" />
            </div>
            <div>
              <p className="font-display text-3xl font-extrabold text-marinho">
                Aponte a câmera e saiba mais
              </p>
              <p className="mt-2 text-xl text-texto">
                Depois, entre no app com sua matrícula e PIN e responda o quiz do dia.
              </p>
              {material.campanhas?.nome && (
                <p className="mt-3 text-lg font-semibold text-texto-suave">
                  Campanha {material.campanhas.nome}
                </p>
              )}
            </div>
          </div>

          <div className="faixa-seguranca" style={{ height: 14 }} />
        </div>
      </div>
    </section>
  );
}

/** Materiais de divulgação em PNG (docs/TIME_04 §13). */
function Materiais() {
  const { data: perfil } = usePerfil();
  const [formato, setFormato] = useState<Formato>("a4");

  const empresa = perfil?.empresa.nome ?? "";
  const codigo = perfil?.empresa.codigo ?? "";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">Materiais</h1>

      {codigo !== "" && <CartazMaterial empresa={empresa} codigo={codigo} />}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-borda bg-superficie p-3">
        <label className="text-sm font-medium" htmlFor="formato-cartaz">
          Formato do cartaz principal
        </label>
        <select
          id="formato-cartaz"
          value={formato}
          onChange={(e) => setFormato(e.target.value as Formato)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {Object.entries(FORMATOS).map(([chave, f]) => (
            <option key={chave} value={chave}>
              {f.rotulo}
            </option>
          ))}
        </select>
      </div>

      <CartazEntreNoTime empresa={empresa} formato={formato} />

      {codigo !== "" && <CartazRespeito empresa={empresa} codigo={codigo} />}

      <section className="rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="font-display text-lg font-bold text-marinho">Os outros dois materiais</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-texto-suave">
          <li>
            <strong className="text-texto">Etiquetas de locais</strong> — em Colaboradores e setores
            (aba Setores e locais), botão “Etiqueta” de cada local.
          </li>
          <li>
            <strong className="text-texto">Cartões de acesso</strong> — em Colaboradores, marque as
            pessoas e clique em “Gerar PIN”.
          </li>
        </ul>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/materiais")({
  component: Materiais,
});
