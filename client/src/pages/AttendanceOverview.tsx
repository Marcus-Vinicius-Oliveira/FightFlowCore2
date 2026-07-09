import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Clock, Search, TrendingUp, TrendingDown, Minus, UserX, ArrowUpDown, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

// Sem presença há este nº de dias (ou nunca) = aluno em risco de evasão
const RISK_DAYS = 14;

interface OverviewStudent {
  id: string;
  name: string;
  presences: number;
  lastPresence: string | null;
  daysSinceLast: number | null;
  classTypeIds: string[];
}

interface AttendanceOverviewData {
  days: number;
  rate: number | null;
  totalRecords: number;
  previousRate: number | null;
  buckets: { start: string; total: number; present: number; rate: number | null }[];
  classTypes: { id: string; name: string }[];
  students: OverviewStudent[];
}

type SortKey = 'risk' | 'name' | 'presences';

function formatBucketLabel(isoDate: string) {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

function formatLastPresence(s: OverviewStudent) {
  if (!s.lastPresence) return 'Nunca';
  const d = new Date(s.lastPresence);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function AttendanceOverview() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const [search, setSearch] = useState('');
  const [classTypeFilter, setClassTypeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('risk');

  const { data, isLoading } = useQuery<AttendanceOverviewData>({
    queryKey: ['/api/dashboard/attendance-overview', days],
    queryFn: () =>
      apiRequest('GET', `/api/dashboard/attendance-overview?days=${days}`).then(r => r.json()),
  });

  const classTypeById = useMemo(
    () => new Map((data?.classTypes ?? []).map(ct => [ct.id, ct.name])),
    [data?.classTypes]
  );

  // Em risco: nunca veio, ou sem presença há RISK_DAYS+ dias
  const isAtRisk = (s: OverviewStudent) =>
    s.daysSinceLast == null || s.daysSinceLast >= RISK_DAYS;

  const students = useMemo(() => {
    let list = data?.students ?? [];
    if (classTypeFilter) list = list.filter(s => s.classTypeIds.includes(classTypeFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (sortKey === 'presences') return b.presences - a.presences;
      // risk: quem está pior primeiro — nunca veio > mais dias sem vir
      const da = a.daysSinceLast ?? Infinity;
      const db = b.daysSinceLast ?? Infinity;
      if (da !== db) return db - da;
      return a.presences - b.presences;
    });
  }, [data?.students, classTypeFilter, search, sortKey]);

  const atRiskCount = useMemo(
    () => (data?.students ?? []).filter(isAtRisk).length,
    [data?.students]
  );

  const delta = data?.rate != null && data?.previousRate != null
    ? data.rate - data.previousRate
    : null;

  const chartData = (data?.buckets ?? []).map(b => ({
    ...b,
    label: formatBucketLabel(b.start),
  }));

  const periodLabel = { '7': '7 dias', '30': '30 dias', '90': '90 dias' }[days];

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho: título + presets de período ───────────────────────── */}
      <div className="flex flex-wrap gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Presença</h1>
          <p className="text-muted-foreground mt-2">
            Frequência dos alunos nos últimos {periodLabel}
          </p>
        </div>
        <Tabs value={days} onValueChange={v => setDays(v as typeof days)}>
          <TabsList>
            <TabsTrigger value="7" data-testid="period-7">7 dias</TabsTrigger>
            <TabsTrigger value="30" data-testid="period-30">30 dias</TabsTrigger>
            <TabsTrigger value="90" data-testid="period-90">90 dias</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Resumo do período ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Taxa de Presença</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl lg:text-2xl font-bold" data-testid="overview-rate">
              {isLoading ? '...' : data?.rate != null ? `${data.rate}%` : 'Sem dados'}
            </div>
            {delta != null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${
                delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" />
                  : delta < 0 ? <TrendingDown className="h-3 w-3" />
                  : <Minus className="h-3 w-3" />}
                {delta === 0 ? 'Estável' : `${delta > 0 ? '+' : ''}${delta}pp`} vs. {periodLabel} anteriores
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Registros de Chamada</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground rotate-90" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl lg:text-2xl font-bold">
              {isLoading ? '...' : data?.totalRecords ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">No período</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Alunos em Risco</CardTitle>
            <UserX className={`h-4 w-4 ${atRiskCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className={`text-xl lg:text-2xl font-bold ${atRiskCount > 0 ? 'text-amber-600' : ''}`} data-testid="overview-at-risk">
              {isLoading ? '...' : atRiskCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sem presença há {RISK_DAYS}+ dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Evolução no período ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Taxa de presença por {days === '7' ? 'dia' : 'semana'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.some(b => b.total > 0) ? (
            <div className="w-full min-w-0 h-40 md:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number, _n, item) => {
                      const b = item?.payload as (typeof chartData)[number] | undefined;
                      return [b ? `${v}% (${b.present} de ${b.total})` : `${v}%`, 'Presença'];
                    }}
                    labelFormatter={(label, payload) => {
                      const b = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                      return b && b.total === 0 ? `${label} — sem chamadas` : `A partir de ${label}`;
                    }}
                  />
                  <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 md:h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              {isLoading ? 'Carregando...' : 'Nenhuma chamada registrada no período'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Frequência por aluno ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="text-sm font-medium">
            Frequência por aluno
            {!isLoading && (
              <span className="text-muted-foreground font-normal"> — {students.length} de {data?.students.length ?? 0}</span>
            )}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
                data-testid="input-search-student"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Padrão de filtro do app: label dinâmico no trigger + borda primary quando ativo */}
            <Select
              value={classTypeFilter || 'all'}
              onValueChange={v => setClassTypeFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger
                className={`w-44 h-9 ${classTypeFilter ? 'border-primary' : ''}`}
                data-testid="filter-modality"
              >
                {classTypeFilter ? classTypeById.get(classTypeFilter) ?? 'Modalidade' : 'Modalidade'}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as modalidades</SelectItem>
                {(data?.classTypes ?? []).map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-44 h-9" data-testid="sort-students">
                {{ risk: 'Mais ausentes antes', name: 'Nome (A–Z)', presences: 'Mais presenças' }[sortKey]}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="risk">Mais ausentes antes</SelectItem>
                <SelectItem value="presences">Mais presenças</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : students.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum aluno encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead className="text-right">Presenças ({periodLabel})</TableHead>
                    <TableHead>Última presença</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map(s => (
                    <TableRow key={s.id} data-testid={`student-row-${s.id}`}>
                      <TableCell>
                        <Link
                          to={`/dashboard/alunos/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.presences}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLastPresence(s)}
                        {s.daysSinceLast != null && s.daysSinceLast > 0 && (
                          <span className="text-xs"> · há {s.daysSinceLast}d</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAtRisk(s) ? (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-500">
                            {s.daysSinceLast == null ? 'Nunca veio' : `Ausente há ${s.daysSinceLast}d`}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Em dia</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
