import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_EVENTO, type EventoCalendario, type Turma } from "@/lib/vozes";

export interface DadosEvento {
  titulo: string;
  data: string;
  horario: string | null;
  descricao: string | null;
  tipo: string;
  turma_id: string | null;
}

const SEM_TURMA = "__nenhuma__";

export function EventoForm({
  aberto,
  aoFechar,
  evento,
  dataPadrao,
  turmas,
  aoSalvar,
  salvando,
}: {
  aberto: boolean;
  aoFechar: () => void;
  evento: EventoCalendario | null;
  dataPadrao: string;
  turmas: Turma[];
  aoSalvar: (dados: DadosEvento) => void;
  salvando: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(dataPadrao);
  const [horario, setHorario] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("geral");
  const [turmaId, setTurmaId] = useState(SEM_TURMA);

  // Recarrega o formulário sempre que o modal abre, para edição ou criação.
  useEffect(() => {
    if (!aberto) return;
    setTitulo(evento?.titulo ?? "");
    setData(evento?.data?.slice(0, 10) ?? dataPadrao);
    setHorario(evento?.horario ?? "");
    setDescricao(evento?.descricao ?? "");
    setTipo(evento?.tipo ?? "geral");
    setTurmaId(evento?.turma_id ?? SEM_TURMA);
  }, [aberto, evento, dataPadrao]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Quiz TV — turmas do 2º ano"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horario">Horário</Label>
              <Input
                id="horario"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                placeholder="Ex.: 14h30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPOS_EVENTO).map(([chave, t]) => (
                  <SelectItem key={chave} value={chave}>
                    {t.emoji} {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Turma relacionada</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_TURMA}>Todas as turmas</SelectItem>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Turma {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que acontece neste dia?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            disabled={!titulo.trim() || !data || salvando}
            onClick={() =>
              aoSalvar({
                titulo: titulo.trim(),
                data,
                horario: horario.trim() || null,
                descricao: descricao.trim() || null,
                tipo,
                turma_id: turmaId === SEM_TURMA ? null : turmaId,
              })
            }
          >
            {salvando ? "Salvando…" : "Salvar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
