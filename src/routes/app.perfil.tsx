import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, FileText, KeyRound, LogOut, ScrollText } from "lucide-react";
import { AlunoLayout } from "@/components/layout/AlunoLayout";
import { Button } from "@/components/ui/button";
import { rpcApp } from "@/lib/rpc";
import { sessao } from "@/lib/sessao";
import { mensagem } from "@/lib/mensagens";
import {
  EMOJI_DO_PILAR,
  ROTULO_DO_PILAR,
  agruparExtratoPorDia,
  ordenarSelos,
  somarPorPilar,
  textoDaOrigem,
  type LinhaExtrato,
  type Selo,
} from "@/lib/pontuacao";
import { formatarData } from "@/lib/datas";

type Certificado = {
  id: string;
  tipo: string;
  titulo: string;
  codigo: string;
  emitido_em: string;
  carga_minutos: number | null;
  campanha: string | null;
};

type Perfil =
  | {
      ok: true;
      nome: string;
      matricula: string;
      selos: Selo[];
      extrato: LinhaExtrato[];
      certificados: Certificado[];
    }
  | { ok: false; motivo: string };

/** Perfil do colaborador: selos, extrato e certificados (docs/TIME_05 §8). */
function PerfilColaborador() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [verTudo, setVerTudo] = useState(false);

  useEffect(() => {
    if (!sessao.token()) {
      void navigate({ to: "/app/entrar", replace: true });
      return;
    }
    rpcApp<Perfil>("colaborador_perfil")
      .then(setPerfil)
      .catch(() => setErro(mensagem("erro_interno")));
  }, [navigate]);

  async function sair() {
    setSaindo(true);
    try {
      // Revoga no servidor; se falhar, limpa local de qualquer forma.
      await rpcApp("colaborador_logout").catch(() => undefined);
    } finally {
      sessao.sair();
      await navigate({ to: "/app/entrar", replace: true });
    }
  }

  if (erro) {
    return (
      <AlunoLayout comNavegacao>
        <p role="alert" className="rounded-2xl bg-superficie p-6 text-sm text-vermelho shadow-sm">
          {erro}
        </p>
      </AlunoLayout>
    );
  }

  if (!perfil) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-sm text-texto-suave shadow-sm">
          Carregando…
        </p>
      </AlunoLayout>
    );
  }

  if (!perfil.ok) {
    return (
      <AlunoLayout comNavegacao>
        <p className="rounded-2xl bg-superficie p-6 text-center text-sm text-texto shadow-sm">
          {mensagem(perfil.motivo)}
        </p>
      </AlunoLayout>
    );
  }

  const selos = ordenarSelos(perfil.selos);
  const conquistados = selos.filter((s) => s.conquistado).length;
  const porPilar = somarPorPilar(perfil.extrato);
  const total = porPilar.conhecimento + porPilar.relatos + porPilar.engajamento;
  const dias = agruparExtratoPorDia(perfil.extrato);
  const diasMostrados = verTudo ? dias : dias.slice(0, 5);

  return (
    <AlunoLayout comNavegacao>
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl bg-superficie p-5 shadow-sm">
          <p className="font-display text-xl font-extrabold text-marinho">{perfil.nome}</p>
          <p className="text-sm text-texto-suave">Matrícula {perfil.matricula}</p>

          <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-marinho">
            {total.toLocaleString("pt-BR")}
            <span className="ml-1 text-base font-bold text-texto-suave">pts na campanha</span>
          </p>

          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-suave">
            {(["conhecimento", "relatos", "engajamento"] as const).map((p) => (
              <li key={p}>
                {EMOJI_DO_PILAR[p]} {ROTULO_DO_PILAR[p]}:{" "}
                <strong className="tabular-nums text-texto">{porPilar[p]}</strong>
              </li>
            ))}
          </ul>
        </div>

        <section className="rounded-3xl bg-superficie p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-marinho">
            <Award className="size-5" aria-hidden />
            Selos
            <span className="ml-auto text-sm font-normal text-texto-suave">
              {conquistados} de {selos.length}
            </span>
          </h2>

          <ul className="mt-3 grid grid-cols-4 gap-3">
            {selos.map((s) => (
              <li key={s.slug} className="flex flex-col items-center gap-1 text-center">
                <span
                  title={s.descricao}
                  className={`flex size-14 items-center justify-center rounded-full text-2xl ${
                    s.conquistado ? "bg-amarelo/25" : "bg-muted opacity-40 grayscale"
                  }`}
                >
                  {s.icone}
                </span>
                <span
                  className={`text-[11px] leading-tight ${s.conquistado ? "font-semibold text-texto" : "text-texto-suave"}`}
                >
                  {s.nome}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-texto-suave">
            Toque e segure um selo para ver como conquistá-lo.
          </p>
        </section>

        <section className="rounded-3xl bg-superficie p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-marinho">
            <ScrollText className="size-5" aria-hidden />
            Extrato de pontos
          </h2>

          {dias.length === 0 && (
            <p className="mt-2 text-sm text-texto-suave">
              Nenhum ponto ainda. Comece pelo quiz do dia.
            </p>
          )}

          <ol className="mt-3 flex flex-col gap-4">
            {diasMostrados.map((g) => (
              <li key={g.dia}>
                <p className="flex items-baseline justify-between text-sm font-semibold text-texto">
                  <span>{formatarData(g.dia)}</span>
                  <span className="tabular-nums text-verde">+{g.total}</span>
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {g.linhas.map((l, i) => (
                    <li
                      key={i}
                      className="flex items-baseline justify-between gap-2 text-sm text-texto-suave"
                    >
                      <span>
                        {EMOJI_DO_PILAR[l.pilar]} {textoDaOrigem(l.origem)}
                      </span>
                      <span className="shrink-0 tabular-nums">+{l.pontos}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          {dias.length > 5 && (
            <button
              type="button"
              onClick={() => setVerTudo((v) => !v)}
              className="mt-3 text-sm font-medium text-marinho underline-offset-4 hover:underline"
            >
              {verTudo ? "Mostrar menos" : `Ver todos os ${dias.length} dias`}
            </button>
          )}
        </section>

        <section className="rounded-3xl bg-superficie p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-marinho">
            <FileText className="size-5" aria-hidden />
            Certificados
          </h2>

          {perfil.certificados.length === 0 ? (
            <p className="mt-2 text-sm text-texto-suave">
              Os certificados são emitidos quando a campanha é encerrada.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {perfil.certificados.map((c) => (
                <li key={c.id} className="rounded-xl border border-borda p-3">
                  <p className="font-medium text-texto">{c.titulo}</p>
                  <p className="mt-0.5 text-xs text-texto-suave">
                    {c.campanha} · {formatarData(c.emitido_em)}
                    {c.carga_minutos ? ` · ${c.carga_minutos} min` : ""}
                  </p>
                  <p className="mt-1 font-mono text-xs text-marinho">{c.codigo}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <Button variant="outline" asChild className="min-h-12 justify-start">
            <Link to="/app/novo-pin">
              <KeyRound className="size-4" aria-hidden />
              Trocar meu PIN
            </Link>
          </Button>
          <Button variant="outline" asChild className="min-h-12 justify-start">
            <Link to="/app/termo">
              <ScrollText className="size-4" aria-hidden />
              Ver o termo de uso dos dados
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={sair}
            disabled={saindo}
            className="min-h-12 justify-start text-vermelho"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </Button>
        </div>

        {/*
          Canal de Respeito: link discreto que abre a página pública SEM token
          (docs/TIME_03 §6). A rota entra no item 6.
        */}
        <a
          href={`/respeito/${sessao.empresa() ?? ""}`}
          className="mt-6 text-center text-sm font-medium text-respeito underline-offset-4 hover:underline"
        >
          💜 Canal de Respeito
        </a>
      </div>
    </AlunoLayout>
  );
}

export const Route = createFileRoute("/app/perfil")({
  component: PerfilColaborador,
});
