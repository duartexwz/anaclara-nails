import { useState } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { PrimaryButton, GhostButton } from "@/components/admin/AdminShell";
import { criarNailDesignApi, ApiError } from "@/lib/api";
import { mascararCpf, mascararTelefone } from "@/lib/masks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NovaNailModal({ open, onOpenChange, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!formData.nome.trim()) {
        throw new ApiError(400, "Preencha o nome da profissional.");
      }
      
      const cpfLimpo = formData.cpf.replace(/\D/g, "");
      if (cpfLimpo.length !== 11) {
        throw new ApiError(400, "CPF inválido. Informe os 11 dígitos.");
      }

      if (!formData.email.trim()) {
        throw new ApiError(400, "Preencha o e-mail da profissional.");
      }

      // Prepara os dados. (O parâmetro password foi omitido por não constar no formulário básico).
      return criarNailDesignApi({
        nome: formData.nome.trim(),
        cpf: cpfLimpo,
        telefone: formData.telefone.trim() || "Não informado",
        email: formData.email.trim(),
        eh_admin: false,
        eh_nail_admin: false,
      });
    },
    onSuccess: () => {
      toast.success(`Nail Designer ${formData.nome} cadastrada com sucesso!`);
      onOpenChange(false);
      setFormData({
        nome: "",
        cpf: "",
        email: "",
        telefone: "",
      });
      // Esta linha avisa a tabela do ficheiro equipe.tsx para recarregar os dados!
      if (onSuccess) onSuccess();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Erro ao cadastrar profissional. Tente novamente.");
    },
  });

  if (!open) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    criarMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="font-display text-xl">Adicionar Nail Designer</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nome Completo */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nome Completo *
            </label>
            <input
              type="text"
              name="nome"
              required
              placeholder="ex: Ana Clara"
              value={formData.nome}
              onChange={handleChange}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* CPF */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                CPF *
              </label>
              <input
                type="text"
                name="cpf"
                required
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cpf: mascararCpf(e.target.value) }))
                }
                inputMode="numeric"
                maxLength={14}
                className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            {/* Telefone */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Telefone / WhatsApp *
              </label>
              <input
                type="tel"
                name="telefone"
                required
                placeholder="(00) 90000-0000"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, telefone: mascararTelefone(e.target.value) }))
                }
                inputMode="tel"
                maxLength={15}
                className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              E-mail *
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="profissional@exemplo.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <div onClick={() => onOpenChange(false)}>
              <GhostButton>Cancelar</GhostButton>
            </div>
            <div onClick={handleSubmit}>
              <PrimaryButton disabled={criarMutation.isPending}>
                {criarMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {criarMutation.isPending ? "Salvando..." : "Cadastrar Profissional"}
              </PrimaryButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}