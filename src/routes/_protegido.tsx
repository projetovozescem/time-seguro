import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PainelLayout } from "@/components/layout/PainelLayout";

/**
 * Layout sem segmento de URL que protege as telas do painel (docs/TIME_03 §2).
 * `/painel/login` e `/painel/nova-senha` ficam de fora, por isso são rotas
 * irmãs e não filhas deste layout.
 *
 * O guard é só experiência de uso: quem protege de verdade é o RLS e as RPCs.
 */
export const Route = createFileRoute("/_protegido")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/painel/login" });
  },
  component: PainelLayout,
});
