import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarHeart } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { brl } from "@/lib/dados";
import type { AgendamentoExibicao } from "@/hooks/useAgenda";

const CHAVE = "ana-clara-ultimo-agendamento";

/**
 * Popup com o agendamento mais recente ao abrir o painel.
 * Exibe uma única vez por agendamento (marca vista em localStorage).
 */
export function PopupUltimoAgendamento({ itens }: { itens: AgendamentoExibicao[] }) {
  const [aberto, setAberto] = useState(false);
  const ultimo = itens.length > 0 ? itens[itens.length - 1]! : null;

  useEffect(() => {
    if (!ultimo) return;
    let vista: string | null = null;
    try {
      vista = localStorage.getItem(CHAVE);
    } catch {
      /* sem storage */
    }
    if (vista !== String(ultimo.id)) setAberto(true);
  }, [ultimo]);

  const dispensar = (abriu: boolean) => {
    setAberto(abriu);
    if (!abriu && ultimo) {
      try {
        localStorage.setItem(CHAVE, String(ultimo.id));
      } catch {
        /* sem storage */
      }
    }
  };

  if (!ultimo) return null;

  const linhas = [
    { rotulo: "Cliente", valor: ultimo.cliente },
    { rotulo: "Modelo", valor: ultimo.modelo },
    { rotulo: "Horário", valor: `${ultimo.data} · ${ultimo.hora}` },
    { rotulo: "Sinal", valor: `${brl(ultimo.sinal)} (${ultimo.pagamento})` },
  ];

  return (
    <Dialog open={aberto} onOpenChange={dispensar}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-card">
        <div className="gradient-primary px-4 py-5 text-primary-foreground sm:px-6 sm:py-6">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] opacity-90">
            <CalendarHeart className="size-4" /> Último agendamento
          </p>
          <p className="mt-2 font-display text-xl sm:text-2xl">Novo agendamento recebido</p>
        </div>
        <div className="space-y-3 px-4 py-5 sm:space-y-3 sm:px-6 sm:py-6">
          <div className="rounded-2xl border border-border bg-muted/50 p-3 text-sm sm:p-4">
            {linhas.map((l) => (
              <div
                key={l.rotulo}
                className="flex items-center justify-between gap-3 py-1"
              >
                <span className="text-muted-foreground">{l.rotulo}</span>
                <span className="text-right font-medium">{l.valor}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => dispensar(false)}
            >
              Dispensar
            </Button>
            <Button
              className="flex-1 gradient-primary rounded-2xl text-primary-foreground shadow-soft"
              asChild
            >
              <Link to="/admin/agendamentos" onClick={() => dispensar(false)}>
                Ver na agenda
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
