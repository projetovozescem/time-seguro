import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TimeLogo } from "@/components/TimeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Login do técnico, CIPA e admin (docs/TIME_03 §2): Supabase Auth com e-mail e
 * senha. O cadastro público fica DESATIVADO no painel do Supabase; técnico novo
 * é criado pelo admin.
 *
 * A proteção real das telas é o RLS/RPC — este formulário e o guard de rota são
 * só experiência de uso.
 */
function PainelLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        // Mensagem única: não revelamos se o e-mail existe.
        setErro("E-mail ou senha incorretos.");
        return;
      }
      await navigate({ to: "/painel", replace: true });
    } catch {
      setErro("Não foi possível entrar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  async function recuperarSenha() {
    if (!email) {
      setErro("Digite seu e-mail para receber o link de redefinição.");
      return;
    }
    setErro(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/painel/nova-senha`,
    });
    setErro(
      error
        ? "Não foi possível enviar o e-mail agora. Tente de novo em instantes."
        : "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.",
    );
  }

  return (
    <div className="min-h-screen bg-fundo">
      <div className="faixa-seguranca" />
      <main className="mx-auto flex min-h-[calc(100vh-6px)] w-full max-w-sm flex-col justify-center gap-8 px-5 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <TimeLogo tamanho="lg" comLegenda={false} />
          <h1 className="font-display text-xl font-extrabold text-marinho">Painel da SST</h1>
          <p className="text-sm text-texto-suave">Acesso para técnico, CIPA e administrador.</p>
        </div>

        <form onSubmit={entrar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="min-h-12"
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-vermelho">
              {erro}
            </p>
          )}

          <Button type="submit" disabled={enviando} className="min-h-12 text-base">
            {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Entrar
          </Button>

          <button
            type="button"
            onClick={recuperarSenha}
            className="text-sm font-medium text-marinho underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="text-center text-sm text-texto-suave">
          É colaborador?{" "}
          <Link
            to="/app/entrar"
            className="font-medium text-marinho underline-offset-4 hover:underline"
          >
            Entre pelo app
          </Link>
        </p>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/painel/login")({
  component: PainelLogin,
});
