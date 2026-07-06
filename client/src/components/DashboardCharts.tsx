import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, DollarSign, Award, ChevronRight } from "lucide-react";
import { BeltBar, BELT_HEX, isLightHex } from "@/components/BeltBadge";

interface ModalityRankEntry {
  classTypeId: string;
  modality: string;
  rankId: string;
  rank: string;
  colorClass: string;
  displayOrder: number;
  count: number;
}

interface ChartsData {
  studentGrowth: { month: string; count: number }[];
  monthlyRevenue: { month: string; total: number }[];
  modalityRankDistribution: ModalityRankEntry[];
  modalityUnranked?: { classTypeId: string; count: number }[];
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
  rankId: string;
  rank: string;
  count: number;
  color: string;      // primeira cor — usada no Recharts Cell (SVG não suporta bicolor nativo)
  colorClass: string; // string completa, ex: "#dc2626|#dbeafe" — usada no BeltBar e na barra mobile
  displayOrder: number;
};

// ─── Barra empilhada 100% — visão geral da distribuição em um relance ─────────
// Um segmento por faixa, largura proporcional à participação no total.
// Gap de 2px entre segmentos para leitura das divisões; bicolor vira split vertical.
function DistributionStackedBar({
  items,
  total,
}: {
  items: { label: string; count: number; colorClass: string }[];
  total: number;
}) {
  const summary = items.map(i => `${i.label}: ${i.count}`).join(', ');

  return (
    <div
      role="img"
      aria-label={`Distribuição de graduações — ${summary}`}
      className="flex h-4 w-full gap-[2px] rounded-full overflow-hidden"
    >
      {items.map(item => {
        const pct = (item.count / total) * 100;
        const parts = item.colorClass.split('|');
        const c1 = parts[0];
        const c2 = parts[1] ?? null;
        const isLight = isLightHex(c1) || (c2 ? isLightHex(c2) : false);

        return (
          <div
            key={item.label}
            title={`${item.label} — ${item.count} ${item.count === 1 ? 'aluno' : 'alunos'} (${Math.round(pct)}%)`}
            className="h-full transition-[filter] hover:brightness-110"
            style={{
              width: `${pct}%`,
              minWidth: 6,
              background: c2
                ? `linear-gradient(to bottom, ${c1} 0 50%, ${c2} 50% 100%)`
                : c1,
              boxShadow: isLight ? 'inset 0 0 0 1px #d1d5db' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Lista de barras de progresso ─────────────────────────────────────────────
// Barra proporcional à participação no TOTAL da modalidade (não ao máximo da
// lista — evita que uma faixa com 1 aluno pareça dominante). Cada linha é
// clicável e navega para a lista de alunos já filtrada por modalidade + faixa.
function ProgressBarList({
  items,
  total,
  onItemClick,
}: {
  items: { rankId: string; label: string; count: number; color: string; colorClass?: string }[];
  total: number;
  onItemClick?: (rankId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
      {items.map(item => {
        const cls = item.colorClass ?? item.color;
        const parts = cls.split('|');
        const c1 = parts[0];
        const c2 = parts[1] ?? null;
        const isBicolor = !!c2;
        const isEmpty = item.count === 0;
        const realPct = total > 0 ? (item.count / total) * 100 : 0;
        // Piso visual de 3% para faixas raras não sumirem — mas zero é zero
        const pct = isEmpty ? 0 : Math.max(realPct, 3);
        const isLight = isLightHex(c1) || (c2 ? isLightHex(c2) : false);
        const countLabel = isEmpty
          ? 'Nenhum aluno'
          : `${item.count} ${item.count === 1 ? 'aluno' : 'alunos'} · ${Math.round(realPct)}%`;

        return (
          <button
            key={item.label}
            type="button"
            disabled={isEmpty}
            onClick={!isEmpty && onItemClick ? () => onItemClick(item.rankId) : undefined}
            aria-label={isEmpty
              ? `Faixa ${item.label} — nenhum aluno`
              : `Ver alunos com faixa ${item.label} — ${countLabel}`}
            className={`group w-full text-left space-y-1.5 rounded-lg px-2 py-1.5 -mx-2 -my-1.5 transition-colors ${
              isEmpty
                ? 'opacity-45 cursor-default'
                : 'hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none cursor-pointer'
            }`}
          >
            {/* Linha de cabeçalho: badge + nome à esquerda, contagem + chevron à direita */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BeltBar color={cls} name={item.label} width={24} height={10} />
                <span className="text-sm font-semibold leading-tight truncate">{item.label}</span>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground uppercase tracking-wider shrink-0">
                {countLabel}
                {!isEmpty && (
                  <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                )}
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
          </button>
        );
      })}
    </div>
  );
}

export function DashboardCharts() {
  const [activeModality, setActiveModality] = useState('');
  const [, navigate] = useLocation();

  // Auto-scroll: âncora no topo do card de graduações
  const graduationCardRef = useRef<HTMLDivElement>(null);
  // Evita scroll no carregamento inicial (primeira resolução de currentModality)
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Em todos os breakpoints: ao trocar de modalidade o conteúdo muda de
    // altura e o viewport perde o enquadramento — realinha o topo do card
    // (com folga via scroll-mt) para o gráfico novo ficar inteiro em vista.
    graduationCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeModality]);

  const { data, isLoading } = useQuery<ChartsData>({
    queryKey: ['/api/dashboard/charts'],
  });

  const growth = (data?.studentGrowth ?? []).map(d => ({ ...d, month: formatMonth(d.month) }));
  const revenue = (data?.monthlyRevenue ?? []).map(d => ({ ...d, month: formatMonth(d.month) }));
  const modalityRaw = data?.modalityRankDistribution ?? [];

  // Agrupa por modalidade, preserva colorClass completa (incluindo bicolor)
  const modalityData: Record<string, RankBar[]> = {};
  const modalityIds: Record<string, string> = {}; // nome da modalidade → classTypeId
  for (const entry of modalityRaw) {
    if (!modalityData[entry.modality]) modalityData[entry.modality] = [];
    modalityIds[entry.modality] = entry.classTypeId;
    const colorClass = entry.colorClass ?? '';
    const firstColor = colorClass.split('|')[0];
    modalityData[entry.modality].push({
      rankId: entry.rankId,
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
  // Total de graduados por modalidade — exibido nas tabs/select do seletor
  const modalityTotals: Record<string, number> = {};
  for (const mod of modalityNames) {
    modalityTotals[mod] = modalityData[mod].reduce((acc, e) => acc + e.count, 0);
  }
  const currentModality = (activeModality && modalityData[activeModality])
    ? activeModality
    : (modalityNames[0] ?? '');
  const activeData = modalityData[currentModality] ?? [];
  const activeTotal = activeData.reduce((acc, e) => acc + e.count, 0);
  const occupiedRanks = activeData.filter(e => e.count > 0).length;

  // Alunos matriculados na modalidade sem graduação registrada (cadastro incompleto)
  const unrankedByClassType = new Map(
    (data?.modalityUnranked ?? []).map(u => [u.classTypeId, u.count]),
  );
  const activeUnranked = unrankedByClassType.get(modalityIds[currentModality] ?? '') ?? 0;

  // Click-through: navega para a lista de alunos já filtrada por modalidade + faixa
  const goToStudents = (rankId: string) => {
    const classTypeId = modalityIds[currentModality];
    if (!classTypeId) return;
    navigate(`/dashboard/alunos?modalidade=${classTypeId}&graduacao=${rankId}`);
  };

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
        <Card ref={graduationCardRef} className="col-span-1 md:col-span-2 min-w-0 self-start scroll-mt-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-500" />
                  Graduações por Modalidade
                </CardTitle>
                {activeData.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {currentModality} · {activeTotal} {activeTotal === 1 ? 'aluno graduado' : 'alunos graduados'} · {occupiedRanks} de {activeData.length} {activeData.length === 1 ? 'faixa' : 'faixas'}
                  </p>
                )}
              </div>
              {/* Desktop: tabs com contagem; scroll horizontal se houver muitas modalidades */}
              <div className="hidden md:block max-w-full overflow-x-auto">
                <Tabs value={currentModality} onValueChange={setActiveModality}>
                  <TabsList className="h-7">
                    {modalityNames.map(mod => (
                      <TabsTrigger key={mod} value={mod} className="px-3 text-xs h-5 gap-1">
                        {mod}
                        <span className="text-[10px] font-semibold tabular-nums opacity-60">
                          {modalityTotals[mod]}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Mobile: select ocupa a linha inteira — tabs não cabem com 4+ modalidades */}
              <Select value={currentModality} onValueChange={setActiveModality}>
                <SelectTrigger className="w-full md:hidden h-9" aria-label="Selecionar modalidade">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium">{currentModality}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      · {modalityTotals[currentModality] ?? 0} {(modalityTotals[currentModality] ?? 0) === 1 ? 'aluno' : 'alunos'}
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {modalityNames.map(mod => (
                    <SelectItem key={mod} value={mod}>
                      <span className="flex items-center gap-1.5">
                        {mod}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          · {modalityTotals[mod]} {modalityTotals[mod] === 1 ? 'aluno' : 'alunos'}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    {/* Visão geral: barra 100% empilhada com a distribuição inteira
                        (só faixas com alunos — zeradas ficam apenas na lista) */}
                    {activeTotal > 0 && (
                      <div className="mb-5">
                        <DistributionStackedBar
                          items={activeData
                            .filter(e => e.count > 0)
                            .map(e => ({
                              label: e.rank,
                              count: e.count,
                              colorClass: e.colorClass || e.color,
                            }))}
                          total={activeTotal}
                        />
                      </div>
                    )}

                    {/*
                      ProgressBarList em todos os breakpoints — altura 100% governada
                      pelo CSS (h-auto). Sem cálculo JS, sem overflow interno.
                      Barras proporcionais ao total da modalidade; linhas clicáveis.
                    */}
                    <ProgressBarList
                      items={activeData.map(e => ({
                        rankId: e.rankId,
                        label: e.rank,
                        count: e.count,
                        color: e.color,
                        colorClass: e.colorClass,
                      }))}
                      total={activeTotal}
                      onItemClick={goToStudents}
                    />

                    {/* Matriculados na modalidade sem graduação registrada —
                        sinal de cadastro incompleto; leva à lista da modalidade */}
                    {activeUnranked > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const classTypeId = modalityIds[currentModality];
                          if (classTypeId) navigate(`/dashboard/alunos?modalidade=${classTypeId}`);
                        }}
                        aria-label={`Ver alunos de ${currentModality} — ${activeUnranked} sem graduação registrada`}
                        className="group mt-5 w-full flex items-center justify-between gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none transition-colors cursor-pointer"
                      >
                        <span className="text-sm text-muted-foreground">
                          Sem graduação registrada
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground uppercase tracking-wider shrink-0">
                          {activeUnranked} {activeUnranked === 1 ? 'aluno' : 'alunos'}
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" />
                        </span>
                      </button>
                    )}
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
