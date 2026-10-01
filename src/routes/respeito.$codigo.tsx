import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Lock, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rpcPublica } from "@/lib/rpc";
import { mensagem } from "@/lib/mensagens";
import {
  AVISO_ANONIMATO,
  CANAIS_OFICIAIS,
  CATEGORIAS_DENUNCIA,
  MINIMO_DESCRICAO_DENUNCIA,
  NOTA_TECNICA,
  descricaoDenunciaValida,
  rotuloDoStatusDenuncia,
  type CategoriaDenuncia,
} from "@/lib/respeito";
import { formatarData } from "@/lib/datas";

type Empresa = { ok: true; nome: string } | { ok: false; motivo: string };
type Registro = { ok: true; protocolo: string; senha: string } | { ok: false; motivo: string };
type Mensagem = { autor: string; mensagem: string; em: string };
type Consulta =
  | { ok: true; status: string; recebida_em: string; mensagens: Mensagem[] }
  | { ok: false; motivo: string };

/**
 * Canal de Respeito — página PÚBLICA e ANÔNIMA (docs/TIME_03 §6).
 *
 * O que esta tela deliberadamente NÃO faz:
 * - não usa `rpcApp`, só `rpcPublica`: nenhuma chamada leva `p_token`;
 * - não lê nem grava `localStorage` nem `sessionStorage`;
 * - não usa o layout do app, nem o PWA, nem registra acesso;
 * - não chama analytics.
 *
 * Está fora do layout do app de propósito: o botão discreto no app abre esta
 * URL numa navegação limpa, sem carregar nada da sessão.
 */
function CanalDeRespeito() {
  const { codigo } = Route.useParams();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [aba, setAba] = useState<"denunciar" | "acompanhar">("denunciar");

  useEffect(() => {
    rpcPublica<Empresa>("empresa_publica", { p_codigo: codigo })
      .then(setEmpresa)
      .catch(() => setEmpresa({ ok: false, motivo: "empresa_nao_encontrada" }));
  }, [codigo]);

  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-respeito px-5 py-6 text-white">
        <div className="mx-auto flex max-w-xl flex-col gap-1">
          <p className="flex items-center gap-2 font-display text-xl font-extrabold">
            <ShieldCheck className="size-6" aria-hidden />
            Canal de Respeito
          </p>
          <p className="text-sm text-white/85">
            {empresa?.ok ? empresa.nome : "Prevenção e combate ao assédio"}
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
        <div className="rounded-2xl border border-respeito/30 bg-respeito/5 p-4">
          <p className="flex items-start gap-2 text-sm text-texto">
            <Lock className="mt-0.5 size-4 shrink-0 text-respeito" aria-hidden />
            {AVISO_ANONIMATO}
          </p>
        </div>

        {empresa && !empresa.ok && (
          <p className="rounded-2xl bg-superficie p-5 text-sm text-texto">
            {mensagem(empresa.motivo)}
          </p>
        )}

        {empresa?.ok && (
          <>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  { id: "denunciar" as const, rotulo: "Fazer uma denúncia" },
                  { id: "acompanhar" as const, rotulo: "Acompanhar" },
                ] satisfies { id: "denunciar" | "acompanhar"; rotulo: string }[]
              ).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAba(a.id)}
                  aria-pressed={aba === a.id}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    aba === a.id ? "bg-superficie text-respeito shadow-sm" : "text-texto-suave"
                  }`}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>

            {aba === "denunciar" ? <Formulario codigo={codigo} /> : <Acompanhar />}
          </>
        )}

        <section className="rounded-2xl bg-superficie p-5">
          <h2 className="font-display text-base font-bold text-texto">
            Este canal não substitui os canais oficiais
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {CANAIS_OFICIAIS.map((c) => (
              <li key={c.numero} className="flex items-center gap-2 text-sm text-texto">
                <Phone className="size-4 shrink-0 text-respeito" aria-hidden />
                <strong className="font-display text-base">{c.numero}</strong> — {c.nome}
              </li>
            ))}
          </ul>
        </section>

        <p className="pb-6 text-xs leading-relaxed text-texto-suave">{NOTA_TECNICA}</p>
      </main>
    </div>
  );
}

function Formulario({ codigo }: { codigo: string }) {
  const [categoria, setCategoria] = useState<CategoriaDenuncia | null>(null);
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [querRetorno, setQuerRetorno] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<{ protocolo: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function enviar() {
    if (!categoria || !descricaoDenunciaValida(descricao)) return;
    setEnviando(true);
    setErro(null);
    try {
      // rpcPublica: NUNCA envia token (docs/TIME_03 §6).
      const r = await rpcPublica<Registro>("registrar_denuncia_assedio", {
        p_empresa_codigo: codigo,
        p_categoria: categoria,
        p_descricao: descricao.trim(),
        ...(local.trim() ? { p_local: local.trim() } : {}),
        ...(periodo.trim() ? { p_periodo: periodo.trim() } : {}),
        p_quer_retorno: querRetorno,
      });
      if (!r.ok) {
        setErro(mensagem(r.motivo));
        return;
      }
      setRecibo({ protocolo: r.protocolo, senha: r.senha });
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  async function copiar() {
    if (!recibo) return;
    try {
      await navigator.clipboard.writeText(`Protocolo: ${recibo.protocolo}\nSenha: ${recibo.senha}`);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  // O protocolo e a senha aparecem UMA vez (docs/TIME_03 §6).
  if (recibo) {
    return (
      <section className="rounded-2xl border-2 border-respeito bg-superficie p-5">
        <p className="font-display text-lg font-bold text-respeito">Denúncia registrada</p>
        <p className="mt-2 text-sm font-semibold text-texto">
          Anote. Sem eles não é possível acompanhar a denúncia.
        </p>

        <dl className="mt-4 flex flex-col gap-2">
          <div className="rounded-xl bg-fundo p-3">
            <dt className="text-xs uppercase tracking-wide text-texto-suave">Protocolo</dt>
            <dd className="font-mono text-lg font-bold text-texto">{recibo.protocolo}</dd>
          </div>
          <div className="rounded-xl bg-fundo p-3">
            <dt className="text-xs uppercase tracking-wide text-texto-suave">Senha</dt>
            <dd className="font-mono text-lg font-bold text-texto">{recibo.senha}</dd>
          </div>
        </dl>

        <Button onClick={copiar} className="mt-4 min-h-12 w-full bg-respeito hover:bg-respeito/90">
          {copiado ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copiado ? "Copiado" : "Copiar protocolo e senha"}
        </Button>
      </section>
    );
  }

  const faltam = MINIMO_DESCRICAO_DENUNCIA - descricao.trim().length;

  return (
    <section className="flex flex-col gap-4">
      <fieldset className="rounded-2xl bg-superficie p-5">
        <legend className="sr-only">Que tipo de situação?</legend>
        <p className="font-display text-base font-bold text-texto">Que tipo de situação?</p>
        <div className="mt-3 flex flex-col gap-2">
          {CATEGORIAS_DENUNCIA.map((c) => (
            <button
              key={c.categoria}
              type="button"
              onClick={() => setCategoria(c.categoria)}
              aria-pressed={categoria === c.categoria}
              className={`min-h-14 rounded-xl border-2 p-3 text-left transition-colors ${
                categoria === c.categoria
                  ? "border-respeito bg-respeito/5"
                  : "border-borda bg-superficie"
              }`}
            >
              <span className="block font-semibold text-texto">{c.rotulo}</span>
              <span className="block text-sm text-texto-suave">{c.ajuda}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5 rounded-2xl bg-superficie p-5">
        <Label htmlFor="relato">O que aconteceu?</Label>
        <Textarea
          id="relato"
          rows={6}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Conte com suas palavras. Você não precisa dizer quem você é."
          className="text-base"
        />
        <p className={`text-xs ${faltam > 0 ? "text-laranja" : "text-texto-suave"}`}>
          {faltam > 0 ? `Escreva mais ${faltam} letra(s).` : `${descricao.trim().length} letras.`}
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl bg-superficie p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="local">Onde, mais ou menos?</Label>
          <Input
            id="local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodo">Quando, mais ou menos?</Label>
          <Input
            id="periodo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-superficie p-5 text-sm text-texto">
        <input
          type="checkbox"
          checked={querRetorno}
          onChange={(e) => setQuerRetorno(e.target.checked)}
          className="mt-0.5 size-5 shrink-0"
        />
        <span>
          Quero acompanhar e receber resposta do comitê.
          <span className="mt-0.5 block text-texto-suave">
            Você recebe um protocolo e uma senha para voltar aqui. Continua anônimo.
          </span>
        </span>
      </label>

      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-vermelho/10 p-4 text-sm font-medium text-vermelho"
        >
          {erro}
        </p>
      )}

      <Button
        onClick={enviar}
        disabled={!categoria || !descricaoDenunciaValida(descricao) || enviando}
        className="min-h-14 bg-respeito text-base font-bold hover:bg-respeito/90"
      >
        {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Enviar denúncia
      </Button>
    </section>
  );
}

function Acompanhar() {
  const [protocolo, setProtocolo] = useState("");
  const [senha, setSenha] = useState("");
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [resposta, setResposta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await rpcPublica<Consulta>("consultar_denuncia", {
        p_protocolo: protocolo.trim(),
        p_senha: senha.trim(),
      });
      setConsulta(r);
      if (!r.ok) setErro(mensagem(r.motivo));
    } catch {
      setErro("Não foi possível consultar agora. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function responder() {
    if (!resposta.trim()) return;
    setCarregando(true);
    try {
      const r = await rpcPublica<{ ok: boolean; motivo?: string }>(
        "responder_denuncia_denunciante",
        {
          p_protocolo: protocolo.trim(),
          p_senha: senha.trim(),
          p_mensagem: resposta.trim(),
        },
      );
      if (!r.ok) {
        setErro(mensagem(r.motivo));
        return;
      }
      setResposta("");
      await consultar();
    } catch {
      setErro("Não foi possível enviar a mensagem.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-superficie p-5">
        <p className="font-display text-base font-bold text-texto">Acompanhar denúncia</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="protocolo">Protocolo</Label>
          <Input
            id="protocolo"
            value={protocolo}
            onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
            placeholder="RS-XXXXXXXX"
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="senha-denuncia">Senha</Label>
          <Input
            id="senha-denuncia"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="font-mono"
          />
        </div>
        <Button
          onClick={consultar}
          disabled={!protocolo.trim() || !senha.trim() || carregando}
          className="min-h-12 bg-respeito hover:bg-respeito/90"
        >
          {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Consultar
        </Button>
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-2xl bg-vermelho/10 p-4 text-sm font-medium text-vermelho"
        >
          {erro}
        </p>
      )}

      {consulta?.ok && (
        <div className="flex flex-col gap-4 rounded-2xl bg-superficie p-5">
          <p className="text-sm text-texto-suave">
            Recebida em {formatarData(consulta.recebida_em)} ·{" "}
            <strong className="text-texto">{rotuloDoStatusDenuncia(consulta.status)}</strong>
          </p>

          {consulta.mensagens.length === 0 ? (
            <p className="text-sm text-texto-suave">
              O comitê ainda não respondeu. Volte depois com o mesmo protocolo.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {consulta.mensagens.map((m, i) => (
                <li
                  key={i}
                  className={`rounded-xl p-3 text-sm ${
                    m.autor === "comite" ? "bg-respeito/10" : "bg-fundo"
                  }`}
                >
                  <p className="text-xs font-semibold text-texto-suave">
                    {m.autor === "comite" ? "Comitê" : "Você"} · {formatarData(m.em)}
                  </p>
                  <p className="mt-1 text-texto">{m.mensagem}</p>
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nova-mensagem">Responder ao comitê</Label>
            <Textarea
              id="nova-mensagem"
              rows={3}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />
            <Button
              onClick={responder}
              disabled={!resposta.trim() || carregando}
              className="min-h-12 self-start bg-respeito hover:bg-respeito/90"
            >
              Enviar mensagem
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export const Route = createFileRoute("/respeito/$codigo")({
  component: CanalDeRespeito,
});
