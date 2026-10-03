import { useEffect, useState } from "react";

/** O navegador está em tela cheia agora? (Esc também sai, então o estado vem do evento.) */
export function useTelaCheia(): boolean {
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const atualizar = () => setCheia(!!document.fullscreenElement);
    atualizar();
    document.addEventListener("fullscreenchange", atualizar);
    return () => document.removeEventListener("fullscreenchange", atualizar);
  }, []);
  return cheia;
}
