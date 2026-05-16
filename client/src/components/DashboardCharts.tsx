import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, DollarSign, Award } from "lucide-react";

interface ChartsData {
  studentGrowth: { month: string; count: number }[];
  monthlyRevenue: { month: string; total: number }[];
  beltDistribution: { belt: string; count: number }[];
}

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatMonth(yyyyMm: string) {
  const [year, month] = yyyyMm.split('-');
  return `${PT_MONTHS[parseInt(month) - 1]}/${year.slice(2)}`;
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

const BELT_COLORS: Record<string, string> = {
  branca: '#e5e7eb',
  cinza: '#9ca3af',
  amarela: '#facc15',
  laranja: '#f97316',
  verde: '#16a34a',
  azul: '#2563eb',
  roxa: '#7c3aed',
  marrom: '#92400e',
  preta: '#111827',
  coral: '#b91c1c',
  vermelha: '#dc2626',
};

function beltColor(belt: string) {
  return BELT_COLORS[belt.toLowerCase()] ?? '#6b7280';
}

export function DashboardCharts() {
  const { data, isLoading } = useQuery<ChartsData>({
    queryKey: ['/api/dashboard/charts'],
  });

  const growth = (data?.studentGrowth ?? []).map(d => ({ ...d, month: formatMonth(d.month) }));
  const revenue = (data?.monthlyRevenue ?? []).map(d => ({ ...d, month: formatMonth(d.month) }));
  const belts = data?.beltDistribution ?? [];

  const hasGrowth = growth.length > 0;
  const hasRevenue = revenue.length > 0;
  const hasBelts = belts.length > 0;
  const hasAny = hasGrowth || hasRevenue || hasBelts;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="h-64 flex items-center justify-center">
              <div className="animate-pulse w-full h-40 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum dado suficiente para exibir gráficos ainda. Cadastre alunos e registre pagamentos para visualizar as tendências.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

      {/* Crescimento de Alunos */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Novos Alunos / Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasGrowth ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={growth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [v, 'Novos alunos']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Sem novos alunos nos últimos 6 meses
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receita Mensal */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Receita Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasRevenue ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenue} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R$${(v / 100).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(v: number) => [formatBRL(v), 'Receita']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Sem pagamentos registrados nos últimos 6 meses
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribuição de Faixas */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-500" />
            Distribuição de Faixas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasBelts ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={belts} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="belt" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  formatter={(v: number) => [v, 'Alunos']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {belts.map(entry => (
                    <Cell key={entry.belt} fill={beltColor(entry.belt)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Nenhum aluno com faixa cadastrada
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
