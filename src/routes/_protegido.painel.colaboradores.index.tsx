import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  KeyRound,
  Loader2,
  LockOpen,
  Pencil,
  Plus,
  Search,
  Upload,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePerfil } from "@/hooks/usePerfil";
import {
  MODELO_CSV_COLABORADORES,
  ROTULO_DO_TURNO,
  TURNOS,
  lerCsvColaboradores,
  paraImportar,
  rotuloDoTurno,
  type CartaoDeAcesso,
  type LinhaColaborador,
} from "@/lib/colaboradores";
import { guardarCartoes } from "@/lib/cartoes-pendentes";
import { formatarHora } from "@/lib/datas";

type Colaborador = {
  id: string;
  matricula: string;
  nome: string;
  turno: string | null;
  setor_id: string | null;
  ativo: boolean;
  anonimizado: boolean;
  bloqueado_ate: string | null;
  pin_provisorio: boolean;
};

type Setor = { id: string; nome: string };

function useColaboradores() {
  return useQuery({
    queryKey: ["colaboradores"],
    queryFn: async (): Promise<Colaborador[]> => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select(
          "id, matricula, nome, turno, setor_id, ativo, anonimizado, bloqueado_ate, pin_provisorio",
        )
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });
}

function useSetores() {
  return useQuery({
    queryKey: ["setores"],
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase.from("setores").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as Setor[];
    },
  });
}

/** Bloqueio por PIN errado é temporário (docs/TIME_03 §3): 15 min. */
function estaBloqueado(ate: string | null): boolean {
  return ate !== null && new Date(ate).getTime() > Date.now();
}

function FormColaborador({
  colaborador,
  setores,
  empresaId,
  aoFechar,
}: {
  colaborador: Colaborador | null;
  setores: Setor[];
  empresaId: string | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [matricula, setMatricula] = useState(colaborador?.matricula ?? "");
  const [nome, setNome] = useState(colaborador?.nome ?? "");
  const [setorId, setSetorId] = useState(colaborador?.setor_id ?? "");
  const [turno, setTurno] = useState(colaborador?.turno ?? "");
  const [ativo, setAtivo] = useState(colaborador?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  const completo = matricula.trim() !== "" && nome.trim().length >= 2 && !!empresaId;

  async function salvar() {
    if (!completo) return;
    setSalvando(true);
    // `grant update` cobre só setor_id, nome, turno e ativo: matrícula não muda
    // depois de criada (docs/TIME_03 §5). O formulário respeita isso.
    const { error } = colaborador
      ? await supabase
          .from("colaboradores")
          .update({ nome: nome.trim(), setor_id: setorId || null, turno: turno || null, ativo })
          .eq("id", colaborador.id)
      : await supabase.from("colaboradores").insert({
          empresa_id: empresaId!,
          matricula: matricula.trim(),
          nome: nome.trim(),
          setor_id: setorId || null,
          turno: turno || null,
        });
    setSalvando(false);

    if (error) {
      toast.error(
        error.message.includes("duplicate") || error.code === "23505"
          ? "Já existe um colaborador com essa matrícula."
          : "Não foi possível salvar.",
      );
      return;
    }
    toast.success(
      colaborador ? "Colaborador atualizado." : "Colaborador criado. Gere o PIN para ele acessar.",
    );
    await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {colaborador ? "Editar colaborador" : "Novo colaborador"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="matricula">Matrícula</Label>
            <Input
              id="matricula"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              disabled={colaborador !== null}
            />
            {colaborador && (
              <p className="text-xs text-texto-suave">
                A matrícula não muda: é por ela que o colaborador entra no app.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome-colab">Nome</Label>
            <Input id="nome-colab" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setor-colab">Setor</Label>
            <select
              id="setor-colab"
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Sem setor</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turno-colab">Turno</Label>
            <select
              id="turno-colab"
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Sem turno</option>
              {TURNOS.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_DO_TURNO[t]}
                </option>
              ))}
            </select>
          </div>

          {colaborador && (
            <label className="flex items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2">
              <span className="text-sm">
                Ativo
                <span className="block text-xs text-texto-suave">
                  Inativo não entra no app nem aparece no ranking.
                </span>
              </span>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={!completo || salvando}>
            {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarCsv({ aoFechar }: { aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<LinhaColaborador[] | null>(null);
  const [enviando, setEnviando] = useState(false);

  const prontas = linhas ? paraImportar(linhas) : [];
  const comErro = linhas?.filter((l) => l.erros.length > 0) ?? [];

  async function escolher(arquivo: File) {
    setLinhas(lerCsvColaboradores(await arquivo.text()));
  }

  function baixarModelo() {
    const url = URL.createObjectURL(
      new Blob([MODELO_CSV_COLABORADORES], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-colaboradores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importar() {
    if (prontas.length === 0) return;
    setEnviando(true);
    const { data, error } = await supabase.rpc("tecnico_importar_colaboradores", {
      p_linhas: prontas,
    });
    setEnviando(false);

    if (error) {
      toast.error("A importação falhou. Nada foi gravado.");
      return;
    }
    const r = data as unknown as {
      novos: string[];
      atualizados: number;
      erros: { linha: number; erro: string }[];
    };
    toast.success(
      `${r.novos.length} novo(s), ${r.atualizados} atualizado(s).` +
        (r.erros.length > 0 ? ` ${r.erros.length} recusado(s) pelo servidor.` : ""),
    );
    await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    await queryClient.invalidateQueries({ queryKey: ["setores"] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">Importar colaboradores</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-texto-suave">
            Arquivo CSV com as colunas <code>matricula;nome;setor;turno</code>. Setor que não existe
            é criado na hora. Matrícula que já existe é atualizada, não duplicada.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={baixarModelo}>
              <Download className="size-4" aria-hidden />
              Baixar modelo
            </Button>
            <Button variant="outline" onClick={() => entrada.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Escolher arquivo
            </Button>
            <input
              ref={entrada}
              type="file"
              accept=".csv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) void escolher(arquivo);
              }}
            />
          </div>

          {linhas !== null && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-texto">
                {prontas.length} pronta(s) para importar
                {comErro.length > 0 && `, ${comErro.length} com problema`}
              </p>

              {comErro.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-xl border border-vermelho/40 bg-vermelho/5 p-3 text-sm">
                  {comErro.map((l) => (
                    <li key={l.linha} className="text-vermelho">
                      Linha {l.linha}: {l.erros.join(" ")}
                    </li>
                  ))}
                </ul>
              )}

              {prontas.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-borda">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th className="px-3 py-2">Matrícula</th>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Setor</th>
                        <th className="px-3 py-2">Turno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prontas.map((p) => (
                        <tr key={p.matricula} className="border-t border-borda">
                          <td className="px-3 py-1.5">{p.matricula}</td>
                          <td className="px-3 py-1.5">{p.nome}</td>
                          <td className="px-3 py-1.5">{p.setor || "—"}</td>
                          <td className="px-3 py-1.5">{rotuloDoTurno(p.turno || null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={prontas.length === 0 || enviando}>
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Importar {prontas.length > 0 && prontas.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Cadastro de colaboradores: lista, importação e geração de PIN (docs/TIME_04 §6). */
function Colaboradores() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: perfil } = usePerfil();
  const { data: colaboradores = [], isLoading } = useColaboradores();
  const { data: setores = [] } = useSetores();

  const [busca, setBusca] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [verInativos, setVerInativos] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<Colaborador | "novo" | null>(null);
  const [importando, setImportando] = useState(false);
  const [anonimizar, setAnonimizar] = useState<Colaborador | null>(null);
  const [gerando, setGerando] = useState(false);

  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "tecnico";
  const nomeDoSetor = useMemo(() => new Map(setores.map((s) => [s.id, s.nome])), [setores]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return colaboradores.filter((c) => {
      if (!verInativos && !c.ativo) return false;
      if (setorFiltro && c.setor_id !== setorFiltro) return false;
      if (!termo) return true;
      return c.nome.toLowerCase().includes(termo) || c.matricula.toLowerCase().includes(termo);
    });
  }, [colaboradores, busca, setorFiltro, verInativos]);

  /** Só faz sentido gerar PIN de quem está ativo — a RPC ignora os demais. */
  const marcaveis = visiveis.filter((c) => c.ativo && !c.anonimizado);
  const todosMarcados = marcaveis.length > 0 && marcaveis.every((c) => marcados.has(c.id));

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setMarcados(todosMarcados ? new Set() : new Set(marcaveis.map((c) => c.id)));
  }

  async function gerarPins() {
    if (marcados.size === 0) return;
    setGerando(true);
    const { data, error } = await supabase.rpc("tecnico_gerar_pins", {
      p_colaboradores: [...marcados],
    });
    setGerando(false);

    if (error || !data) {
      toast.error("Não foi possível gerar os PINs.");
      return;
    }
    const cartoes = data as unknown as CartaoDeAcesso[];
    if (cartoes.length === 0) {
      toast.error("Nenhum colaborador ativo na seleção.");
      return;
    }
    // O PIN puro existe só nesta resposta: a página de impressão o recebe em
    // memória e o banco guarda apenas o hash.
    guardarCartoes(cartoes);
    setMarcados(new Set());
    await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
    void navigate({ to: "/painel/colaboradores/cartoes" });
  }

  async function desbloquear(c: Colaborador) {
    const { error } = await supabase.rpc("tecnico_desbloquear_colaborador", {
      p_colaborador: c.id,
    });
    if (error) {
      toast.error("Não foi possível desbloquear.");
      return;
    }
    toast.success(`${c.nome} pode tentar o PIN de novo.`);
    await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
  }

  async function confirmarAnonimizacao() {
    if (!anonimizar) return;
    const { error } = await supabase.rpc("tecnico_anonimizar_colaborador", {
      p_colaborador: anonimizar.id,
    });
    setAnonimizar(null);
    if (error) {
      toast.error("Não foi possível anonimizar. Só o admin pode fazer isso.");
      return;
    }
    toast.success("Identificação removida. Os pontos e relatos continuam no histórico.");
    await queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Colaboradores</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {colaboradores.filter((c) => c.ativo).length} ativo(s). O PIN aparece uma única vez, na
            hora de gerar os cartões.
          </p>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportando(true)}>
              <Upload className="size-4" aria-hidden />
              Importar CSV
            </Button>
            <Button onClick={() => setEditando("novo")}>
              <Plus className="size-4" aria-hidden />
              Novo
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-borda bg-superficie p-3">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-suave"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou matrícula"
            aria-label="Buscar colaborador"
            className="pl-9"
          />
        </div>

        <select
          value={setorFiltro}
          onChange={(e) => setSetorFiltro(e.target.value)}
          aria-label="Filtrar por setor"
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos os setores</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={verInativos} onCheckedChange={setVerInativos} />
          Mostrar inativos
        </label>

        {podeEditar && (
          <Button onClick={gerarPins} disabled={marcados.size === 0 || gerando}>
            {gerando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="size-4" aria-hidden />
            )}
            Gerar PIN {marcados.size > 0 && `(${marcados.size})`}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-texto-suave">Carregando…</p>}

      {!isLoading && visiveis.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          {colaboradores.length === 0
            ? "Nenhum colaborador ainda. Importe a lista em CSV para começar."
            : "Nenhum colaborador com esse filtro."}
        </p>
      )}

      {visiveis.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={todosMarcados}
                    onCheckedChange={alternarTodos}
                    disabled={marcaveis.length === 0}
                    aria-label="Marcar todos"
                  />
                </th>
                <th className="px-3 py-2">Matrícula</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Setor</th>
                <th className="px-3 py-2">Turno</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id} className="border-t border-borda">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={marcados.has(c.id)}
                      onCheckedChange={() => alternar(c.id)}
                      disabled={!c.ativo || c.anonimizado}
                      aria-label={`Marcar ${c.nome}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.matricula}</td>
                  <td className="px-3 py-2 font-medium text-texto">{c.nome}</td>
                  <td className="px-3 py-2">
                    {c.setor_id ? (nomeDoSetor.get(c.setor_id) ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2">{rotuloDoTurno(c.turno)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!c.ativo && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-texto-suave">
                          inativo
                        </span>
                      )}
                      {estaBloqueado(c.bloqueado_ate) && (
                        <span className="rounded-full bg-vermelho/10 px-2 py-0.5 text-xs font-semibold text-vermelho">
                          bloqueado até {formatarHora(c.bloqueado_ate!)}
                        </span>
                      )}
                      {c.ativo && c.pin_provisorio && (
                        <span className="rounded-full bg-amarelo/20 px-2 py-0.5 text-xs font-semibold text-marinho">
                          PIN provisório
                        </span>
                      )}
                      {c.ativo && !c.pin_provisorio && !estaBloqueado(c.bloqueado_ate) && (
                        <span className="text-xs text-texto-suave">em uso</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {podeEditar && estaBloqueado(c.bloqueado_ate) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void desbloquear(c)}
                          title="Desbloquear"
                        >
                          <LockOpen className="size-4" aria-hidden />
                        </Button>
                      )}
                      {podeEditar && !c.anonimizado && (
                        <Button size="sm" variant="ghost" onClick={() => setEditando(c)}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                      )}
                      {perfil?.papel === "admin" && !c.anonimizado && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAnonimizar(c)}
                          title="Anonimizar (LGPD)"
                        >
                          <UserX className="size-4 text-vermelho" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormColaborador
          colaborador={editando === "novo" ? null : editando}
          setores={setores}
          empresaId={perfil?.empresa.id ?? null}
          aoFechar={() => setEditando(null)}
        />
      )}
      {importando && <ImportarCsv aoFechar={() => setImportando(false)} />}

      <AlertDialog open={anonimizar !== null} onOpenChange={(a) => !a && setAnonimizar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anonimizar {anonimizar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              O nome e a matrícula são apagados e o acesso ao app é encerrado. Os relatos e os
              pontos continuam no histórico, sem ligação com a pessoa. Não tem volta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmarAnonimizacao()}>
              Anonimizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/colaboradores/")({
  component: Colaboradores,
});
