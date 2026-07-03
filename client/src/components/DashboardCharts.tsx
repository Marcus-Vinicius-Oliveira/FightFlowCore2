import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
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

// ─── Barra de progresso moderna ───────────────────────────────────────────────
// Label + contagem acima da barra; barra 100% largura com trilha cinza.
// Suporta bicolor (colorClass com '|') com efeito de profundidade.
function ProgressBarList({
  items,
}: {
  items: { label: string; count: number; color: string; colorClass?: string }[];
}) {
  const max = Math.max(...items.map(i => i.count), 1);

  return (
    <div className="space-y-4">
      {items.map(item => {
        const cls = item.colorClass ?? item.color;
        const parts = cls.split('|');
        const c1 = parts[0];
        const c2 = parts[1] ?? null;
        const isBicolor = !!c2;
        const pct = Math.max((item.count / max) * 100, 3);
        const isLight = isLightHex(c1) || (c2 ? isLightHex(c2) : false);
        const countLabel = `${item.count} ${item.count === 1 ? 'aluno' : 'alunos'}`;

        return (
          <div key={item.label} className="space-y-1.5">
            {/* Linha de cabeçalho: badge + nome à esquerda, contagem à direita */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BeltBar color={cls} name={item.label} width={24} height={10} />
                <span className="text-sm font-semibold leading-tight truncate">{item.label}</span>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-muted-foreground uppercase tracking-wider shrink-0">
                {countLabel}
              </span>
            </div>

            {/* Trilha + preenchimento — h-3 com cantos totalmente arredondados */}
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              {isBicolor ? (
                <div
                  className="h-full flex rounded-full overflow-hidden transition-all duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    filter: isLight ? 'none' : 'saturate(1.4) brightness(1.06)',
                    boxShadow: isLight ? 'inset 0 0 0 1px #d1d5db' : 'none',
                  }}
                >
                  <span style={{ flex: 1, backgroundColor: c1 }} />
                  <span style={{ flex: 1, backgroundColor: c2! }} />
                </div>
              ) : (
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: c1,
                    // Glow externo + reflexo interno no topo para cores escuras
                    filter: isLight ? 'none' : 'saturate(1.4) brightness(1.06)',
                    boxShadow: isLight
                      ? 'inset 0 0 0 1px #d1d5db'
                      : `0 1px 4px ${c1}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
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

  // Auto-scroll: âncora no topo do card de graduações
  const graduationCardRef = useRef<HTMLDivElement>(null);
  // Evita scroll no carregamento inicial (primeira resolução de currentModality)
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Só em mobile/tablet — em desktop o card está sempre visível
    if (window.innerWidth < 1024 && graduationCardRef.current) {
      graduationCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeModality]);

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
            <div className="w-full min-w-0 h-40 md:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-40 md:h-[200px] flex items-center justify-center text-sm text-muted-foreground">
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
            <div className="w-full min-w-0 h-40 md:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-40 md:h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Sem pagamentos registrados nos últimos 6 meses
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graduações por Modalidade */}
      {hasModality && (
        // self-start: impede que o grid force o card a esticar na altura de vizinhos
        <Card ref={graduationCardRef} className="col-span-1 md:col-span-2 min-w-0 self-start">
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
            {/*
              layout: detecta mudança de altura quando o conteúdo troca e anima
              o card inteiro de forma orgânica — sem height fixo, sem overflow.
            */}
            <motion.div layout transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
              {/*
                mode="popLayout": o item que sai é retirado do fluxo imediatamente
                (não empilha com o item que entra), permitindo que o layout pai
                calcule a nova altura sem esperar o fade-out terminar.
              */}
              <AnimatePresence mode="popLayout" initial={false}>
                {activeData.length > 0 ? (
                  <motion.div
                    key={currentModality}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/*
                      ProgressBarList em todos os breakpoints — altura 100% governada
                      pelo CSS (h-auto). Sem cálculo JS, sem overflow interno.
                    */}
                    <ProgressBarList
                      items={activeData.map(e => ({
                        label: e.rank,
                        count: e.count,
                        color: e.color,
                        colorClass: e.colorClass,
                      }))}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`empty-${currentModality}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-center py-12 text-sm text-muted-foreground"
                  >
                    Nenhum aluno graduado em {currentModality}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
