import type { Analytics } from "@/hooks/useAnalytics";
import { Secao, percentual } from "./Secao";

/**
 * Barras horizontais proporcionais ao topo do funil — mais legíveis que um funil
 * desenhado, e cada etapa traz o número e a conversão como rótulo direto.
 */
export function FunilEngajamento({ funil }: { funil: Analytics["funil"] }) {
  const topo = funil[0]?.valor ?? 0;
  const vazio = funil.every((e) => e.valor === 0);

  return (
    <Secao
      titulo="Funil de engajamento"
      descricao="A jornada do aluno: acessar o QR Code, responder, acertar e compartilhar."
      vazio={vazio}
      mensagemVazio="Nenhum acesso registrado ainda."
    >
      <div className="space-y-4">
        {funil.map((etapa) => {
          const largura = topo > 0 ? (etapa.valor / topo) * 100 : 0;
          return (
            <div key={etapa.etapa}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{etapa.etapa}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold text-primary">
                    {etapa.valor.toLocaleString("pt-BR")}
                  </span>
                  {etapa.conversao !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {percentual(etapa.conversao)} da etapa anterior
                    </span>
                  )}
                </span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-chart-1 transition-all duration-500"
                  style={{ width: `${largura}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Secao>
  );
}
