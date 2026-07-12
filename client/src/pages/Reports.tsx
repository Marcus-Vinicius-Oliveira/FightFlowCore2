import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, AlertTriangle, Users, TrendingUp, TrendingDown, Minus, Clock, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

// Vermelho fixo para a série de cancelamentos/inadimplência: o --destructive
// do tema escuro (35% de luminosidade) não atinge 3:1 de contraste como barra
// sobre a superfície; este tom passa a validação nos dois temas.
const CHART_RED = 'hsl(0 75% 55%)';
const CHART_BLUE = 'hsl(var(--chart-1))';

interface MonthlyPoint {
  month: string; // YYYY-MM
  revenue: number;
  overdueAmount: number;
  overdueStudents: number;
  newStudents: number;
  cancellations: number;
}

interface ClassAttendance {
  classId: string;
  classTypeName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  total: number;
  present: number;
  rate: number | null;
}

interface ReportsData {
  months: number;
  monthly: MonthlyPoint[];
  topDebtors: { studentId: string; name: string; total: number; count: number }[];
  activeStudents: number;
  attendance: {
    days: number;
    classes: ClassAttendance[];
  };
}

interface ModalityGroup {
  name: string;
  classes: ClassAttendance[];
  total: number;
  present: number;
  rate: number | null;
  withoutRecords: number;
}

type Section = 'faturamento' | 'crescimento' | 'inadimplencia' | 'frequencia';

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// Abreviados: as linhas de turma dividem espaço com contagem + badge no mobile
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatMonth(key: string) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]}/${y.slice(2)}`;
}

function formatPrice(priceInCents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(priceInCents / 100);
}

/** Eixo Y monetário: compacto (R$ 1,2 mil) para não estourar a margem. */
function formatPriceCompact(priceInCents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
  }).format(priceInCents / 100);
}

function rateBadge(rate: number | null, total: number) {
  if (total === 0 || rate == null) {
    return <Badge variant="outline" className="text-muted-foreground">Sem chamadas</Badge>;
  }
  if (rate < 50) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{rate}%</Badge>;
  if (rate < 75) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{rate}%</Badge>;
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{rate}%</Badge>;
}

const chartMargin = { top: 4, right: 4, left: 0, bottom: 0 };
const tickStyle = { fontSize: 11 };
const tooltipStyle = { fontSize: 12, borderRadius: 8 };

export default function Reports() {
  const [section, setSection] = useState<Section>('faturamento');
  const [months, setMonths] = useState<'6' | '12'>('12');
  const [attendanceDays, setAttendanceDays] = useState<'30' | '90'>('30');

  const { data, isLoading } = useQuery<ReportsData>({
    queryKey: ['/api/reports/overview', months, attendanceDays],
    queryFn: () =>
      apiRequest('GET', `/api/reports/overview?months=${months}&attendanceDays=${attendanceDays}`)
        .then(r => r.json()),
  });

  const monthly = useMemo(
    () => (data?.monthly ?? []).map(p => ({ ...p, label: formatMonth(p.month) })),
    [data?.monthly],
  );

  const totals = useMemo(() => {
    const revenue = monthly.reduce((acc, p) => acc + p.revenue, 0);
    const overdue = monthly.reduce((acc, p) => acc + p.overdueAmount, 0);
    const newStudents = monthly.reduce((acc, p) => acc + p.newStudents, 0);
    const cancellations = monthly.reduce((acc, p) => acc + p.cancellations, 0);
    return { revenue, overdue, newStudents, cancellations, net: newStudents - cancellations };
  }, [monthly]);

  // Turmas agrupadas por modalidade: uma linha compacta por modalidade, com
  // taxa agregada; expandir mostra as turmas. Pior taxa primeiro — é o que o
  // gestor veio ver; modalidades sem nenhuma chamada vão para o fim (é
  // pendência de operação, não de frequência). Mesma regra dentro do grupo.
  const modalityGroups = useMemo<ModalityGroup[]>(() => {
    const byName = new Map<string, ClassAttendance[]>();
    for (const c of data?.attendance.classes ?? []) {
      const list = byName.get(c.classTypeName) ?? [];
      list.push(c);
      byName.set(c.classTypeName, list);
    }
    const groups = [...byName.entries()].map(([name, classes]) => {
      const total = classes.reduce((acc, c) => acc + c.total, 0);
      const present = classes.reduce((acc, c) => acc + c.present, 0);
      return {
        name,
        classes: [...classes].sort((a, b) => {
          if (a.total === 0 && b.total === 0) return a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime);
          if (a.total === 0) return 1;
          if (b.total === 0) return -1;
          return (a.rate ?? 0) - (b.rate ?? 0);
        }),
        total,
        present,
        rate: total > 0 ? Math.round((present / total) * 100) : null,
        withoutRecords: classes.filter(c => c.total === 0).length,
      };
    });
    return groups.sort((a, b) => {
      if (a.total === 0 && b.total === 0) return a.name.localeCompare(b.name, 'pt-BR');
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return (a.rate ?? 0) - (b.rate ?? 0);
    });
  }, [data?.attendance.classes]);

  const [expandedModalities, setExpandedModalities] = useState<Set<string>>(new Set());
  const toggleModality = (name: string) =>
    setExpandedModalities(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const periodLabel = months === '6' ? '6 meses' : '12 meses';

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho: título + janela de meses ──────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="reports-title">Relatórios</h1>
          <p className="text-muted-foreground mt-2">
            Faturamento, inadimplência, crescimento e frequência dos últimos {periodLabel}
          </p>
        </div>
        <Tabs value={months} onValueChange={v => setMonths(v as typeof months)}>
          <TabsList>
            <TabsTrigger value="6" data-testid="months-6">6 meses</TabsTrigger>
            <TabsTrigger value="12" data-testid="months-12">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Resumo do período (sempre visível) ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Receita no Período</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl lg:text-2xl font-bold" data-testid="kpi-revenue">
              {isLoading ? '...' : formatPrice(totals.revenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencido sem Pagamento</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${totals.overdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className={`text-xl lg:text-2xl font-bold ${totals.overdue > 0 ? 'text-red-600' : ''}`} data-testid="kpi-overdue">
              {isLoading ? '...' : formatPrice(totals.overdue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Mensalidades do período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Alunos Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl lg:text-2xl font-bold" data-testid="kpi-active-students">
              {isLoading ? '...' : data?.activeStudents ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Saldo de Alunos</CardTitle>
            {totals.net > 0 ? <TrendingUp className="h-4 w-4 text-green-600" />
              : totals.net < 0 ? <TrendingDown className="h-4 w-4 text-red-600" />
              : <Minus className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl lg:text-2xl font-bold" data-testid="kpi-net-students">
              {isLoading ? '...' : `${totals.net > 0 ? '+' : ''}${totals.net}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.newStudents} novos − {totals.cancellations} cancelados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Uma área por vez: no mobile evita o poço de scroll ───────────── */}
      <Tabs value={section} onValueChange={v => setSection(v as Section)}>
        <TabsList className="grid w-full h-auto grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="faturamento" data-testid="section-faturamento">Faturamento</TabsTrigger>
          <TabsTrigger value="crescimento" data-testid="section-crescimento">Crescimento</TabsTrigger>
          <TabsTrigger value="inadimplencia" data-testid="section-inadimplencia">Inadimplência</TabsTrigger>
          <TabsTrigger value="frequencia" data-testid="section-frequencia">Frequência</TabsTrigger>
        </TabsList>

        {/* ── Faturamento mensal ──────────────────────────────────────────── */}
        <TabsContent value="faturamento" className="mt-4">
          <Card data-testid="card-revenue-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Faturamento mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.some(p => p.revenue > 0) ? (
                <div className="w-full min-w-0 h-48 md:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={chartMargin}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={tickStyle}
                        axisLine={false}
                        tickLine={false}
                        width={72}
                        tickFormatter={v => formatPriceCompact(v)}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => [formatPrice(v), 'Receita paga']}
                      />
                      <Bar dataKey="revenue" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 md:h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  {isLoading ? 'Carregando...' : 'Nenhum pagamento confirmado no período'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Crescimento de alunos ───────────────────────────────────────── */}
        <TabsContent value="crescimento" className="mt-4">
          <Card data-testid="card-growth-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Crescimento de alunos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.some(p => p.newStudents > 0 || p.cancellations > 0) ? (
                <div className="w-full min-w-0 h-48 md:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={chartMargin}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                      <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="newStudents" name="Novos alunos" fill={CHART_BLUE} radius={[4, 4, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="cancellations" name="Cancelamentos" fill={CHART_RED} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 md:h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  {isLoading ? 'Carregando...' : 'Nenhuma movimentação de alunos no período'}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Cancelamentos são contabilizados a partir de julho/2026; desativações anteriores não aparecem.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Inadimplência ───────────────────────────────────────────────── */}
        <TabsContent value="inadimplencia" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-testid="card-overdue-chart">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Inadimplência por mês de vencimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthly.some(p => p.overdueAmount > 0) ? (
                  <div className="w-full min-w-0 h-48 md:h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={chartMargin}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={tickStyle}
                          axisLine={false}
                          tickLine={false}
                          width={72}
                          tickFormatter={v => formatPriceCompact(v)}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number, _n, item) => {
                            const p = item?.payload as (typeof monthly)[number] | undefined;
                            return [
                              p ? `${formatPrice(v)} (${p.overdueStudents} aluno${p.overdueStudents === 1 ? '' : 's'})` : formatPrice(v),
                              'Em aberto',
                            ];
                          }}
                        />
                        <Bar dataKey="overdueAmount" fill={CHART_RED} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 md:h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    {isLoading ? 'Carregando...' : 'Nenhuma mensalidade vencida em aberto no período 🎉'}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-debtors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Maiores devedores</CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.topDebtors.length ?? 0) > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="text-right">Mensalidades</TableHead>
                        <TableHead className="text-right">Total devido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.topDebtors.map(d => (
                        <TableRow key={d.studentId} data-testid={`debtor-${d.studentId}`}>
                          <TableCell>
                            <Link
                              href={`/dashboard/alunos/${d.studentId}`}
                              className="hover:underline text-foreground"
                            >
                              {d.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">{d.count}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatPrice(d.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    {isLoading ? 'Carregando...' : 'Nenhum aluno com mensalidade vencida em aberto'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Frequência por turma ────────────────────────────────────────── */}
        <TabsContent value="frequencia" className="mt-4">
          <Card data-testid="card-class-attendance">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Frequência por turma
                </CardTitle>
                <Tabs value={attendanceDays} onValueChange={v => setAttendanceDays(v as typeof attendanceDays)}>
                  <TabsList>
                    <TabsTrigger value="30" data-testid="attendance-30">30 dias</TabsTrigger>
                    <TabsTrigger value="90" data-testid="attendance-90">90 dias</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {modalityGroups.length > 0 ? (
                <div>
                  {modalityGroups.map(g => (
                    <Collapsible
                      key={g.name}
                      open={expandedModalities.has(g.name)}
                      onOpenChange={() => toggleModality(g.name)}
                    >
                      <CollapsibleTrigger
                        className="w-full flex items-center gap-2 py-3 border-b text-left hover-elevate"
                        data-testid={`modality-${g.name}`}
                      >
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                            expandedModalities.has(g.name) ? 'rotate-90' : ''
                          }`}
                        />
                        <span className="font-medium flex-1 min-w-0 truncate">{g.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {g.classes.length} turma{g.classes.length === 1 ? '' : 's'}
                        </span>
                        <span className="shrink-0">{rateBadge(g.rate, g.total)}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {g.classes.map(c => (
                          <div
                            key={c.classId}
                            className="flex items-center gap-2 py-2 pl-8 pr-1 border-b text-sm"
                            data-testid={`class-attendance-${c.classId}`}
                          >
                            <span className="flex-1 min-w-0 truncate text-muted-foreground">
                              {DAY_NAMES[c.dayOfWeek]}, {c.startTime}–{c.endTime}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {c.present}/{c.total}
                            </span>
                            <span className="shrink-0">{rateBadge(c.rate, c.total)}</span>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                  {isLoading ? 'Carregando...' : 'Nenhuma turma ativa cadastrada'}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Modalidades com a menor taxa aparecem primeiro; toque para ver as turmas.
                Presenças/registros no período de {attendanceDays} dias.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
