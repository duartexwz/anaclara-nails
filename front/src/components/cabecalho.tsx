import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Sparkles, LogIn, LogOut, ShieldCheck, Download } from "lucide-react";
import { AuthModais, type ModoAuth } from "@/components/auth-modais";
import { useAuth } from "@/lib/auth";
import { useInstalavel, solicitarInstalacao } from "@/lib/pwa";
import { toast } from "sonner";

const navegacao = [
  { para: "/", rotulo: "Home" },
  { para: "/catalogo", rotulo: "Catálogo" },
  { para: "/agendamento", rotulo: "Agendamento" },
  { para: "/mensagens", rotulo: "Mensagens" },
  { para: "/meus-dados", rotulo: "Meus dados" },
] as const;

export function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<ModoAuth>("login");
  const [menu, setMenu] = useState(false);
  const { usuario, entrar, cadastrar, sair } = useAuth();
  const instalavel = useInstalavel();

  const instalar = async () => {
    const ok = await solicitarInstalacao();
    if (ok) toast.success("App instalado! Procure o ícone na tela inicial.");
    setMenu(false);
  };

  const abrir = (m: ModoAuth) => {
    setModo(m);
    setAberto(true);
    setMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full gradient-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg">Ana Clara</span>
            <span className="block text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">Nails</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {navegacao.map((item) => (
            <Link
              key={item.para}
              to={item.para}
              className="text-muted-foreground transition-colors hover:text-primary"
              activeProps={{ className: "text-primary font-medium" }}
              activeOptions={{ exact: item.para === "/" }}
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {/* Aba Painel: visível somente após login E só para administradora (RF18) */}
          {usuario?.perfil === "admin" && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link to="/admin">
                <ShieldCheck className="mr-1 size-4" /> Painel
              </Link>
            </Button>
          )}
          {instalavel && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={instalar} title="Instalar o app no aparelho">
              <Download className="mr-1 size-4" /> Instalar app
            </Button>
          )}
          {usuario ? (
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-primary font-display text-xs text-primary-foreground">
                {usuario.nome.slice(0, 2).toUpperCase()}
              </span>
              <span className="max-w-28 truncate text-sm font-medium">{usuario.nome}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={sair}
                title="Sair da conta"
              >
                <LogOut className="mr-1 size-4" /> Sair
              </Button>
            </div>
          ) : (
            <Button size="sm" className="gradient-primary text-primary-foreground shadow-soft" onClick={() => abrir("login")}>
              <LogIn className="mr-1 size-4" /> Entrar
            </Button>
          )}
        </div>

        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-72">
            <nav className="mt-8 flex flex-col gap-1">
              {navegacao.map((item) => (
                <Link
                  key={item.para}
                  to={item.para}
                  onClick={() => setMenu(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                  activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
                  activeOptions={{ exact: item.para === "/" }}
                >
                  {item.rotulo}
                </Link>
              ))}
              {usuario?.perfil === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setMenu(false)}
                  className="rounded-xl px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                >
                  Painel administrativo
                </Link>
              )}
              {instalavel && (
                <button
                  onClick={instalar}
                  className="flex items-center gap-2 rounded-xl bg-gradient-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-soft"
                >
                  <Download className="size-4" /> Instalar app no aparelho
                </button>
              )}
              {usuario ? (
                <>
                  <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                    <span className="flex size-7 items-center justify-center rounded-full bg-gradient-primary font-display text-[0.65rem] text-primary-foreground">
                      {usuario.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate font-medium">{usuario.nome}</span>
                  </div>
                  <Button
                    variant="ghost"
                    className="justify-start text-muted-foreground"
                    onClick={() => {
                      sair();
                      setMenu(false);
                    }}
                  >
                    <LogOut className="mr-2 size-4" /> Sair da conta
                  </Button>
                </>
              ) : (
                <Button className="mt-4 gradient-primary text-primary-foreground" onClick={() => abrir("login")}>
                  Entrar
                </Button>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <AuthModais open={aberto} modo={modo} onOpenChange={setAberto} onModo={setModo} onEntrar={entrar} onCadastrar={cadastrar} />
    </header>
  );
}