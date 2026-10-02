import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePerfil } from "@/hooks/usePerfil";
import { formatarData } from "@/lib/datas";
import { dominiosDaConfig, normalizarDominios } from "@/lib/cadastro";

type Empresa = {
  id: string;
  nome: string;
  codigo: string;
  logo_url: string | null;
  termo_lgpd_versao: number;
  termo_lgpd_texto: string;
  /** JSON livre da empresa; aqui so `dominios_email` interessa. */
  config: unknown;
};

type UsuarioDoPainel = {
  nome: string;
  papel: string;
  comite_assedio: boolean;
  criado_em: string;
};

/** Limite do logo: 1 MB já é folgado para um PNG de cabeçalho. */
const LIMITE_LOGO = 1024 * 1024;
const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

const ROTULO_DO_PAPEL: Record<string, string> = {
  admin: "Administrador",
  tecnico: "Técnico de SST",
  cipa: "CIPA",
};

function useEmpresa() {
  return useQuery({
    queryKey: ["empresa"],
    queryFn: async (): Promise<Empresa | null> => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo, logo_url, termo_lgpd_versao, termo_lgpd_texto, config")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Empresa | null;
    },
  });
}

function useUsuariosDoPainel() {
  return useQuery({
    queryKey: ["usuarios-painel"],
    queryFn: async (): Promise<UsuarioDoPainel[]> => {
      const { data, error } = await supabase
        .from("perfis_tecnicos")
        .select("nome, papel, comite_assedio, criado_em")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as UsuarioDoPainel[];
    },
  });
}

function DadosDaEmpresa({ empresa }: { empresa: Empresa }) {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState(empresa.nome);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);

  async function salvarNome() {
    if (nome.trim().length < 2) return;
    setSalvando(true);
    const { error } = await supabase
      .from("empresas")
      .update({ nome: nome.trim() })
      .eq("id", empresa.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar. Só o administrador altera a empresa.");
      return;
    }
    toast.success("Nome da empresa atualizado.");
    await queryClient.invalidateQueries({ queryKey: ["empresa"] });
    await queryClient.invalidateQueries({ queryKey: ["perfil"] });
  }

  async function enviarLogo(arquivo: File) {
    if (!TIPOS_LOGO.includes(arquivo.type)) {
      toast.error("Use um arquivo PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (arquivo.size > LIMITE_LOGO) {
      toast.error("O arquivo passa de 1 MB. Reduza a imagem e tente de novo.");
      return;
    }

    setEnviandoLogo(true);
    // Caminho dentro do bucket público `logos`: a pasta é o empresa_id, que é
    // o que a policy de Storage confere. Nome fixo para o upload substituir o
    // logo anterior em vez de acumular arquivos.
    const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "png";
    const caminho = `${empresa.id}/logo.${extensao}`;

    const { error: erroUpload } = await supabase.storage
      .from("logos")
      .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

    if (erroUpload) {
      setEnviandoLogo(false);
      toast.error("O envio do logo falhou.");
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(caminho);
    const { error } = await supabase
      .from("empresas")
      .update({ logo_url: data.publicUrl })
      .eq("id", empresa.id);
    setEnviandoLogo(false);

    if (error) {
      toast.error("O arquivo subiu, mas não deu para salvar o endereço dele.");
      return;
    }
    toast.success("Logo atualizado.");
    await queryClient.invalidateQueries({ queryKey: ["empresa"] });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="font-display text-lg font-bold text-marinho">Empresa</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nome-empresa">Nome</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="nome-empresa"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="min-w-48 flex-1"
          />
          <Button
            onClick={salvarNome}
            disabled={salvando || nome.trim() === empresa.nome || nome.trim().length < 2}
          >
            {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </div>
        <p className="text-xs text-texto-suave">
          É este nome que aparece no app, nos cartazes e nos certificados.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="codigo-empresa">Código</Label>
        <Input id="codigo-empresa" value={empresa.codigo} readOnly disabled />
        <p className="text-xs text-texto-suave">
          Não muda depois de criado: está nos QR Codes já impressos e no endereço público do Canal
          de Respeito.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Logo</Label>
        <div className="flex flex-wrap items-center gap-3">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={`Logo de ${empresa.nome}`}
              className="h-16 max-w-48 rounded-lg border border-borda bg-white object-contain p-1"
            />
          ) : (
            <span className="rounded-lg border border-dashed border-borda px-4 py-5 text-sm text-texto-suave">
              Sem logo
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => entrada.current?.click()}
            disabled={enviandoLogo}
          >
            {enviandoLogo ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ImageUp className="size-4" aria-hidden />
            )}
            {empresa.logo_url ? "Trocar logo" : "Enviar logo"}
          </Button>
          <input
            ref={entrada}
            type="file"
            accept={TIPOS_LOGO.join(",")}
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void enviarLogo(arquivo);
            }}
          />
        </div>
        <p className="text-xs text-texto-suave">
          PNG, JPG, WEBP ou SVG de até 1 MB. Fica em um endereço público — não use imagem com dado
          de pessoa.
        </p>
      </div>
    </section>
  );
}

/**
 * Domínios de e-mail aceitos no autocadastro (migration 0009).
 *
 * Sem nenhum domínio, o formulário público aceita qualquer e-mail — por isso o
 * aviso. A lista vai para `empresas.config.dominios_email`, preservando as
 * outras chaves do `config` (outros ajustes da empresa moram ali).
 */
function CadastroPorEmail({ empresa }: { empresa: Empresa }) {
  const queryClient = useQueryClient();
  const atuais = dominiosDaConfig(empresa.config);
  const [texto, setTexto] = useState(atuais.join(", "));
  const [salvando, setSalvando] = useState(false);

  // A consulta chega depois da primeira renderizacao.
  useEffect(() => setTexto(atuais.join(", ")), [atuais.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const { dominios, invalidos } = normalizarDominios(texto);
  const mudou = dominios.join(",") !== atuais.join(",");

  async function salvar() {
    if (invalidos.length > 0) return;
    setSalvando(true);
    const base =
      empresa.config && typeof empresa.config === "object" && !Array.isArray(empresa.config)
        ? (empresa.config as Record<string, unknown>)
        : {};
    const { error } = await supabase
      .from("empresas")
      .update({ config: { ...base, dominios_email: dominios } as never })
      .eq("id", empresa.id);
    setSalvando(false);

    if (error) {
      toast.error("Não foi possível salvar. Só o administrador altera a empresa.");
      return;
    }
    toast.success(
      dominios.length > 0
        ? "Domínios salvos. O cadastro só aceita e-mail deles."
        : "Domínios removidos. O cadastro aceita qualquer e-mail.",
    );
    await queryClient.invalidateQueries({ queryKey: ["empresa"] });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="font-display text-lg font-bold text-marinho">Cadastro pelo app</h2>
      <p className="text-sm text-texto-suave">
        O colaborador pede o próprio cadastro em <code>/app/cadastro</code> e fica pendente até
        alguém da SST, da CIPA ou o administrador aprovar. Informe o(s) domínio(s) do e-mail da
        empresa para aceitar só e-mail daqui.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dominios">Domínios aceitos</Label>
        <Input
          id="dominios"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="empresa.com.br, grupo.com.br"
        />
        {invalidos.length > 0 && (
          <p className="text-xs text-vermelho">
            Não parece um domínio: {invalidos.join(", ")}. Use só o que vem depois do @.
          </p>
        )}
        {dominios.length === 0 && invalidos.length === 0 && (
          <p className="text-xs text-texto-suave">
            ⚠️ Sem domínio, qualquer e-mail pode pedir cadastro. Todo pedido ainda passa por
            aprovação.
          </p>
        )}
      </div>

      <div>
        <Button onClick={salvar} disabled={!mudou || invalidos.length > 0 || salvando}>
          {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Salvar domínios
        </Button>
      </div>
    </section>
  );
}

function TermoLgpd({ empresa }: { empresa: Empresa }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState(empresa.termo_lgpd_texto);
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // O texto chega depois da primeira renderização (a consulta é assíncrona).
  useEffect(() => setTexto(empresa.termo_lgpd_texto), [empresa.termo_lgpd_texto]);

  const mudou = texto !== empresa.termo_lgpd_texto;

  async function gravar(novaVersao: boolean) {
    setSalvando(true);
    const { error } = await supabase
      .from("empresas")
      .update({
        termo_lgpd_texto: texto,
        ...(novaVersao ? { termo_lgpd_versao: empresa.termo_lgpd_versao + 1 } : {}),
      })
      .eq("id", empresa.id);
    setSalvando(false);
    setConfirmando(false);

    if (error) {
      toast.error("Não foi possível salvar o termo.");
      return;
    }
    toast.success(
      novaVersao
        ? `Versão ${empresa.termo_lgpd_versao + 1} publicada. Todos vão aceitar de novo.`
        : "Rascunho salvo. A versão em vigor não mudou.",
    );
    await queryClient.invalidateQueries({ queryKey: ["empresa"] });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-marinho">Termo LGPD</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-texto-suave">
          versão {empresa.termo_lgpd_versao} em vigor
        </span>
      </div>

      <p className="text-sm text-texto-suave">
        É este texto que o colaborador aceita no primeiro acesso. Linguagem simples: o que a empresa
        guarda, para que serve e a quem reclamar.
      </p>

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={14}
        aria-label="Texto do termo LGPD"
        className="font-mono text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void gravar(false)} disabled={!mudou || salvando}>
          {salvando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Salvar sem publicar
        </Button>
        <Button onClick={() => setConfirmando(true)} disabled={salvando}>
          <ShieldCheck className="size-4" aria-hidden />
          Publicar nova versão
        </Button>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Publicar a versão {empresa.termo_lgpd_versao + 1} do termo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todos os colaboradores terão que aceitar de novo no próximo acesso ao app — até
              aceitarem, nada funciona para eles. Faça isso quando o texto realmente mudar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void gravar(true)}>Publicar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function UsuariosDoPainel() {
  const { data: usuarios = [] } = useUsuariosDoPainel();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="font-display text-lg font-bold text-marinho">Usuários do painel</h2>
      <p className="text-sm text-texto-suave">
        Nesta versão, criar usuário e mudar papel é feito pelo Supabase, direto no banco. A tela
        mostra quem tem acesso hoje para você conferir.
      </p>

      <div className="overflow-x-auto rounded-xl border border-borda">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2">Canal de Respeito</th>
              <th className="px-3 py-2">Desde</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={`${u.nome}-${u.criado_em}`} className="border-t border-borda">
                <td className="px-3 py-2 font-medium text-texto">{u.nome}</td>
                <td className="px-3 py-2">{ROTULO_DO_PAPEL[u.papel] ?? u.papel}</td>
                <td className="px-3 py-2">
                  {u.comite_assedio ? (
                    <span className="rounded-full bg-respeito/10 px-2 py-0.5 text-xs font-semibold text-respeito">
                      lê as denúncias
                    </span>
                  ) : (
                    <span className="text-texto-suave">não</span>
                  )}
                </td>
                <td className="px-3 py-2 text-texto-suave">{formatarData(u.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Configurações da empresa — só admin (docs/TIME_04 §14). */
function Configuracoes() {
  const { data: perfil } = usePerfil();
  const { data: empresa, isLoading } = useEmpresa();

  if (perfil && perfil.papel !== "admin") {
    return (
      <p className="rounded-2xl border border-borda bg-superficie p-6 text-center text-sm text-texto-suave">
        Só o administrador da empresa abre as configurações.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-marinho">Configurações</h1>
      </header>

      {isLoading && <p className="text-sm text-texto-suave">Carregando…</p>}

      {empresa && (
        <>
          <DadosDaEmpresa empresa={empresa} />
          <CadastroPorEmail empresa={empresa} />
          <TermoLgpd empresa={empresa} />
          <UsuariosDoPainel />
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_protegido/painel/configuracoes")({
  component: Configuracoes,
});
