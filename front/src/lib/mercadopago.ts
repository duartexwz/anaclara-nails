/**
 * Integração com o Checkout Bricks do Mercado Pago (Payment Brick).
 * Carrega o SDK sob demanda e monta o brick de pagamento (cartão + Pix)
 * dentro do container informado.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks
 */

export const MP_PUBLIC_KEY = import.meta.env[
  "VITE_MP_PUBLIC_KEY"
] as string | undefined;

export function isMercadoPagoConfigured(): boolean {
  return !!MP_PUBLIC_KEY && MP_PUBLIC_KEY !== "TEST-00000000-0000-0000-0000-000000000000";
}

let chaveBackend: string | null | undefined;

export async function resolvePublicKey(): Promise<string | null> {
  if (MP_PUBLIC_KEY && MP_PUBLIC_KEY !== "TEST-00000000-0000-0000-0000-000000000000") {
    return MP_PUBLIC_KEY;
  }
  if (chaveBackend !== undefined) return chaveBackend;
  try {
    const { getPublicKeyApi } = await import("./api");
    chaveBackend = await getPublicKeyApi();
  } catch {
    chaveBackend = null;
  }
  return chaveBackend;
}

export type BrickFormData = {
  token?: string;
  issuer_id?: string;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  payer: {
    email: string;
    identification?: { type: string; number: string };
    first_name?: string;
    last_name?: string;
  };
};

/** Wrapper que o SDK v2 realmente entrega no onSubmit do Payment Brick. */
export type BrickSubmitArg =
  | BrickFormData
  | {
      selectedPaymentMethod?: string;
      paymentMethod?: string;
      formData?: BrickFormData;
    };

export function extrairFormDataBrick(arg: BrickSubmitArg): BrickFormData {
  if (
    arg &&
    typeof arg === "object" &&
    ("formData" in arg || "selectedPaymentMethod" in arg || "paymentMethod" in arg)
  ) {
    const embrulho = arg as { formData?: BrickFormData };
    if (embrulho.formData) return embrulho.formData;
  }
  return arg as BrickFormData;
}

export function isPixBrick(formData: Pick<BrickFormData, "payment_method_id">): boolean {
  const metodo = (formData.payment_method_id || "").toLowerCase();
  return metodo === "pix" || metodo === "bank_transfer";
}

type BrickCallbacks = {
  onReady?: () => void;
  onSubmit: (formData: BrickFormData) => Promise<void>;
  onError?: (error: unknown) => void;
};

type BrickController = { unmount: () => Promise<void> | void };

// Tipagem mínima do SDK global (window.MercadoPago)
type MercadoPagoCtor = new (
  publicKey: string,
  options?: { locale?: string },
) => {
  bricks: () => {
    create: (
      type: "payment",
      containerId: string,
      config: {
        initialization: {
          amount: number;
          payer?: {
            email?: string;
            identification?: { type: string; number: string };
            firstName?: string;
            lastName?: string;
          };
        };
        customization?: Record<string, unknown>;
        callbacks: {
          onReady?: () => void;
          onSubmit: (arg1: BrickSubmitArg, arg2?: unknown) => Promise<void>;
          onError?: (error: unknown) => void;
        };
      },
    ) => Promise<BrickController>;
  };
};

declare global {
  interface Window {
    MercadoPago?: MercadoPagoCtor;
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
let carregando: Promise<void> | null = null;

export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((resolve, reject) => {
    const existente = document.querySelector(
      `script[src="${SDK_URL}"]`,
    );
    if (existente) {
      // Tag já presente (ex.: carregada antes): não espera evento que nunca refira.
      if (window.MercadoPago) {
        resolve();
        return;
      }
      existente.addEventListener("load", () => resolve());
      existente.addEventListener("error", () =>
        reject(new Error("Falha ao carregar o SDK do Mercado Pago")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Falha ao carregar o SDK do Mercado Pago"));
    document.head.appendChild(script);
  });
  return carregando;
}

export async function mountPaymentBrick(options: {
  containerId: string;
  amount: number;
  payerEmail?: string;
  payerIdentification?: { type: string; number: string };
  publicKey?: string;
  callbacks: BrickCallbacks;
}): Promise<BrickController> {
  const publicKey = options.publicKey ?? (await resolvePublicKey());
  if (!publicKey) {
    throw new Error("Public Key do Mercado Pago não configurada");
  }
  if (!Number.isFinite(options.amount) || options.amount <= 0) {
    throw new Error(`Valor inválido para o checkout: ${String(options.amount)}`);
  }
  await loadMercadoPagoSdk();
  if (!window.MercadoPago) {
    throw new Error("SDK do Mercado Pago indisponível");
  }
  const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
  const { callbacks } = options;
  return mp.bricks().create("payment", options.containerId, {
    initialization: {
      amount: options.amount,
      ...(options.payerEmail || options.payerIdentification
        ? {
            payer: {
              ...(options.payerEmail ? { email: options.payerEmail } : {}),
              ...(options.payerIdentification
                ? { identification: options.payerIdentification }
                : {}),
            },
          }
        : {}),
    },
    customization: {
      visual: { style: { theme: "default" } },
      paymentMethods: {
        creditCard: "all",
        debitCard: "all",
        ticket: "all",
        bankTransfer: "all",
        maxInstallments: 3,
      },
    },
    callbacks: {
      ...(callbacks.onReady ? { onReady: callbacks.onReady } : {}),
      ...(callbacks.onError ? { onError: callbacks.onError } : {}),
      // O SDK v2 chama onSubmit({ selectedPaymentMethod, formData }).
      // Versões antigas chamavam onSubmit(formData). Normaliza os dois.
      onSubmit: (arg1: BrickSubmitArg, arg2?: unknown) => {
        const embrulho = (arg2 as { formData?: BrickFormData } | undefined)
          ?.formData;
        const formData = embrulho ?? extrairFormDataBrick(arg1);
        return callbacks.onSubmit(formData);
      },
    },
  });
}
