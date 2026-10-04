import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle, MapPin, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Rodape() {
  const { usuario } = useAuth();
  return (
    <footer className="mt-20 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <p className="font-script text-4xl">Ana Clara Nails</p>
          <p className="mt-2 max-w-xs text-sm opacity-80">
            Unhas feitas com carinho, do jeitinho que você sonhou.
          </p>
        </div>
        <div className="space-y-2 text-sm opacity-90">
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" />
            <span>QE 44 Conjunto J Casa 07 - Guará II - DF</span>
          </p>
          <p className="flex items-center gap-2">
            <MessageCircle className="size-4 shrink-0" />
            <span>(61) 98509-2748</span>
          </p>
          <p className="flex items-center gap-2">
            <Instagram className="size-4 shrink-0" />
            <span>@aclaranails._</span>
          </p>
        </div>
        <div className="text-sm opacity-90">
          <p className="font-medium">Horário</p>
          <p className="mt-1">Ter a Sáb · 9h às 19h</p>
          <p className="mt-4 flex items-center gap-1 opacity-70">
            Feito com <Heart className="size-3 fill-current" /> para você
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Link to="/catalogo" className="hover:underline">Catálogo</Link>
            <Link to="/agendamento" className="hover:underline">Agendar horário</Link>
            <Link to="/meus-dados" className="hover:underline">Meus dados</Link>
            {usuario?.perfil === "admin" && (
              <Link to="/admin" className="hover:underline">Área da profissional</Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
