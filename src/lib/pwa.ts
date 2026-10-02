/**
 * Registro do service worker do app do colaborador (docs/TIME_05 §10).
 *
 * O escopo é `/app`: o painel do técnico e o Canal de Respeito ficam fora do
 * service worker. Isso importa no Canal, que não pode ter nada de cache nem de
 * rastreio por trás (CLAUDE.md regra 3).
 */
export function registrarServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Em desenvolvimento o SW só atrapalharia o hot reload.
  if (import.meta.env.DEV) return;

  const registrar = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/app" }).catch(() => {
      /* sem service worker o app segue funcionando normalmente */
    });
  };

  // Se a página já terminou de carregar, o evento `load` não vem mais.
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
}
