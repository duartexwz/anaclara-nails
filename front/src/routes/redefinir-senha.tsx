import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Cabecalho } from "@/components/cabecalho";
import { Rodape } from "@/components/rodape";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, redefinirSenhaApi } from "@/lib/api";
import { CheckCircle2, Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const { token } = Route.useSearch();
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [ok, setOk] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!token) throw new ApiError(400, "Link inválido.");
      if (nova.length < 8) {
        throw new ApiError(400, "A nova senha precisa de 8+ caracteres.");
      }
      if (nova !== conf) throw new ApiError(400, "As senhas não conferem.");
      return redefinirSenhaApi(token, nova);
    },
    onSuccess: () => setOk(true),
  });

  return (
    <div className="min-h-screen">
      <Cabecalho />
      <section className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <Card className="rounded-3xl border-border/70 p-6 shadow-card sm:p-8">
          {ok ? (
            <div className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/15">
                <CheckCircle2 className="size-7 text-success" />
              </span>
              <h1 className="mt-4 font-display text-2xl">Senha redefinida!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Entre com a nova senha para continuar.
              </p>
              <Button asChild className="mt-6 w-full gradient-primary text-primary-foreground">
                <Link to="/">Voltar ao início</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl">Criar nova senha</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha uma senha com ao menos 8 caracteres.
              </p>
              {!token && (
                <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  Link inválido ou expirado. Peça um novo link na tela de login.
                </p>
              )}
              {mutation.isError && (
                <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {mutation.error instanceof ApiError
                    ? mutation.error.message
                    : "Não foi possível redefinir."}
                </p>
              )}
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nova">Nova senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="nova"
                      type="password"
                      value={nova}
                      onChange={(e) => setNova(e.target.value)}
                      className="h-11 rounded-xl pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conf">Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="conf"
                      type="password"
                      value={conf}
                      onChange={(e) => setConf(e.target.value)}
                      className="h-11 rounded-xl pl-10"
                    />
                  </div>
                </div>
                <Button
                  className="w-full gradient-primary text-primary-foreground shadow-soft"
                  disabled={!token || mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Salvar nova senha
                </Button>
              </div>
            </>
          )}
        </Card>
      </section>
      <Rodape />
    </div>
  );
}
