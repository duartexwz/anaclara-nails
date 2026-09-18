import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loginApi, logoutApi, meApi, registerApi } from "./api";
import { NonBinary } from "lucide-react";

/**
 * Sessão real via API (RF01/RF02/RF18).
 * Papéis: "cliente" (fluxo normal) e "admin" (administrador cadastrado na tabela administradores).
 * A aba "Painel" do cabeçalho só aparece quando há sessão de admin.
 */

export type Perfil = "cliente" | "admin";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  is_admin: boolean;
  perfil: Perfil;
};

type AuthContexto = {
  usuario: Usuario | null;
  carregandoSessao: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => void;
  ehAdmin: boolean;
};

const Ctx = createContext<AuthContexto | null>(null);

function nomeDoEmail(email: string): string {
  const prefixo = email.split("@")[0] ?? "cliente";
  const nome = prefixo
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return nome || "Cliente";
}

function mapearUsuario(api: { id: number; nome: string; email: string; type_user_id: number; is_admin: boolean }): Usuario {
  return {
    id: api.id,
    email: api.email,
    nome: api.nome?.trim() ? api.nome : nomeDoEmail(api.email),
    is_admin: api.is_admin,
    perfil: api.is_admin ? "admin" : "cliente",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    let ativo = true;
    meApi()
      .then((u) => {
        if (ativo) setUsuario(mapearUsuario(u));
      })
      .catch(() => {
        if (ativo) setUsuario(null);
      })
      .finally(() => {
        if (ativo) setCarregandoSessao(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = async (email: string, senha: string) => {
    const u = await loginApi(email, senha);
    setUsuario(mapearUsuario(u));
  };

  const cadastrar = async (nome: string, email: string, senha: string) => {
    await registerApi({ nome: nome, email: email, password: senha });
    const u = await loginApi(email, senha);
    const base = mapearUsuario(u);
    setUsuario(nome.trim() ? { ...base, nome: nome.trim() } : base);
  };

  const sair = () => {
    setUsuario(null);
    void logoutApi();
  };

  return (
    <Ctx.Provider
      value={{ usuario, carregandoSessao, entrar, cadastrar, sair, ehAdmin: usuario?.is_admin ?? false }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
