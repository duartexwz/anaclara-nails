import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { limparSessao, loginApi, logoutApi, meApi, registerApi } from "./api";
import { STORAGE_KEYS, obterItem, salvarItem, removerItem } from "./local-storage";

/**
 * Sessão com persistência local em localStorage (RF01/RF02/RF18).
 * Papéis: "cliente" (fluxo normal) e "admin" (administrador cadastrado na tabela administradores).
 * A sessão é restaurada instantaneamente do localStorage para evitar piscadas (FOUC).
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

function mapearUsuario(api: {
  id: number;
  nome?: string | null;
  email: string;
  type_user_id?: number | null;
  is_admin: boolean;
}): Usuario {
  return {
    id: api.id,
    email: api.email,
    nome: api.nome?.trim() ? api.nome : nomeDoEmail(api.email),
    is_admin: api.is_admin,
    perfil: api.is_admin ? "admin" : "cliente",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Inicialização imediata do localStorage para eliminar qualquer atraso perceptível
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    return obterItem<Usuario>(STORAGE_KEYS.USER);
  });
  const [carregandoSessao, setCarregandoSessao] = useState(() => {
    return !obterItem<Usuario>(STORAGE_KEYS.USER);
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    let ativo = true;
    meApi()
      .then((u) => {
        if (ativo) {
          const userMapeado = mapearUsuario(u);
          setUsuario(userMapeado);
          salvarItem(STORAGE_KEYS.USER, userMapeado);
        }
      })
      .catch(() => {
        if (ativo) {
          setUsuario(null);
          removerItem(STORAGE_KEYS.USER);
        }
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
    const userMapeado = mapearUsuario(u);
    setUsuario(userMapeado);
    salvarItem(STORAGE_KEYS.USER, userMapeado);
  };

  const cadastrar = async (nome: string, email: string, senha: string) => {
    await registerApi({ nome: nome, email: email, password: senha });
    const u = await loginApi(email, senha);
    const base = mapearUsuario(u);
    const finalUser = nome.trim() ? { ...base, nome: nome.trim() } : base;
    setUsuario(finalUser);
    salvarItem(STORAGE_KEYS.USER, finalUser);
  };

  const sair = () => {
    setUsuario(null);
    removerItem(STORAGE_KEYS.USER);
    limparSessao();
    queryClient.clear();
    void logoutApi();
  };

  return (
    <Ctx.Provider
      value={{
        usuario,
        carregandoSessao,
        entrar,
        cadastrar,
        sair,
        ehAdmin: usuario?.is_admin ?? false,
      }}
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
