import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePerfil } from "@/hooks/usePerfil";
import { useEnunciadosExistentes, usePerguntas, useTemas } from "@/hooks/usePerguntas";
import { lerTxt } from "@/lib/importacao/txt";
import { lerCsv, MODELO_CSV } from "@/lib/importacao/csv";
import { LETRAS, type PerguntaImportada } from "@/lib/importacao/tipos";
import {
  TEXTO_DO_AVISO,
  ehBloqueante,
  emBlocos,
  paraSalvar,
  prepararRevisao,
  resumir,
  temPendencia,
  type ItemRevisao,
} from "@/lib/importacao/validacao";

type Aba = "arquivo" | "texto" | "global";
const LIMITE_MB = 25;

/** Importador de perguntas (docs/TIME_07 §6). */
function Importar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: perfil } = usePerfil();
  const { data: temas = [] } = useTemas();
  const { data: perguntas = [] } = usePerguntas();
  const { data: enunciadosExistentes = [] } = useEnunciadosExistentes();

  const [aba, setAba] = useState<Aba>("arquivo");
  const [texto, setTexto] = useState("");
  const [temaPadrao, setTemaPadrao] = useState("");
  const [temaGlobal, setTemaGlobal] = useState("");
  const [itens, setItens] = useState<ItemRevisao[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const globais = useMemo(() => perguntas.filter((p) => p.empresa_id === null), [perguntas]);
  const resumo = itens ? resumir(itens) : null;

  /** Aplica o tema padrão do lote em quem veio sem tema (docs/TIME_07 §6). */
  function revisar(lidas: PerguntaImportada[]) {
    if (lidas.length === 0) {
      toast.error("Não encontrei pergunta nenhuma nesse conteúdo.");
      return;
    }
    const slugPadrao = temas.find((t) => t.id === temaPadrao)?.slug ?? null;
    const comTema = lidas.map((p) => (p.tema ? p : { ...p, tema: slugPadrao }));
    const preparadas = prepararRevisao(comTema, temas, enunciadosExistentes);

    const descartadas = lidas.length - preparadas.length;
    setItens(preparadas);
    toast.success(
      descartadas > 0
        ? `${preparadas.length} pergunta(s) para revisar. ${descartadas} repetida(s) no arquivo foram descartadas.`
        : `${preparadas.length} pergunta(s) para revisar.`,
    );
  }

  async function lerArquivo(arquivo: File) {
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      toast.error(`Arquivo acima de ${LIMITE_MB} MB.`);
      return;
    }
    const nome = arquivo.name.toLowerCase();
    if (nome.endsWith(".pdf")) {
      toast.error("Leitura de PDF ainda não está pronta. Use TXT ou CSV, ou cole o texto.");
      return;
    }
    const conteudo = await arquivo.text();
    revisar(nome.endsWith(".csv") ? lerCsv(conteudo) : lerTxt(conteudo));
  }

  function importarDoGlobal() {
    const alvo = temaGlobal ? globais.filter((p) => p.tema_id === temaGlobal) : globais;
    const slugDoTema = new Map(temas.map((t) => [t.id, t.slug]));
    revisar(
      alvo.map((p) => ({
        enunciado: p.enunciado,
        alternativas: p.alternativas,
        correta: p.correta,
        tema: slugDoTema.get(p.tema_id) ?? null,
        ...(p.explicacao ? { explicacao: p.explicacao } : {}),
        dificuldade: (p.dificuldade as 1 | 2 | 3) ?? 2,
        avisos: [],
      })),
    );
  }

  function alterar(chave: string, mudanca: Partial<ItemRevisao>) {
    setItens(
      (atual) =>
        atual?.map((i) => {
          if (i.chave !== chave) return i;
          const novo = { ...i, ...mudanca };
          // Corrigir na tela tem de limpar o aviso que a correção resolveu.
          novo.avisos = novo.avisos.filter((a) => {
            if (a === "resposta_nao_detectada" || a === "correta_fora_da_faixa") {
              return novo.correta === null;
            }
            if (a === "tema_ausente" || a === "tema_desconhecido") return novo.tema_id === null;
            if (a === "poucas_alternativas") {
              return novo.alternativas.filter((t) => t.trim()).length < 2;
            }
            return true;
          });
          return novo;
        }) ?? null,
    );
  }

  async function salvar() {
    if (!itens || !resumo?.podeSalvar || !perfil) return;
    setSalvando(true);

    const linhas = paraSalvar(itens, perfil.empresa.id);
    let gravadas = 0;
    try {
      // Blocos de 100 (docs/TIME_07 §6).
      for (const bloco of emBlocos(linhas, 100)) {
        const { error } = await supabase.from("perguntas").insert(bloco);
        if (error) throw error;
        gravadas += bloco.length;
      }
    } catch {
      setSalvando(false);
      toast.error(
        gravadas > 0
          ? `Falhou depois de gravar ${gravadas}. Confira a lista antes de tentar de novo.`
          : "Não foi possível salvar. Nada foi gravado.",
      );
      return;
    }

    const ignoradas = itens.length - linhas.length;
    await queryClient.invalidateQueries({ queryKey: ["perguntas"] });
    await queryClient.invalidateQueries({ queryKey: ["enunciados-existentes"] });
    setSalvando(false);

    toast.success(
      ignoradas > 0
        ? `${gravadas} perguntas importadas. ${ignoradas} ignoradas.`
        : `${gravadas} perguntas importadas.`,
    );
    await navigate({ to: "/painel/perguntas" });
  }

  function baixarModelo() {
    const url = URL.createObjectURL(new Blob([MODELO_CSV], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-perguntas-time.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------------- revisão
  if (itens && resumo) {
    return (
      <div className="flex flex-col gap-5 pb-24">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-marinho">Revisão</h1>
            <p className="mt-1 text-sm text-texto-suave">
              Confira antes de salvar. Pergunta com 🔴 impede o salvamento.
            </p>
          </div>
          <Button variant="outline" onClick={() => setItens(null)}>
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Button>
        </header>

        <ul className="flex flex-col gap-3">
          {itens.map((item) => {
            const bloqueios = item.avisos.filter(ehBloqueante);
            const atencoes = item.avisos.filter((a) => !ehBloqueante(a));

            return (
              <li
                key={item.chave}
                className={`rounded-2xl border bg-superficie p-4 ${
                  bloqueios.length > 0 ? "border-vermelho" : "border-borda"
                } ${item.selecionada ? "" : "opacity-60"}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.selecionada}
                    onChange={(e) => alterar(item.chave, { selecionada: e.target.checked })}
                    aria-label="Incluir esta pergunta"
                    className="mt-1 size-5 shrink-0"
                  />
                  <Textarea
                    rows={2}
                    value={item.enunciado}
                    onChange={(e) => alterar(item.chave, { enunciado: e.target.value })}
                    className="flex-1"
                  />
                </div>

                <ul className="mt-3 flex flex-col gap-2">
                  {item.alternativas.map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => alterar(item.chave, { correta: i })}
                        aria-label={`Marcar ${LETRAS[i]} como correta`}
                        aria-pressed={item.correta === i}
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-display font-bold ${
                          item.correta === i
                            ? "border-verde bg-verde text-white"
                            : "border-borda text-marinho"
                        }`}
                      >
                        {item.correta === i ? <Check className="size-4" aria-hidden /> : LETRAS[i]}
                      </button>
                      <Input
                        value={a}
                        onChange={(e) =>
                          alterar(item.chave, {
                            alternativas: item.alternativas.map((t, j) =>
                              j === i ? e.target.value : t,
                            ),
                          })
                        }
                      />
                      {item.alternativas.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            alterar(item.chave, {
                              alternativas: item.alternativas.filter((_, j) => j !== i),
                              correta:
                                item.correta === i
                                  ? null
                                  : item.correta !== null && item.correta > i
                                    ? item.correta - 1
                                    : item.correta,
                            })
                          }
                          aria-label={`Remover alternativa ${LETRAS[i]}`}
                          className="shrink-0 text-texto-suave hover:text-vermelho"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                  {item.alternativas.length < 5 && (
                    <li>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          alterar(item.chave, { alternativas: [...item.alternativas, ""] })
                        }
                      >
                        <Plus className="size-4" aria-hidden />
                        Alternativa
                      </Button>
                    </li>
                  )}
                </ul>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <select
                      value={item.tema_id ?? ""}
                      onChange={(e) => alterar(item.chave, { tema_id: e.target.value || null })}
                      aria-label="Tema"
                      className={`h-10 w-full rounded-md border bg-transparent px-3 text-sm ${
                        item.tema_id ? "border-input" : "border-vermelho"
                      }`}
                    >
                      <option value="">Escolha o tema…</option>
                      {temas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.icone} {t.nome}
                        </option>
                      ))}
                    </select>
                    {item.tema && !item.tema_id && (
                      <p className="mt-1 text-xs text-vermelho">
                        O arquivo trazia “{item.tema}”, que não existe no banco.
                      </p>
                    )}
                  </div>
                  <select
                    value={item.dificuldade ?? 2}
                    onChange={(e) =>
                      alterar(item.chave, { dificuldade: Number(e.target.value) as 1 | 2 | 3 })
                    }
                    aria-label="Dificuldade"
                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value={1}>Fácil</option>
                    <option value={2}>Média</option>
                    <option value={3}>Difícil</option>
                  </select>
                </div>

                <Textarea
                  rows={2}
                  value={item.explicacao ?? ""}
                  onChange={(e) => alterar(item.chave, { explicacao: e.target.value })}
                  placeholder="Explicação (recomendada)"
                  className="mt-3"
                />
                {!item.explicacao?.trim() && (
                  <p className="mt-1 text-xs text-laranja">
                    🟡 Sem explicação o colaborador não aprende com o erro.
                  </p>
                )}

                {bloqueios.map((a) => (
                  <p key={a} className="mt-2 text-sm font-medium text-vermelho">
                    🔴 {TEXTO_DO_AVISO[a]}
                  </p>
                ))}
                {atencoes.map((a) => (
                  <p key={a} className="mt-2 text-sm text-laranja">
                    🟡 {TEXTO_DO_AVISO[a]}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 px-4 py-3 backdrop-blur lg:pl-[266px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <p className="text-sm text-texto">
              <strong>{resumo.selecionadas}</strong> selecionada(s) de {resumo.total}
              {resumo.comPendencia > 0 && (
                <span className="text-vermelho"> · {resumo.comPendencia} com pendência</span>
              )}
              {resumo.duplicadasNoBanco > 0 && (
                <span className="text-laranja"> · {resumo.duplicadasNoBanco} já no banco</span>
              )}
            </p>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => setItens((atual) => atual?.filter((i) => !i.selecionada) ?? null)}
                disabled={resumo.selecionadas === 0}
              >
                Excluir selecionadas
              </Button>
              <Button onClick={salvar} disabled={!resumo.podeSalvar || salvando}>
                {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Salvar no banco
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ entrada
  const ABAS = [
    { id: "arquivo" as const, emoji: "📄", rotulo: "Enviar arquivo" },
    { id: "texto" as const, emoji: "📝", rotulo: "Colar texto" },
    { id: "global" as const, emoji: "🌐", rotulo: "Banco global" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Importar perguntas</h1>
          <p className="mt-1 text-sm text-texto-suave">
            TXT, CSV, texto colado ou o banco global. Nada é salvo antes da revisão.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/painel/perguntas">
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-pressed={aba === a.id}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              aba === a.id ? "bg-superficie text-marinho shadow-sm" : "text-texto-suave"
            }`}
          >
            <span aria-hidden>{a.emoji}</span> {a.rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-superficie p-4">
        <Label htmlFor="tema-padrao">Tema padrão do lote</Label>
        <select
          id="tema-padrao"
          value={temaPadrao}
          onChange={(e) => setTemaPadrao(e.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Nenhum — usar só o tema que vier no arquivo</option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icone} {t.nome}
            </option>
          ))}
        </select>
        <p className="text-xs text-texto-suave">
          Vale para as perguntas que não trouxerem <code>Tema:</code>.
        </p>
      </div>

      {aba === "arquivo" && (
        <div className="rounded-2xl border border-dashed border-borda bg-superficie p-6 text-center">
          <FileText className="mx-auto size-8 text-texto-suave" aria-hidden />
          <p className="mt-3 text-sm text-texto">
            Escolha um arquivo TXT ou CSV (até {LIMITE_MB} MB).
          </p>
          <input
            type="file"
            accept=".txt,.csv,.pdf,text/plain,text/csv"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void lerArquivo(arquivo);
            }}
            className="mx-auto mt-4 block text-sm"
          />
          <button
            type="button"
            onClick={baixarModelo}
            className="mt-4 text-sm font-medium text-marinho underline-offset-4 hover:underline"
          >
            Baixar modelo CSV
          </button>
          <p className="mt-2 text-xs text-texto-suave">
            PDF ainda não é lido: cole o texto na outra aba.
          </p>
        </div>
      )}

      {aba === "texto" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
          <Label htmlFor="colar">Cole as perguntas</Label>
          <Textarea
            id="colar"
            rows={12}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              "Tema: nr35\nPergunta: ...\nA) ...\nB) ...\nCorreta: B\nExplicação: ...\nDificuldade: 1"
            }
            className="font-mono text-xs"
          />
          <Button
            onClick={() =>
              revisar(
                texto.includes(";") && !texto.includes("Pergunta:") ? lerCsv(texto) : lerTxt(texto),
              )
            }
            disabled={texto.trim().length === 0}
            className="self-start"
          >
            Revisar
          </Button>
        </div>
      )}

      {aba === "global" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
          <Globe className="size-6 text-texto-suave" aria-hidden />
          <p className="text-sm text-texto">
            {globais.length} pergunta(s) no banco global. Copiar traz uma cópia editável para a sua
            empresa.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tema-global">Filtrar por tema</Label>
            <select
              id="tema-global"
              value={temaGlobal}
              onChange={(e) => setTemaGlobal(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Todos os temas</option>
              {temas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icone} {t.nome}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={importarDoGlobal} disabled={globais.length === 0} className="self-start">
            Revisar seleção
          </Button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/perguntas/importar")({
  component: Importar,
});
