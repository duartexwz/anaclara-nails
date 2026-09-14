import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  Images,
  Users,
  Clock,
  LogOut,
  Search,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AuthModais, type ModoAuth } from "@/components/auth-modais";
import { SinoNotificacoes } from "@/components/admin/SinoNotificacoes";
import { useAuth } from "@/lib/auth";

const nav = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { to: "/admin/catalogo", label: "Gestão de catálogo", icon: Images },
  { to: "/admin/clientes", label: "Controle de clientes", icon: Users },
  { to: "/admin/horarios", label: "Dias e horários", icon: Clock },
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
  const { usuario, entrar, cadastrar, sair } = useAuth();
  const navigate = useNavigate();

  // Gate de acesso (RF18): sem sessão de admin, exibe tela de entrada
  // em vez do conteúdo do painel.
  if (usuario?.perfil !== "admin") {
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
            <button
              onClick={() => {
                setModoAuth("login");
                setAuthAberto(true);
              }}
              className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              Entrar como profissional
            </button>
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
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 flex-col justify-between bg-sidebar px-5 py-7 text-sidebar-foreground transition-transform lg:flex lg:translate-x-0 ${
            openNav ? "flex translate-x-0" : "hidden -translate-x-full"
          }`}
        >
          <div>
            <div className="px-2">
              <p className="font-display text-2xl leading-tight">Ana Clara</p>
              <p className="text-xs uppercase tracking-[0.35em] text-sidebar-foreground/60">
                Nails Studio
              </p>
            </div>

            <nav className="mt-10 space-y-1.5">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpenNav(false)}
                  activeOptions={{ exact: item.to === "/admin" }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeProps={{
                    className:
                      "bg-gradient-primary text-sidebar-primary-foreground shadow-soft font-medium",
                  }}
                >
                  <item.icon className="size-4.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-sidebar-border bg-sidebar-accent/50 p-4">
              <p className="font-display text-base">Sinal de 50%</p>
              <p className="mt-1 text-xs text-sidebar-foreground/70">
                Agendamentos são confirmados somente após aprovação do sinal.
              </p>
            </div>
            <button
              onClick={() => {
                sair();
                navigate({ to: "/" });
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4.5" />
              Sair da conta
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
            <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-8">
              <button
                className="rounded-xl border border-border p-2 lg:hidden"
                onClick={() => setOpenNav((v) => !v)}
                aria-label="Abrir menu"
              >
                <Menu className="size-5" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-2xl text-foreground sm:text-3xl">
                  {title}
                </h1>
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              </div>

              <div className="hidden items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 md:flex">
                <Search className="size-4 text-muted-foreground" />
                <input
                  placeholder="Buscar cliente ou modelo"
                  className="w-52 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <SinoNotificacoes />

              <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2 shadow-card">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-primary font-display text-sm text-primary-foreground">
                  AC
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-medium">Ana Clara</p>
                  <p className="text-xs text-muted-foreground">Administradora</p>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-8 px-5 pb-16 pt-7 sm:px-8">
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
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
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${className}`}
    >
      {children}
    </button>
  );
}