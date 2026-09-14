import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Rodape() {
  const { usuario } = useAuth();
  return (
    <footer className="mt-20 border-t border-border/70 bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full gradient-primary text-primary-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <span className="font-display text-lg">Ana Clara Nails</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Nail design autoral em Brasília. Agendamento online com sinal de 50% para garantir seu horário.
          </p>
        </div>
        <div className="text-sm">
          <h3 className="font-display text-base">Navegação</h3>
          <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
            <Link to="/catalogo" className="hover:text-primary">Catálogo</Link>
            <Link to="/agendamento" className="hover:text-primary">Agendar horário</Link>
            <Link to="/meus-dados" className="hover:text-primary">Meus dados</Link>
            {usuario?.perfil === "admin" && (
              <Link to="/admin" className="hover:text-primary">Área da profissional</Link>
            )}
          </div>
        </div>
        <div className="text-sm">
          <h3 className="font-display text-base">Atendimento</h3>
          <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
            <span className="flex items-center gap-2"><MapPin className="size-4" />QE 44 Conjunto J Casa 07 - Guará II - DF </span>
            <span className="flex items-center gap-2"><MessageCircle className="size-4" /> (61) 98509-2748</span>
            <span className="flex items-center gap-2"><Instagram className="size-4" /> @aclaranails._</span>
          </div>
        </div>
      </div>
      {/* <div className="border-t border-border/70 px-4 py-4 text-center text-xs text-muted-foreground">
        Protótipo de telas · Documento de Levantamento de Requisitos v1.0
      </div> */}
    </footer>
  );
}
