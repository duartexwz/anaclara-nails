import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listarAgendamentosApi,
  listarClientesApi,
  listarModelosApi,
  listarStatusApi,
  type AgendamentoApi,
  type ClienteApi,
} from "@/lib/api";
import {
  fmtDataCurta,
  mapModeloApi,
  statusExibicao,
  type StatusAgendamento,
} from "@/lib/dados";

export type AgendamentoExibicao = {
  id: number;
  cliente: string;
  telefone: string;
  modelo: string;
  data: string;
  dataISO: string;
  hora: string;
  valor: number;
  sinal: number;
  pagamento: string;
  status: StatusAgendamento;
  statusId: number | null;
  clienteId: number;
  modeloId: number | null;
  raw: AgendamentoApi;
};

export function juntarAgenda(
  agendamentos: AgendamentoApi[],
  clientes: ClienteApi[],
  statusNome: Record<number, string>,
  modelos: { id: number; nome: string; preco: number }[],
): AgendamentoExibicao[] {
  return agendamentos.map((a) => {
    const cliente = clientes.find((c) => c.id === a.cliente_id);
    const modelo = modelos.find((m) => m.id === a.modelo_id);
    const nomeStatus =
      a.status_pagamentos_id != null ? statusNome[a.status_pagamentos_id] : null;
    const pago = nomeStatus === "Pago";
    return {
      id: a.id,
      cliente: cliente?.nome ?? `Cliente #${a.cliente_id}`,
      telefone: cliente?.telefone ?? "—",
      modelo: modelo?.nome ?? "Modelo",
      data: fmtDataCurta(a.data),
      dataISO: a.data ?? "",
      hora: a.horario.slice(0, 5),
      valor: modelo ? modelo.preco : a.sinal * 2,
      sinal: a.sinal,
      pagamento: pago ? "Sinal aprovado" : "Aguardando sinal",
      status: statusExibicao(nomeStatus),
      statusId: a.status_pagamentos_id,
      clienteId: a.cliente_id,
      modeloId: a.modelo_id,
      raw: a,
    };
  });
}

/** Agenda do painel com nomes resolvidos (clientes, modelos, status). */
export function useAgenda() {
  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos"],
    queryFn: listarAgendamentosApi,
  });
  const clientesQuery = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listarClientesApi(),
  });
  const modelosQuery = useQuery({
    queryKey: ["modelos"],
    queryFn: listarModelosApi,
  });
  const statusQuery = useQuery({
    queryKey: ["status"],
    queryFn: listarStatusApi,
  });

  const statusNome = useMemo(() => {
    const mapa: Record<number, string> = {};
    for (const s of statusQuery.data ?? []) mapa[s.id] = s.nome;
    return mapa;
  }, [statusQuery.data]);

  const modelos = useMemo(
    () => (modelosQuery.data ?? []).map(mapModeloApi),
    [modelosQuery.data],
  );

  const itens = useMemo(
    () =>
      juntarAgenda(
        agendamentosQuery.data ?? [],
        clientesQuery.data ?? [],
        statusNome,
        modelos,
      ),
    [agendamentosQuery.data, clientesQuery.data, statusNome, modelos],
  );

  return {
    itens,
    modelos,
    clientes: clientesQuery.data ?? [],
    statusNome,
    isPending:
      agendamentosQuery.isPending ||
      clientesQuery.isPending ||
      modelosQuery.isPending,
    isError:
      agendamentosQuery.isError ||
      clientesQuery.isError ||
      modelosQuery.isError,
  };
}
