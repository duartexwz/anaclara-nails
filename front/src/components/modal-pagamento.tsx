import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { ModalSinalPago } from "@/components/modal-sinal-pago";
import { brl } from "@/lib/dados";
import { toast } from "sonner";
import {
  ApiError,
  consultarPagamentoApi,
  criarPagamentoApi,
  isBackendOnline,
  type PagamentoApi,
} from "@/lib/api";
import {
  mountPaymentBrick,
  resolvePublicKey,
  type BrickFormData,
} from "@/lib/mercadopago";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelo: string;
  valor: number;
  data: string;
  hora: string;
  onConfirmado?: () => void;
  agendamentoId?: number | null;
  email?: string;
};

type Etapa =
  | "verificando"
  | "brick"
  | "processando"
  | "aguardando-pix"
  | "aprovado"
  | "erro";

const BRICK_CONTAINER_ID = "mp-payment-brick";

export function ModalPagamento({
  open,
  onOpenChange,
  modelo,
  valor,
  data,
  hora,
  onConfirmado,
  agendamentoId = null,
  email = "",
}: Props) {
  const [etapa, setEtapa] = useState<Etapa>("verificando");
  const [pagamento, setPagamento] = useState<PagamentoApi | null>(null);
  const [chavePublica, setChavePublica] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState("");
  const brickRef = useRef<{ unmount: () => Promise<void> | void } | null>(null);
  const sinal = valor / 2;

  // Decide o modo ao abrir: Checkout Bricks real via backend + Mercado Pago.
  // A Public Key vem do .env ou do backend (GET /pagamentos/public-key).
  useEffect(() => {
    if (!open) return;
    let ativo = true;
    setEtapa("verificando");
    setPagamento(null);
    setErroMsg("");
    setChavePublica(null);
    (async () => {
      if (agendamentoId == null) {
        if (ativo) {
          setErroMsg("Agendamento inválido. Feche e tente novamente.");
          setEtapa("erro");
        }
        return;
      }
      const online = await isBackendOnline();
      if (!ativo) return;
      if (!online) {
        setErroMsg("Sem conexão com o servidor. Verifique sua internet.");
        setEtapa("erro");
        return;
      }
      const chave = await resolvePublicKey().catch(() => null);
      if (!ativo) return;
      if (!chave) {
        setErroMsg("Checkout indisponível no momento. Tente novamente.");
        setEtapa("erro");
        return;
      }
      setChavePublica(chave);
      setEtapa("brick");
    })();
    return () => {
      ativo = false;
    };
  }, [open, agendamentoId]);

  // Monta/desmonta o Payment Brick.
  useEffect(() => {
    if (!open || etapa !== "brick" || !chavePublica) return;
    let desmontar: (() => void) | undefined;
    let cancelado = false;
    (async () => {
      try {
        const controller = await mountPaymentBrick({
          containerId: BRICK_CONTAINER_ID,
          amount: sinal,
          payerEmail: email,
          publicKey: chavePublica,
          callbacks: {
            onSubmit: (formData) => enviarBrick(formData),
            // OBRIGATÓRIO no Bricks 3.x: sem onReady o create() rejeita
            // com "missing_required_callbacks" antes mesmo de renderizar.
            onReady: () => {},
            onError: () => {
              if (!cancelado) {
                setErroMsg("Não foi possível carregar o checkout.");
                setEtapa("erro");
              }
            },
          },
        });
        if (cancelado) {
          await controller.unmount();
          return;
        }
        brickRef.current = controller;
        desmontar = () => {
          controller.unmount();
        };
      } catch (e) {
        // Loga a causa real (SDK engole detalhes) para diagnóstico no console.
        console.error("[checkout] falha ao montar o brick:", e);
        if (!cancelado) {
          setErroMsg("Checkout indisponível no momento.");
          setEtapa("erro");
        }
      }
    })();
    return () => {
      cancelado = true;
      desmontar?.();
      brickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, etapa, chavePublica]);

  const enviarBrick = async (formData: BrickFormData) => {
    if (agendamentoId == null) return;
    setEtapa("processando");
    try {
      const resultado = await criarPagamentoApi({
        agendamento_id: agendamentoId,
        transaction_amount: sinal,
        ...(formData.token ? { token: formData.token } : {}),
        ...(formData.issuer_id ? { issuer_id: formData.issuer_id } : {}),
        payment_method_id: formData.payment_method_id,
        installments: formData.installments || 1,
        payer: {
          email: formData.payer.email || email,
          ...(formData.payer.identification
            ? { identification: formData.payer.identification }
            : {}),
        },
        description: `Sinal ${modelo} — ${data} ${hora}`,
      });
      concluir(resultado);
    } catch (e) {
      setErroMsg(
        e instanceof ApiError ? e.message : "Falha ao processar o pagamento.",
      );
      setEtapa("erro");
    }
  };

  const concluir = (resultado: PagamentoApi) => {
    setPagamento(resultado);
    if (resultado.status === "approved" || resultado.status === "authorized") {
      setEtapa("aprovado");
    } else if (
      resultado.status === "pending" ||
      resultado.status === "in_process"
    ) {
      setEtapa("aguardando-pix");
    } else {
      setErroMsg("Pagamento não aprovado. Tente outro meio.");
      setEtapa("erro");
    }
  };

  const verificarPix = async () => {
    if (!pagamento) return;
    setEtapa("processando");
    try {
      const atual = await consultarPagamentoApi(pagamento.id);
      concluir(atual);
    } catch {
      setEtapa("aguardando-pix");
      toast.error("Ainda não identificamos o pagamento.");
    }
  };

  const fechar = (aberto: boolean) => {
    onOpenChange(aberto);
    if (!aberto) {
      if (etapa === "aprovado") onConfirmado?.();
      setTimeout(() => {
        setEtapa("verificando");
        setPagamento(null);
      }, 300);
    }
  };

  const protocolo = pagamento ? `MP-${pagamento.id}` : `#${agendamentoId ?? "—"}`;

  if (etapa === "aprovado") {
    return (
      <ModalSinalPago
        open={open}
        onOpenChange={fechar}
        titulo="Sinal pago com sucesso!"
        descricao={`Sinal de ${brl(sinal)} aprovado. Seu horário de ${data} às ${hora} está garantido.`}
        protocolo={protocolo}
        linhas={[
          { rotulo: "Modelo", valor: modelo },
          { rotulo: "Horário", valor: `${data} · ${hora}` },
          { rotulo: "Sinal pago (50%)", valor: brl(sinal), destaque: true },
          { rotulo: "Restante no atendimento", valor: brl(valor - sinal) },
        ]}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-lg rounded-3xl border-border/70 bg-card shadow-card">
        {etapa === "aguardando-pix" && pagamento ? (
          <div className="py-2 text-center">
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-2xl">Aguardando o Pix</DialogTitle>
              <DialogDescription>
                Pague o QR Code para confirmar. Assim que o Mercado Pago aprovar, liberamos aqui.
              </DialogDescription>
            </DialogHeader>
            {pagamento.qr_code_base64 ? (
              <img
                src={`data:image/png;base64,${pagamento.qr_code_base64}`}
                alt="QR Code do Pix"
                width={220}
                height={220}
                className="mx-auto mt-4 size-52 rounded-2xl border border-border object-contain"
              />
            ) : null}
            {pagamento.qr_code ? (
              <button
                type="button"
                className="mx-auto mt-3 flex max-w-full items-center gap-2 text-xs text-muted-foreground hover:text-primary"
                onClick={() => {
                  void navigator.clipboard?.writeText(pagamento.qr_code ?? "");
                  toast.success("Código Pix copiado");
                }}
              >
                <Copy className="size-3.5 shrink-0" />
                <span className="truncate">Copiar código Pix copia e cola</span>
              </button>
            ) : null}
            <Button
              className="mt-5 w-full gradient-primary text-primary-foreground shadow-soft"
              onClick={verificarPix}
            >
              Já paguei — verificar
            </Button>
          </div>
        ) : etapa === "erro" ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-8 text-destructive" />
            </div>
            <h3 className="mt-4 font-display text-2xl">Algo não saiu como esperado</h3>
            <p className="mt-2 text-sm text-muted-foreground">{erroMsg}</p>
            <Button
              className="mt-5 w-full gradient-primary text-primary-foreground"
              onClick={() => {
                setEtapa("verificando");
                setTimeout(() => {
                  if (agendamentoId == null) {
                    setErroMsg("Agendamento inválido. Feche e tente novamente.");
                    setEtapa("erro");
                    return;
                  }
                  setEtapa("brick");
                }, 100);
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-2xl">Pagamento do sinal</DialogTitle>
              <DialogDescription>
                RN01 — o sinal corresponde a 50% do valor do serviço e confirma o agendamento.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm">
              <Linha rotulo="Modelo" valor={modelo} />
              <Linha rotulo="Horário" valor={`${data} · ${hora}`} />
              <Linha rotulo="Valor total" valor={brl(valor)} />
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-medium">Sinal agora (50%)</span>
                <span className="font-display text-xl text-primary">{brl(sinal)}</span>
              </div>
            </div>

            {etapa === "verificando" || etapa === "processando" ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {etapa === "processando" ? "Processando pagamento..." : "Preparando checkout..."}
              </div>
            ) : (
              <div>
                <div id={BRICK_CONTAINER_ID} className="min-h-80" />
                <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-primary" /> Pagamento seguro via Mercado Pago
                </p>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
