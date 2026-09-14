import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export type PontoSemana = { dia: string; atendimentos: number };

export function GraficoSemana({ dados }: { dados: PontoSemana[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados}>
          <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: "var(--color-accent)" }} />
          <Bar dataKey="atendimentos" fill="var(--color-primary)" radius={[8, 8, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
