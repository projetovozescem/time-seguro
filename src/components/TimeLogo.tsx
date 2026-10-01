import { ShieldCheck } from "lucide-react";

const TAMANHOS = {
  sm: { icone: "size-5", titulo: "text-base", legenda: "text-[10px]" },
  md: { icone: "size-7", titulo: "text-xl", legenda: "text-[11px]" },
  lg: { icone: "size-10", titulo: "text-3xl", legenda: "text-xs" },
} as const;

/**
 * Marca do T.I.M.E. Seguro (docs/TIME_10 §1): escudo + sigla.
 * `claro` inverte as cores para uso sobre fundo marinho.
 */
export function TimeLogo({
  tamanho = "md",
  claro = false,
  comLegenda = true,
}: {
  tamanho?: keyof typeof TAMANHOS;
  claro?: boolean;
  comLegenda?: boolean;
}) {
  const t = TAMANHOS[tamanho];
  const corIcone = claro ? "text-amarelo" : "text-marinho";
  const corTitulo = claro ? "text-white" : "text-marinho";
  const corLegenda = claro ? "text-white/70" : "text-texto-suave";

  return (
    <div className="flex items-center gap-2.5">
      <ShieldCheck className={`${t.icone} ${corIcone}`} strokeWidth={2.25} aria-hidden />
      <div className="leading-tight">
        <span
          className={`block font-display font-extrabold tracking-tight ${t.titulo} ${corTitulo}`}
        >
          T.I.M.E.
        </span>
        {comLegenda && (
          <span className={`block font-medium uppercase tracking-wide ${t.legenda} ${corLegenda}`}>
            Seguro
          </span>
        )}
      </div>
    </div>
  );
}
