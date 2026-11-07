import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  Images,
  Users,
  Clock,
  LogOut,
  X,
  Search,
  Menu,
  Home,
  Plus,
  Loader2,
  ShieldCheck,
  MessageCircle,
  KeyRound,
  User,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AuthModais, type ModoAuth } from "@/components/auth-modais";
import { SinoNotificacoes } from "@/components/admin/SinoNotificacoes";
import { useAuth } from "@/lib/auth";
import { atualizarAdministradorApi, criarAdministradorApi } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

const nav = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { to: "/admin/catalogo", label: "Catálogo", icon: Images },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/mensagens", label: "Mensagens", icon: MessageCircle },
  { to: "/admin/horarios", label: "Horários", icon: Clock },
] as const;

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [openNav, setOpenNav] = useState(false);
  const [authAberto, setAuthAberto] = useState(false);
  const [modoAuth, setModoAuth] = useState<ModoAuth>("login");
  const [adminAberto, setAdminAberto] = useState(false);
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminSenha, setAdminSenha] = useState("");

  const [senhaAberto, setSenhaAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  const { usuario, entrar, cadastrar, sair, ehAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const novoAdminMutation = useMutation({
    mutationFn: async () => {
      if (!adminNome.trim() || !adminEmail.trim() || !adminSenha) {
        throw new ApiError(400, "Preencha nome, email e senha.");
      }
      return criarAdministradorApi({ nome: adminNome.trim(), email: adminEmail.trim(), password: adminSenha, type_user_id: 1 });
    },
    onSuccess: () => {
      toast.success("Administrador adicionado com sucesso");
      setAdminAberto(false);
      setAdminNome("");
      setAdminEmail("");
      setAdminSenha("");
      void queryClient.invalidateQueries();
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível adicionar admin.");
    },
  });

  const mudarSenhaMutation = useMutation({
    mutationFn: async () => {
      if (!novaSenha || novaSenha.length < 8) {
        throw new ApiError(400, "A nova senha deve ter no mínimo 8 caracteres.");
      }
      if (novaSenha !== confirmaSenha) {
        throw new ApiError(400, "As senhas não coincidem.");
      }
      if (!usuario?.id) {
        throw new ApiError(400, "Sessão inválida.");
      }
      return atualizarAdministradorApi(usuario.id, { password: novaSenha });
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setSenhaAberto(false);
      setNovaSenha("");
      setConfirmaSenha("");
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : "Não foi possível alterar a senha.");
    },
  });

  const handleAdminDialogChange = (o: boolean) => {
    setAdminAberto(false);
    if (!o) {
      setAdminNome("");
      setAdminEmail("");
      setAdminSenha("");
    }
  };

  const handleSenhaDialogChange = (o: boolean) => {
    setSenhaAberto(false);
    if (!o) {
      setNovaSenha("");
      setConfirmaSenha("");
    }
  };

  if (!ehAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card">
          <div className="bg-gradient-primary px-8 py-9 text-center text-primary-foreground">
            <ShieldCheck className="mx-auto size-7" />
            <p className="mt-3 font-display text-2xl">Área da profissional</p>
            <p className="text-xs uppercase tracking-[0.3em] text-primary-foreground/80">
              Acesso administrativo
            </p>
          </div>
          <div className="space-y-4 px-8 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {usuario
                ? `Você está logada como ${usuario.nome} (cliente). O painel é exclusivo da administradora.`
                : "Entre com a conta da profissional para gerenciar agenda, catálogo e clientes."}
            </p>
            {!usuario ? (
              <button
                onClick={() => {
                  setModoAuth("login");
                  setAuthAberto(true);
                }}
                className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
              >
                Entrar como profissional
              </button>
            ) : null}
            <button
              onClick={() => navigate({ to: "/" })}
              className="w-full text-sm text-muted-foreground hover:text-primary"
            >
              Voltar à página inicial
            </button>
          </div>
        </div>
        <AuthModais
          open={authAberto}
          modo={modoAuth}
          onOpenChange={setAuthAberto}
          onModo={setModoAuth}
          onEntrar={entrar}
          onCadastrar={cadastrar}
        />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="flex">
          {/* Overlay escuro em mobile quando a barra lateral estiver aberta */}
          {openNav && (
            <div
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
              onClick={() => setOpenNav(false)}
            />
          )}

          <aside
            className={`fixed inset-y-0 left-0 z-40 w-64 flex-col justify-between bg-sidebar px-4 py-6 text-sidebar-foreground transition-transform lg:flex lg:translate-x-0 ${
              openNav ? "flex translate-x-0" : "hidden -translate-x-full"
            }`}
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between px-2">
                  <Link to="/admin" onClick={() => setOpenNav(false)} className="flex items-center gap-2">
                    <img
                      src="/icons/logo-ana-clara.png"
                      alt="Ana Clara Nails"
                      width={884}
                      height={762}
                      className="h-12 w-auto rounded-xl bg-white px-2 py-1 shadow-xs"
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenNav(false)}
                    className="lg:hidden flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label="Fechar menu"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <nav className="mt-8 space-y-1">
                  {nav.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpenNav(false)}
                      activeOptions={{ exact: item.to === "/admin" }}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeProps={{
                        className:
                          "bg-gradient-primary text-sidebar-primary-foreground shadow-soft font-medium",
                      }}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <div className="pt-2">
                    <Link
                      to="/"
                      onClick={() => setOpenNav(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <Home className="size-4 shrink-0" />
                      <span>Ver site</span>
                    </Link>
                  </div>
                </nav>
              </div>

              <div className="space-y-3 pt-4 border-t border-sidebar-border/60">
                <button
                  onClick={() => {
                    setOpenNav(false);
                    setSenhaAberto(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <KeyRound className="size-4 shrink-0 text-primary" />
                  <span>Mudar minha senha</span>
                </button>
                <button
                  onClick={() => {
                    setOpenNav(false);
                    setAdminAberto(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Plus className="size-4 shrink-0 text-primary" />
                  <span>Adicionar admin</span>
                </button>
                <button
                  onClick={() => {
                    sair();
                    navigate({ to: "/" });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-4 shrink-0" />
                  <span>Sair da conta</span>
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 lg:pl-64">
            <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border p-1.5 lg:hidden"
                    onClick={() => setOpenNav((v) => !v)}
                    aria-label="Abrir menu"
                  >
                    <Menu className="size-5" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <h1 className="truncate font-display text-lg text-foreground sm:text-2xl">
                      {title}
                    </h1>
                    <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 md:flex">
                    <Search className="size-3.5 text-muted-foreground" />
                    <input
                      placeholder="Buscar..."
                      className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground lg:w-48"
                    />
                  </div>

                  <SinoNotificacoes />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 rounded-xl bg-card p-1.5 sm:px-2.5 sm:py-1.5 shadow-xs border border-border/60 hover:bg-accent/40 transition">
                        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-primary font-display text-xs text-primary-foreground">
                          {usuario?.nome?.slice(0, 2).toUpperCase() || "AC"}
                        </span>
                        <div className="hidden text-left leading-tight sm:block">
                          <p className="max-w-28 truncate text-xs font-medium">{usuario?.nome}</p>
                          <p className="text-[10px] text-muted-foreground">Admin</p>
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 shadow-card">
                      <DropdownMenuLabel className="font-normal px-2 py-1.5">
                        <p className="text-xs font-semibold">{usuario?.nome}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{usuario?.email}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setSenhaAberto(true)}
                        className="cursor-pointer rounded-xl text-xs flex items-center gap-2 py-2"
                      >
                        <KeyRound className="size-3.5 text-primary" /> Mudar senha
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setAdminAberto(true)}
                        className="cursor-pointer rounded-xl text-xs flex items-center gap-2 py-2"
                      >
                        <Plus className="size-3.5 text-primary" /> Adicionar admin
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          sair();
                          navigate({ to: "/" });
                        }}
                        className="cursor-pointer rounded-xl text-xs text-destructive flex items-center gap-2 py-2"
                      >
                        <LogOut className="size-3.5" /> Sair da conta
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            <div className="space-y-5 px-3.5 pb-10 pt-4 sm:space-y-7 sm:px-6 sm:pb-14 sm:pt-6">
              {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Modal Mudar Senha */}
      <Dialog open={senhaAberto} onOpenChange={handleSenhaDialogChange}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> Mudar senha do administrador
            </DialogTitle>
            <DialogDescription>
              Atualize a sua senha de acesso ao painel de administração.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <Button
            className="w-full gradient-primary text-primary-foreground shadow-soft"
            disabled={mudarSenhaMutation.isPending}
            onClick={() => mudarSenhaMutation.mutate()}
          >
            {mudarSenhaMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Salvar nova senha
          </Button>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Administrador */}
      <Dialog open={adminAberto} onOpenChange={handleAdminDialogChange}>
        <DialogContent className="max-w-md rounded-3xl border-border/70 bg-card shadow-card">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Adicionar administrador</DialogTitle>
            <DialogDescription>Crie uma nova conta de acesso administrativo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} placeholder="Nome completo" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={adminSenha} onChange={(e) => setAdminSenha(e.target.value)} placeholder="Mínimo 8 caracteres" className="h-11 rounded-xl" />
            </div>
          </div>
          <Button
            className="w-full gradient-primary text-primary-foreground shadow-soft"
            disabled={novoAdminMutation.isPending}
            onClick={() => novoAdminMutation.mutate()}
          >
            {novoAdminMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Adicionar admin
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-border/70 bg-card p-6 shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl">{title}</h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Pill({ label, tone = "muted" }: { label: string; tone?: string }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-accent text-accent-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tones[tone] ?? tones["muted"]}`}
    >
      {label}
    </span>
  );
}

export function statusTone(status: string) {
  if (status === "Confirmado" || status === "Concluído" || status === "Aprovado")
    return "success";
  if (status === "Aguardando sinal" || status === "Pendente" || status === "Remarcado")
    return "warning";
  if (status === "Cancelado" || status === "Estornado") return "danger";
  return "primary";
}

export function PrimaryButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {children}
    </button>
  );
}
