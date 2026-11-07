import { useState } from "react";
import { ShieldCheck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PrimaryButton, GhostButton } from "@/components/admin/AdminShell";
import { criarAdministradorApi, ApiError, listarNailDesignsApi } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NovoAdminModal({ open, onOpenChange, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    password: "",
    perfil: "nail_admin", // 'admin' (master) ou 'nail_admin'
    nail_design_id: "",
  });

  // Busca as profissionais para vincular o admin (caso seja um nail_admin)
  const { data: profissionais } = useQuery({
    queryKey: ["nail-designs"],
    queryFn: listarNailDesignsApi,
    enabled: open,
  });

  const nailDesignId =
    formData.perfil === "nail_admin" && formData.nail_design_id
      ? Number(formData.nail_design_id)
      : undefined;

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!formData.nome.trim() || !formData.email.trim() || !formData.password) {
        throw new ApiError(400, "Preencha todos os campos obrigatórios.");
      }

      return criarAdministradorApi({
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        password: formData.password,
        // 1 = ADMIN (acesso completo) | 3 = NAIL_ADMIN (acesso limitado).
        // 2 é USER (cliente) e não pode ser usado aqui.
        type_user_id: formData.perfil === "admin" ? 1 : 3,
        ...(nailDesignId !== undefined && { nail_design_id: nailDesignId }),
      });
    },
    onSuccess: () => {
      toast.success(`Administrador ${formData.nome} criado com sucesso!`);
      onOpenChange(false);
      setFormData({ nome: "", email: "", password: "", perfil: "nail_admin", nail_design_id: "" });
      if (onSuccess) onSuccess();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Erro ao cadastrar administrador.");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="font-display text-xl">Novo Administrador</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); criarMutation.mutate(); }} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome Completo *</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail de Acesso *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha Provisória *</label>
            <input
              type="text"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Perfil</label>
              <select
                value={formData.perfil}
                onChange={(e) => setFormData({ ...formData, perfil: e.target.value })}
                className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="nail_admin">Nail Designer (Comum)</option>
                <option value="admin">Admin Master</option>
              </select>
            </div>

            {formData.perfil === "nail_admin" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Vincular Profissional</label>
                <select
                  required
                  value={formData.nail_design_id}
                  onChange={(e) => setFormData({ ...formData, nail_design_id: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione...</option>
                  {profissionais?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <div onClick={() => onOpenChange(false)}>
              <GhostButton>Cancelar</GhostButton>
            </div>
            <PrimaryButton disabled={criarMutation.isPending} type="submit">
              {criarMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar Administrador
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}