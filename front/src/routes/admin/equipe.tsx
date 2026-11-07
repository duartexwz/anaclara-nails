import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, User } from "lucide-react";
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

// Importe o modal que ajustamos hoje
import { NovaNailModal } from "@/components/admin/NovaNail.tsx"; 

// Importe suas funções de API e máscaras (ajuste os caminhos se necessário)
import { listarNailDesignsApi, excluirNailDesignApi, ApiError } from "@/lib/api";
import { mascararCpf, mascararTelefone } from "@/lib/masks";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/equipe")({
  head: () => ({
    meta: [{ title: "Equipe — Painel Ana Clara Nails" }],
  }),
  component: EquipeAdmin,
});

function EquipeAdmin() {
  const { ehNailAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ehNailAdmin) {
      void navigate({ to: "/admin" });
    }
  }, [ehNailAdmin, navigate]);

  if (ehNailAdmin) {
    return null;
  }

  const queryClient = useQueryClient();
  const [novaNailOpen, setNovaNailOpen] = useState(false);
  const [excluirNdId, setExcluirNdId] = useState<number | null>(null);

  // Busca as profissionais na API
  const nailDesignsQuery = useQuery({
    queryKey: ["nail-designs"],
    queryFn: listarNailDesignsApi,
  });

  const nailDesigns = nailDesignsQuery.data ?? [];

  // Mutação para excluir uma profissional
  const excluirNailDesignMutation = useMutation({
    mutationFn: (id: number) => excluirNailDesignApi(id),
    onSuccess: () => {
      toast.success("Nail design removida com sucesso");
      setExcluirNdId(null);
      void queryClient.invalidateQueries({ queryKey: ["nail-designs"] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível remover a profissional.");
    },
  });

  return (
    <AdminShell
      title="Nail Designers"
      subtitle="Gerencie a equipe e as profissionais cadastradas"
      actions={
        <PrimaryButton onClick={() => setNovaNailOpen(true)}>
          <Plus className="mr-2 size-4" /> Adicionar profissional
        </PrimaryButton>
      }
    >
      <Card className="!p-0 overflow-hidden">
        {nailDesignsQuery.isPending ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : nailDesignsQuery.isError ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Não foi possível carregar as profissionais. Verifique sua conexão.
          </p>
        ) : nailDesigns.length === 0 ? (
          <div className="p-8 text-center space-y-3 flex flex-col items-center">
            <User className="size-12 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma nail design cadastrada ainda.</p>
            <Button 
              onClick={() => setNovaNailOpen(true)} 
              className="gradient-primary text-primary-foreground shadow-soft"
            >
              <Plus className="mr-2 size-4" /> Cadastrar a primeira
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-medium">Nome</th>
                  <th className="px-4 py-4 font-medium">CPF</th>
                  <th className="px-4 py-4 font-medium">Telefone</th>
                  <th className="px-6 py-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {nailDesigns.map((nd) => (
                  <tr key={nd.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-gradient-primary text-xs text-primary-foreground font-display">
                        {nd.nome.slice(0, 2).toUpperCase()}
                      </span>
                      <span>{nd.nome}</span>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {mascararCpf(nd.cpf)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {mascararTelefone(nd.telefone)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <AlertDialog
                        open={excluirNdId === nd.id}
                        onOpenChange={(o) => !o && setExcluirNdId(null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 rounded-xl"
                            title="Excluir profissional"
                            onClick={() => setExcluirNdId(nd.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border-border/70 bg-card shadow-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-display text-2xl">
                              Remover “{nd.nome}”?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              A profissional será desvinculada do sistema. Essa ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-2xl bg-destructive text-destructive-foreground shadow-soft"
                              onClick={() => excluirNailDesignMutation.mutate(nd.id)}
                            >
                              Remover profissional
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Chamada do Modal para Cadastrar */}
      <NovaNailModal
        open={novaNailOpen}
        onOpenChange={setNovaNailOpen}
        onSuccess={() => void queryClient.invalidateQueries({ queryKey: ["nail-designs"] })}
      />
    </AdminShell>
  );
}