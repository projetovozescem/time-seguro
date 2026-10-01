import { useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";

/** Evento não-padrão do Chrome/Edge que permite disparar o instalador depois. */
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function rodandoInstalado(): boolean {
  if (typeof window === "undefined") return true;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  // iOS não expõe display-mode standalone; usa essa flag própria do Safari.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Convite para instalar o app na tela inicial. No Chrome/Edge usa o instalador
 * nativo; no iOS, que não dispara `beforeinstallprompt`, mostra o passo a passo.
 */
export function BotaoInstalar() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [instalado, setInstalado] = useState(true);
  const [mostrarDicaIOS, setMostrarDicaIOS] = useState(false);

  useEffect(() => {
    setInstalado(rodandoInstalado());

    const capturar = (e: Event) => {
      e.preventDefault(); // sem isso o Chrome mostra o próprio banner
      setEvento(e as EventoInstalacao);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setEvento(null);
    };

    window.addEventListener("beforeinstallprompt", capturar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  if (instalado) return null;

  // iOS: não há instalador programático, só instrução.
  if (!evento && ehIOS()) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-card/70 p-4">
        <button
          type="button"
          onClick={() => setMostrarDicaIOS((v) => !v)}
          className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-primary"
        >
          <Smartphone className="size-4" />
          Deixar o app fixo no celular
        </button>
        {mostrarDicaIOS && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-relaxed text-muted-foreground">
            Toque em <Share className="inline size-3.5" /> Compartilhar e depois em{" "}
            <strong className="text-foreground">Adicionar à Tela de Início</strong>.
          </p>
        )}
      </div>
    );
  }

  if (!evento) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await evento.prompt();
        const { outcome } = await evento.userChoice;
        if (outcome === "accepted") setInstalado(true);
        setEvento(null); // o evento só pode ser usado uma vez
      }}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-card text-sm font-semibold text-primary"
    >
      <Smartphone className="size-4" />
      Instalar o app no celular
    </button>
  );
}
