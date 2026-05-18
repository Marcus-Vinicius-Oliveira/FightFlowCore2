import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, DollarSign, Award } from "lucide-react";
import { BeltBar, BELT_HEX, isLightHex } from "@/components/BeltBadge";

interface ModalityRankEntry {
  modality: string;
  rank: string;
  colorClass: string;
  displayOrder: number;
  count: number;
}

interface ChartsData {
  studentGrowth: { month: string; count: number }[];
  monthlyRevenue: { month: string; total: number }[];
  modalityRankDistribution: ModalityRankEntry[];
}

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatMonth(yyyyMm: string) {
  const [year, month] = yyyyMm.split('-');
  return `${PT_MONTHS[parseInt(month) - 1]}/${year.slice(2)}`;
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function beltColor(belt: string) {
  return BELT_HEX[belt.toLowerCase()] ?? '#6b7280';
}

// colorClass pode ser "#hex" (monocolor) ou "#hex|#hex" (bicolor)
type RankBar = {
  rank: string;
  count: number;
  color: string;      // primeira cor — usada no Recharts Cell (SVG não suporta bicolor nativo)
  colorClass: string; // string completa, ex: "#dc2626|#dbeafe" — usada no BeltBar e na barra mobile
  displayOrder: number;
};

// ─── Barra de progresso mobile ─────────────────────────────────────────────
// Substitui o eixo Y do Recharts em telas pequenas.
// Suporta bicolor (colorClass com '|').
function ProgressBarList({
  items,
}: {
  items: { label: string; count: number; color: string; colorClass?: string }[];
}) {
  const max = Math.max(...items.map(i => i.count), 1);

  return (
    <div className="space-y-3">
      {items.map(item => {
        const cls = item.colorClass ?? item.color;
        const parts = cls.split('|');
        const c1 = parts[0];
        const c2 = parts[1] ?? null;
        const isBicolor = !!c2;
        const pct = `${Math.max((item.count / max) * 100, 4)}%`;
        const needsBorder = isLightHex(c1) || (c2 ? isLightHex(c2) : false);

        return (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2">
                {/* BeltBar já suporta bicolor nativamente via string com '|' */}
                <BeltBar color={cls} name={item.label} width={22} height={9} />
                <span className="font-medium leading-none">{item.label}</span>
              </div>
              <span className="tabular-nums font-semibold ml-2 shrink-0">{item.count}</span>
            </div>

            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              {isBicolor ? (
                // Bicolor: dois spans lado a lado dentro do wrapper proporcional
                <div
                  className="h-full flex rounded-full overflow-hidden"
                  style={{
                    width: pct,
                    boxShadow: needsBorder ? 'inset 0 0 0 1px #d1d5db' : 'none',
                  }}
                >
                  <span style={{ flex: 1, backgroundColor: c1 }} />
                  <span style={{ flex: 1, backgroundColor: c2! }} />
                </div>
              ) : (
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: pct,
                    backgroundColor: c1,
                    boxShadow: needsBorder ? 'inset 0 0 0 1px #d1d5db' : 'none',
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardCharts() {
  const [activeModality, setActiveModality] = useState('');

  const { data, isLoading } = useQuery<ChartsData>({
    queryKey: ['/api/dashboard/charts'],
  });

  const growth = (data?.studentGrowth ?? []).map(d => ({ ...d, month: formatMonth(d.month) }));
  const revenue = (data?.monthlyRevenue ?? []).map(d => ({ ...d, month: formatMonth(d.month) }));
  const modalityRaw = data?.modalityRankDistribution ?? [];

  // Agrupa por modalidade, preserva colorClass completa (incluindo bicolor)
  const modalityData: Record<string, RankBar[]> = {};
  for (const entry of modalityRaw) {
    if (!modalityData[entry.modality]) modalityData[entry.modality] = [];
    const colorClass = entry.colorClass ?? '';
    const firstColor = colorClass.split('|')[0];
    modalityData[entry.modality].push({
      rank: entry.rank,
      count: entry.count,
      color: firstColor.startsWith('#') ? firstColor : beltColor(entry.rank.toLowerCase()),
      colorClass,
      displayOrder: entry.displayOrder,
    });
  }
  for (const mod of Object.keys(modalityData)) {
    modalityData[mod].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  const modalityNames = Object.keys(modalityData);
  const currentModality = (activeModality && modalityData[activeModality])
    ? activeModality
    : (modalityNames[0] ?? '');
  const activeData = modalityData[currentModality] ?? [];

  const hasGrowth = growth.length > 0;
  const hasRevenue = revenue.length > 0;
  const hasModality = modalityNames.length > 0;
  const hasAny = hasGrowth || hasRevenue || hasModality;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map(i => (
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full min-w-0">

      {/* Crescimento de Alunos */}
      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Novos Alunos / Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasGrowth ? (
            <div className="w-full min-w-0">
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
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Sem novos alunos nos últimos 6 meses
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receita Mensal */}
      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Receita Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasRevenue ? (
            <div className="w-full min-w-0">
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
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Sem pagamentos registrados nos últimos 6 meses
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graduações por Modalidade */}
      {hasModality && (
        <Card className="col-span-1 md:col-span-2 min-w-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-500" />
                Graduações por Modalidade
              </CardTitle>
              <Tabs value={currentModality} onValueChange={setActiveModality}>
                <TabsList className="h-7">
                  {modalityNames.map(mod => (
                    <TabsTrigger key={mod} value={mod} className="px-3 text-xs h-5">
                      {mod}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {activeData.length > 0 ? (
              <>
                {/* Mobile: lista com barras de progresso — suporte bicolor */}
                <div className="block md:hidden">
                  <ProgressBarList
                    items={activeData.map(e => ({
                      label: e.rank,
                      count: e.count,
                      color: e.color,
                      colorClass: e.colorClass, // preserva string completa ex: "#dc2626|#dbeafe"
                    }))}
                  />
                </div>

                {/* Desktop: gráfico Recharts */}
                <div className="hidden md:block w-full min-w-0">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(160, activeData.length * 38)}
                  >
                    <BarChart
                      layout="vertical"
                      data={activeData}
                      margin={{ top: 2, right: 32, left: 8, bottom: 2 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="rank"
                        tick={{ fontSize: 12, fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        formatter={(v: number) => [v, 'Alunos']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" radius={[0, 5, 5, 0]} maxBarSize={28}>
                        {activeData.map(entry => (
                          <Cell
                            key={entry.rank}
                            fill={entry.color}
                            stroke={isLightHex(entry.color) ? '#d1d5db' : 'none'}
                            strokeWidth={isLightHex(entry.color) ? 1 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhum aluno graduado em {currentModality}
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
