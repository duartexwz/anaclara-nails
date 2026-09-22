import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

export type LinhaSucesso = {
  rotulo: string;
  valor: string;
  destaque?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ex.: "Sinal pago com sucesso!" */
  titulo?: string;
  descricao?: string;
  /** Ex.: "MP-123456" ou "AG-1047" */
  protocolo?: string;
  linhas?: LinhaSucesso[];
  textoBotao?: string;
  nota?: string;
};

/**
 * Modal padrão de sucesso do sinal (RN03) — identidade Ana Clara Nails.
 * Usada no checkout do cliente e na confirmação do painel admin.
 */
export function ModalSinalPago({
  open,
  onOpenChange,
  titulo = "Sinal pago com sucesso!",
  descricao = "O agendamento foi confirmado. Te esperamos!",
  protocolo,
  linhas = [],
  textoBotao = "Ver meus agendamentos",
  nota = "Pagamento processado com segurança via Mercado Pago.",
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-card">
        <div className="gradient-primary relative overflow-hidden px-4 py-6 text-center text-primary-foreground sm:px-6 sm:py-8">
          <Sparkles className="absolute left-5 top-5 size-5 opacity-60" />
          <Sparkles className="absolute bottom-6 right-6 size-4 opacity-40" />
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/20 shadow-soft backdrop-blur sm:size-16">
            <CheckCircle2 className="size-8 sm:size-9" />
          </span>
          <h3 className="mt-4 font-display text-xl sm:text-2xl">{titulo}</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-primary-foreground/85">
            {descricao}
          </p>
          {protocolo ? (
            <span className="mt-3 inline-block rounded-full bg-white/20 px-4 py-1 text-xs font-medium tracking-wide backdrop-blur">
              Protocolo {protocolo}
            </span>
          ) : null}
        </div>

        <div className="space-y-3 px-4 py-5 sm:space-y-4 sm:px-6 sm:py-6">
          {linhas.length > 0 && (
            <div className="rounded-2xl border border-border bg-muted/50 p-3 text-sm sm:p-4">
              {linhas.map((l) => (
                <div
                  key={l.rotulo}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <span className="shrink-0 text-muted-foreground">{l.rotulo}</span>
                  <span
                    className={
                      l.destaque
                        ? "font-display text-lg text-primary"
                        : "break-words text-right font-medium"
                    }
                  >
                    {l.valor}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full gradient-primary text-primary-foreground shadow-soft"
            onClick={() => onOpenChange(false)}
          >
            {textoBotao}
          </Button>

          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" /> {nota}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
