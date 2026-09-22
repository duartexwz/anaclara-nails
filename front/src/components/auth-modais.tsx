import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Lock, Mail, Phone, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { ApiError, recuperarSenhaApi } from "@/lib/api";

export type ModoAuth = "login" | "cadastro" | "recuperar";

type Props = {
  open: boolean;
  modo: ModoAuth;
  onOpenChange: (open: boolean) => void;
  onModo: (modo: ModoAuth) => void;
  onEntrar?: (email: string, senha: string) => Promise<void>;
  onCadastrar?: (nome: string, email: string, senha: string) => Promise<void>;
};

export function AuthModais({ open, modo, onOpenChange, onModo, onEntrar, onCadastrar }: Props) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar =
    (acao: (form: HTMLFormElement) => Promise<void>) => async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      setCarregando(true);
      setErro(null);
      try {
        await acao(form);
        onOpenChange(false);
      } catch (err) {
        setErro(
          err instanceof ApiError ? err.message : "Não foi possível continuar. Tente de novo.",
        );
      } finally {
        setCarregando(false);
      }
    };

  const emailDoForm = (form: HTMLFormElement, name: string) =>
    (new FormData(form).get(name)?.toString() ?? "").trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl border-border/70 bg-card p-0">
        <div className="gradient-primary shrink-0 px-4 py-4 text-primary-foreground sm:px-6 sm:py-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] opacity-90">
            <Sparkles className="size-3.5" />
            Ana Clara Nails
          </div>
          <DialogHeader className="mt-2 space-y-1 text-left">
            <DialogTitle className="font-display text-xl sm:text-2xl">
              {modo === "login" && "Bem-vinda de volta"}
              {modo === "cadastro" && "Criar minha conta"}
              {modo === "recuperar" && "Esqueci minha senha"}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              {modo === "login" && "Entre com e-mail e senha para agendar seu horário."}
              {modo === "cadastro" && "Leva menos de um minuto — RF02."}
              {modo === "recuperar" && "Enviaremos um link de redefinição para o seu e-mail."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          {erro && (
            <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {erro}
            </p>
          )}
          {modo === "login" && (
            <form
              className="space-y-4"
              onSubmit={enviar(async (form) => {
                const email = emailDoForm(form, "login-email");
                const senha = emailDoForm(form, "login-senha");
                if (!onEntrar) return;
                await onEntrar(email, senha);
                toast.success("Login realizado com sucesso");
              })}
            >
              <Campo id="login-email" name="login-email" rotulo="E-mail" icone={<Mail className="size-4" />} type="email" />
              <Campo id="login-senha" name="login-senha" rotulo="Senha" icone={<Lock className="size-4" />} type="password" />
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox defaultChecked /> Manter conectada
                </label>
                <button type="button" className="text-primary hover:underline" onClick={() => onModo("recuperar")}>
                  Esqueci minha senha
                </button>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-soft" disabled={carregando}>
                {carregando ? "Entrando..." : "Entrar"}
              </Button>
              <Separator />
              <p className="text-center text-sm text-muted-foreground">
                Ainda não tem conta?{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => onModo("cadastro")}>
                  Criar conta
                </button>
              </p>
            </form>
          )}

          {modo === "cadastro" && (
            <form
              className="space-y-4"
              onSubmit={enviar(async (form) => {
                const nome = emailDoForm(form, "cad-nome");
                const email = emailDoForm(form, "cad-email");
                const senha = emailDoForm(form, "cad-senha");
                if (senha.length < 8) {
                  throw new ApiError(400, "A senha precisa de ao menos 8 caracteres.");
                }
                if (!onCadastrar) return;
                await onCadastrar(nome, email, senha);
                toast.success("Conta criada com sucesso!");
              })}
            >
              <Campo id="cad-nome" name="cad-nome" rotulo="Nome completo" icone={<User className="size-4" />} placeholder="Seu nome" />
              <Campo id="cad-email" name="cad-email" rotulo="E-mail" icone={<Mail className="size-4" />} type="email" placeholder="voce@email.com" />
              <Campo id="cad-tel" name="cad-tel" rotulo="Telefone / WhatsApp" icone={<Phone className="size-4" />} placeholder="(11) 90000-0000" />
              <Campo id="cad-senha" name="cad-senha" rotulo="Senha" icone={<Lock className="size-4" />} type="password" placeholder="Mínimo 8 caracteres" />
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox className="mt-0.5" defaultChecked />
                Autorizo o tratamento dos meus dados conforme a LGPD (RNF02).
              </label>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-soft" disabled={carregando}>
                {carregando ? "Criando conta..." : "Criar conta"}
              </Button>
              <VoltarLogin onModo={onModo} />
            </form>
          )}

          {modo === "recuperar" && (
            <form
              className="space-y-4"
              onSubmit={enviar(async (form) => {
                const email = emailDoForm(form, "rec-email");
                if (!email) throw new ApiError(400, "Informe seu e-mail.");
                await recuperarSenhaApi(email);
                toast.success("Se o e-mail existir, o link foi enviado.");
                onModo("login");
              })}
            >
              <Campo id="rec-email" name="rec-email" rotulo="E-mail cadastrado" icone={<Mail className="size-4" />} type="email" placeholder="voce@email.com" />
              <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
                O link expira em 30 minutos e leva para a tela de nova senha.
              </p>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-soft" disabled={carregando}>
                {carregando ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <VoltarLogin onModo={onModo} />
            </form>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

function VoltarLogin({ onModo }: { onModo: (m: ModoAuth) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
      onClick={() => onModo("login")}
    >
      <ArrowLeft className="size-3.5" /> Voltar para o login
    </button>
  );
}

function Campo({
  id,
  rotulo,
  icone,
  ...props
}: { id: string; rotulo: string; icone: React.ReactNode } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">
        {rotulo}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icone}</span>
        <Input id={id} className="h-11 rounded-xl pl-10" {...props} />
      </div>
    </div>
  );
}