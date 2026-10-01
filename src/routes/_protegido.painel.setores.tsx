import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Download, Loader2, MapPin, Pencil, Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { usePerfil } from "@/hooks/usePerfil";

type Setor = { id: string; nome: string; cor: string | null; ativo: boolean };
/** `locais.setor_id` é `not null` no schema: todo local pertence a um setor. */
type Local = {
  id: string;
  setor_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

/** Paleta de gráficos de docs/TIME_10 §2, segura para daltonismo. */
const CORES = ["#0B3C5D", "#F5A300", "#2E86C1", "#C0392B", "#7F8C8D", "#16A085", "#8E44AD"];

function useSetoresCompletos() {
  return useQuery({
    queryKey: ["setores-completos"],
    queryFn: async (): Promise<Setor[]> => {
      const { data, error } = await supabase
        .from("setores")
        .select("id, nome, cor, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Setor[];
    },
  });
}

function useLocais() {
  return useQuery({
    queryKey: ["locais"],
    queryFn: async (): Promise<Local[]> => {
      const { data, error } = await supabase
        .from("locais")
        .select("id, setor_id, nome, descricao, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Local[];
    },
  });
}

/** Etiqueta 10×7 cm do local (docs/TIME_04 §7), para imprimir e colar na parede. */
function EtiquetaDoLocal({ local, aoFechar }: { local: Local; aoFechar: () => void }) {
  const etiqueta = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);

  const url =
    typeof window === "undefined"
      ? `/app/local/${local.id}`
      : `${window.location.origin}/app/local/${local.id}`;

  async function baixarPng() {
    if (!etiqueta.current) return;
    setGerando(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(etiqueta.current, { scale: 3, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `etiqueta-${local.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
      toast.success("Etiqueta baixada.");
    } catch {
      toast.error("Não foi possível gerar a etiqueta.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">Etiqueta do local</DialogTitle>
        </DialogHeader>

        {/* 10×7 cm a 96 dpi ≈ 378×265 px. Tamanho fixo: o html2canvas captura o
            que está na tela, e um layout responsivo sairia de outro tamanho. */}
        <div className="flex justify-center overflow-x-auto rounded-xl bg-muted p-4">
          <div
            ref={etiqueta}
            style={{ width: 378, height: 265 }}
            className="flex flex-col items-center justify-center gap-2 border-2 border-marinho bg-white p-4 text-center"
          >
            <div className="faixa-seguranca w-full" />
            <p className="font-display text-xl font-extrabold leading-tight text-marinho">
              {local.nome}
            </p>
            <QRCodeSVG value={url} size={110} level="M" />
            <p className="text-sm font-semibold text-texto">
              Viu um risco aqui? Escaneie e relate.
            </p>
            <p className="text-[10px] text-texto-suave">T.I.M.E. Seguro</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button onClick={baixarPng} disabled={gerando}>
            {gerando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            <Download className="size-4" aria-hidden />
            Baixar PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormSetor({
  setor,
  empresaId,
  aoFechar,
}: {
  setor: Setor | null;
  empresaId: string | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [cor, setCor] = useState(setor?.cor ?? CORES[0]!);
  const [ativo, setAtivo] = useState(setor?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (nome.trim().length < 2 || !empresaId) return;
    setSalvando(true);
    const linha = { nome: nome.trim(), cor, ativo };
    const { error } = setor
      ? await supabase.from("setores").update(linha).eq("id", setor.id)
      : await supabase.from("setores").insert({ ...linha, empresa_id: empresaId });
    setSalvando(false);

    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Já existe um setor com esse nome."
          : "Não foi possível salvar o setor.",
      );
      return;
    }
    toast.success(setor ? "Setor atualizado." : "Setor criado.");
    await queryClient.invalidateQueries({ queryKey: ["setores-completos"] });
    await queryClient.invalidateQueries({ queryKey: ["setores"] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {setor ? "Editar setor" : "Novo setor"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome-setor">Nome</Label>
            <Input id="nome-setor" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Cor nos gráficos e na TV</legend>
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-label={`Cor ${c}`}
                  aria-pressed={cor === c}
                  style={{ backgroundColor: c }}
                  className={`size-9 rounded-full ${cor === c ? "ring-2 ring-marinho ring-offset-2" : ""}`}
                />
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2">
            <span className="text-sm">Ativo</span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={nome.trim().length < 2 || salvando || !empresaId}>
            {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormLocal({
  local,
  setores,
  empresaId,
  aoFechar,
}: {
  local: Local | null;
  setores: Setor[];
  empresaId: string | null;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(local?.nome ?? "");
  const [setorId, setSetorId] = useState(local?.setor_id ?? setores[0]?.id ?? "");
  const [descricao, setDescricao] = useState(local?.descricao ?? "");
  const [ativo, setAtivo] = useState(local?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  const completo = nome.trim().length >= 2 && setorId !== "" && !!empresaId;

  async function salvar() {
    if (!completo) return;
    setSalvando(true);
    const linha = {
      nome: nome.trim(),
      setor_id: setorId,
      descricao: descricao.trim() || null,
      ativo,
    };
    const { error } = local
      ? await supabase.from("locais").update(linha).eq("id", local.id)
      : await supabase.from("locais").insert({ ...linha, empresa_id: empresaId });
    setSalvando(false);

    if (error) {
      toast.error("Não foi possível salvar o local.");
      return;
    }
    toast.success(local ? "Local atualizado." : "Local criado.");
    await queryClient.invalidateQueries({ queryKey: ["locais"] });
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-marinho">
            {local ? "Editar local" : "Novo local"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome-local">Nome</Label>
            <Input
              id="nome-local"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Prensa 03, Painel elétrico QGBT, Refeitório"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="setor-local">Setor</Label>
            <select
              id="setor-local"
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao-local">Descrição</Label>
            <Textarea
              id="descricao-local"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <label className="flex items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2">
            <span className="text-sm">Ativo</span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>
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

/** Setores e locais, com QR por local (docs/TIME_04 §7). */
function SetoresELocais() {
  const { data: perfil } = usePerfil();
  const { data: setores = [], isLoading } = useSetoresCompletos();
  const { data: locais = [] } = useLocais();

  const [editandoSetor, setEditandoSetor] = useState<Setor | "novo" | null>(null);
  const [editandoLocal, setEditandoLocal] = useState<Local | "novo" | null>(null);
  const [etiqueta, setEtiqueta] = useState<Local | null>(null);

  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "tecnico";
  const locaisDoSetor = (id: string) => locais.filter((l) => l.setor_id === id);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-marinho">Setores e Locais</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Cada local tem um QR Code: quem escaneia cai direto no relato daquele ponto.
          </p>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditandoLocal("novo")}
              disabled={setores.length === 0}
              title={setores.length === 0 ? "Crie um setor primeiro" : undefined}
            >
              <MapPin className="size-4" aria-hidden />
              Novo local
            </Button>
            <Button onClick={() => setEditandoSetor("novo")}>
              <Plus className="size-4" aria-hidden />
              Novo setor
            </Button>
          </div>
        )}
      </header>

      {isLoading && <p className="text-sm text-texto-suave">Carregando…</p>}

      {!isLoading && setores.length === 0 && (
        <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
          Nenhum setor ainda. A importação de colaboradores cria setores sozinha, pelo nome da
          coluna <code>setor</code> do CSV.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {setores.map((s) => (
          <li key={s.id} className="rounded-2xl border border-borda bg-superficie p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                style={{ backgroundColor: s.cor ?? "#7F8C8D" }}
                className="size-5 shrink-0 rounded-full"
                aria-hidden
              />
              <h2 className="flex-1 font-display text-lg font-bold text-texto">
                {s.nome}
                {!s.ativo && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-texto-suave">
                    inativo
                  </span>
                )}
              </h2>
              {podeEditar && (
                <Button size="sm" variant="ghost" onClick={() => setEditandoSetor(s)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
              )}
            </div>

            {locaisDoSetor(s.id).length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-borda pt-3">
                {locaisDoSetor(s.id).map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <MapPin className="size-4 shrink-0 text-texto-suave" aria-hidden />
                    <span className="flex-1 text-texto">
                      {l.nome}
                      {l.descricao && (
                        <span className="ml-2 text-xs text-texto-suave">{l.descricao}</span>
                      )}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setEtiqueta(l)}>
                      <QrCode className="size-4" aria-hidden />
                      Etiqueta
                    </Button>
                    {podeEditar && (
                      <Button size="sm" variant="ghost" onClick={() => setEditandoLocal(l)}>
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {editandoSetor && (
        <FormSetor
          setor={editandoSetor === "novo" ? null : editandoSetor}
          empresaId={perfil?.empresa.id ?? null}
          aoFechar={() => setEditandoSetor(null)}
        />
      )}
      {editandoLocal && (
        <FormLocal
          local={editandoLocal === "novo" ? null : editandoLocal}
          setores={setores}
          empresaId={perfil?.empresa.id ?? null}
          aoFechar={() => setEditandoLocal(null)}
        />
      )}
      {etiqueta && <EtiquetaDoLocal local={etiqueta} aoFechar={() => setEtiqueta(null)} />}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/setores")({
  component: SetoresELocais,
});
