import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

import { AdminShell, Card, PrimaryButton } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { NovoAdminModal } from "@/components/admin/NovoAdminModal.tsx"; 
import {
  listarAdministradoresApi,
  excluirAdministradorApi,
  ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/administradores")({
  head: () => ({
    meta: [{ title: "Administradores — Painel Ana Clara Nails" }],
  }),
  component: AdministradoresPage,
});

function AdministradoresPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  // Bloqueio de segurança: Apenas Admin Master pode acessar
  useEffect(() => {
    if (usuario?.perfil !== "admin") {
      toast.error("Acesso negado. Apenas o Admin Master pode gerenciar administradores.");
      void navigate({ to: "/admin" });
    }
  }, [usuario, navigate]);

  if (usuario?.perfil !== "admin") return null;

  const queryClient = useQueryClient();
  const [novoAdminOpen, setNovoAdminOpen] = useState(false);
  const [excluirId, setExcluirId] = useState<number | null>(null);

  const adminsQuery = useQuery({
    queryKey: ["administradores"],
    queryFn: listarAdministradoresApi,
  });

  const admins = adminsQuery.data ?? [];

  const excluirMutation = useMutation({
    mutationFn: (id: number) => excluirAdministradorApi(id),
    onSuccess: () => {
      toast.success("Administrador removido com sucesso");
      setExcluirId(null);
      void queryClient.invalidateQueries({ queryKey: ["administradores"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível remover o admin.");
    },
  });

  return (
    <AdminShell
      title="Administradores"
      subtitle="Controle quem tem acesso ao painel do sistema"
      actions={
        <PrimaryButton onClick={() => setNovoAdminOpen(true)}>
          <Plus className="mr-2 size-4" /> Adicionar admin
        </PrimaryButton>
      }
    >
      <Card className="!p-0 overflow-hidden">
        {adminsQuery.isPending ? (
          <div className="space-y-3 p-6">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center space-y-3 flex flex-col items-center">
            <Shield className="size-12 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum administrador encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-medium">Nome</th>
                  <th className="px-4 py-4 font-medium">E-mail</th>
                  <th className="px-4 py-4 font-medium">Perfil</th>
                  <th className="px-6 py-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((adm) => (
                  <tr key={adm.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <span className={`flex size-8 items-center justify-center rounded-full text-xs font-display text-white ${adm.type_user_id !== 3 ? 'bg-primary' : 'bg-muted-foreground'}`}>
                        {adm.nome.slice(0, 2).toUpperCase()}
                      </span>
                      <span>{adm.nome}</span>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{adm.email}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {adm.type_user_id !== 3 ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary font-medium">Master</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground font-medium">Equipe</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* Evita que o admin logado exclua a si mesmo */}
                      {usuario.email !== adm.email && (
                        <AlertDialog open={excluirId === adm.id} onOpenChange={(o) => !o && setExcluirId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => setExcluirId(adm.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-border/70 bg-card shadow-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display text-2xl">Remover “{adm.nome}”?</AlertDialogTitle>
                              <AlertDialogDescription>O acesso deste usuário ao painel será revogado permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction className="rounded-2xl bg-destructive text-destructive-foreground" onClick={() => excluirMutation.mutate(adm.id)}>
                                Remover acesso
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NovoAdminModal
        open={novoAdminOpen}
        onOpenChange={setNovoAdminOpen}
        onSuccess={() => void queryClient.invalidateQueries({ queryKey: ["administradores"] })}
      />
    </AdminShell>
  );
}