import {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  HardHat,
  Hand,
  HeartHandshake,
  Layers,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Material informativo de campanha (tabela `materiais`, migration 0011).
 * O cartaz do painel e a página pública do QR leem o mesmo conteúdo do banco.
 */
export const ICONES_MATERIAL = {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  HardHat,
  Hand,
  HeartHandshake,
  Layers,
  ShieldCheck,
} satisfies Record<string, LucideIcon>;

export type IconeMaterial = keyof typeof ICONES_MATERIAL;

export type BlocoMaterial = { icone: IconeMaterial; titulo: string; texto: string };

const ICONE_PADRAO: IconeMaterial = "BookOpen";

/** Endereço público do material: destino do QR Code do cartaz. */
export function caminhoDoMaterial(codigoEmpresa: string, slug: string): string {
  return `/m/${codigoEmpresa}/${slug}`;
}

/**
 * Lê o `jsonb` de blocos com cuidado: vem do banco e pode ter sido editado à
 * mão. Bloco incompleto some; ícone desconhecido vira o padrão.
 */
export function lerBlocos(valor: unknown): BlocoMaterial[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((b): BlocoMaterial[] => {
    if (!b || typeof b !== "object") return [];
    const { icone, titulo, texto } = b as Record<string, unknown>;
    if (typeof titulo !== "string" || !titulo.trim()) return [];
    if (typeof texto !== "string" || !texto.trim()) return [];
    const valido = typeof icone === "string" && icone in ICONES_MATERIAL;
    return [{ icone: valido ? (icone as IconeMaterial) : ICONE_PADRAO, titulo, texto }];
  });
}
