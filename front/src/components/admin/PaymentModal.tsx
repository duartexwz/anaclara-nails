import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreditCard, QrCode, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { brl } from "@/lib/dados";
import type { AgendamentoExibicao as Agendamento } from "@/hooks/useAgenda";
import { ModalSinalPago } from "@/components/modal-sinal-pago";

export function PaymentModal({
  open,
  onOpenChange,
  agendamento,
  onConfirmado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onConfirmado?: (agendamento: Agendamento) => void;
}) {
  const [metodo, setMetodo] = useState<"pix" | "cartao">("pix");
  const [etapa, setEtapa] = useState<"pagar" | "processando" | "sucesso">("pagar");
  if (!agendamento) return null;

  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
    if (!aberto) {
      if (etapa === "sucesso") onConfirmado?.(agendamento);
      setTimeout(() => {
        setEtapa("pagar");
        setMetodo("pix");
      }, 300);
    }
  };

  const confirmar = () => {
    setEtapa("processando");
    setTimeout(() => setEtapa("sucesso"), 1600);
  };

  if (etapa === "sucesso") {
    return (
      <ModalSinalPago
        open={open}
        onOpenChange={fechar}
        titulo="Sinal recebido com sucesso!"
        descricao={`Pagamento de ${agendamento.cliente} confirmado e horário garantido.`}
        protocolo={String(agendamento.id)}
        linhas={[
          { rotulo: "Cliente", valor: agendamento.cliente },
          { rotulo: "Modelo", valor: agendamento.modelo },
          { rotulo: "Horário", valor: `${agendamento.data} · ${agendamento.hora}` },
          { rotulo: "Sinal recebido (50%)", valor: brl(agendamento.sinal), destaque: true },
          { rotulo: "Restante no atendimento", valor: brl(agendamento.valor - agendamento.sinal) },
        ]}
        textoBotao="Voltar ao painel"
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent
        className="max-w-lg gap-0 rounded-3xl border-border/70 bg-card p-0 shadow-card"
      >
        <div className="rounded-t-3xl bg-gradient-primary px-5 py-6 text-primary-foreground sm:px-8 sm:py-7">
          <p className="text-xs uppercase tracking-[0.3em] text-primary-foreground/80">
            Pagamento do sinal
          </p>
          <p className="mt-2 font-display text-3xl">{brl(agendamento.sinal)}</p>
          <p className="text-sm text-primary-foreground/85">
            50% de {brl(agendamento.valor)} · {agendamento.modelo}
          </p>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-8 sm:py-7">
          <div className="rounded-2xl bg-muted/70 p-4 text-sm">
            <Row label="Cliente" value={agendamento.cliente} />
            <Row label="Horário" value={`${agendamento.data} · ${agendamento.hora}`} />
            <Row label="Restante no atendimento" value={brl(agendamento.valor - agendamento.sinal)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MethodButton
              active={metodo === "pix"}
              onClick={() => setMetodo("pix")}
              icon={<QrCode className="size-4" />}
              label="Pix"
              hint="Aprovação imediata"
            />
            <MethodButton
              active={metodo === "cartao"}
              onClick={() => setMetodo("cartao")}
              icon={<CreditCard className="size-4" />}
              label="Cartão"
              hint="Em até 3x"
            />
          </div>

          {metodo === "pix" ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
              <div className="grid size-24 shrink-0 place-items-center rounded-xl bg-gradient-soft">
                <QrCode className="size-14 text-primary" />
              </div>
              <div className="text-sm">
                <p className="font-medium">Pix copia e cola</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  00020126ANACLARANAILS5204000053039865802BR6009SAO PAULO
                </p>
                <button className="mt-2 text-xs font-medium text-primary hover:underline">
                  Copiar código
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Número do cartão" value="•••• •••• •••• 4410" className="sm:col-span-2" />
              <Field label="Validade" value="08/29" />
              <Field label="CVV" value="•••" />
              <Field label="Nome impresso" value={agendamento.cliente} className="sm:col-span-2" />
            </div>
          )}

          <button
            onClick={confirmar}
            disabled={etapa === "processando"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            {etapa === "processando" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Processando pagamento...
              </>
            ) : (
              "Confirmar pagamento do sinal"
            )}
          </button>

          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            O agendamento é confirmado somente após aprovação do sinal.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        defaultValue={value}
        className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
