import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CalendarOff, DollarSign, TrendingUp, UserCheck, Clock, AlertCircle, Dumbbell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DashboardInfo {
  academy: {
    id: string;
    name: string;
    slug: string;
    email: string;
    createdAt: string;
  };
  statistics: {
    totalStudents: number;
    totalInstructors: number;
    totalClassTypes: number;
  };
  message: string;
}

interface DashboardStats {
  students: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  financial: {
    revenueThisMonth: number;
    overdueCount: number;
    overdueAmount: number;
  };
  attendance: {
    rateThisMonth: number | null;
    ratePreviousMonth: number | null;
    totalRecords: number;
  };
  classes: {
    activeTotal: number;
  };
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  href?: string;
  alert?: boolean;
  compact?: boolean;
  emptyIcon?: React.ReactNode;
}

function StatCard({ title, value, description, icon, trend, href, alert, compact, emptyIcon }: StatCardProps) {
  const headerCls = compact
    ? "flex flex-row items-center justify-between space-y-0 px-4 pt-3 pb-2"
    : "flex flex-row items-center justify-between space-y-0 pb-2";
  const contentCls = compact ? "px-4 pb-3" : "";
  const valueCls = `font-bold ${compact ? "text-xl lg:text-2xl" : "text-2xl"} ${alert ? "text-destructive" : ""}`;
  const titleCls = `font-medium text-muted-foreground leading-tight ${compact ? "text-xs" : "text-sm"}`;

  const cardContent = (
    <>
      <CardHeader className={headerCls}>
        <CardTitle className={titleCls}>
          {title}
        </CardTitle>
        <div className={`shrink-0 ml-1 ${alert ? "text-destructive" : "text-muted-foreground"}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className={contentCls}>
        <div
          className={valueCls}
          data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </div>
        {emptyIcon && (
          <div className="flex justify-center pt-2 pb-1 text-slate-300">
            {emptyIcon}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            {description}
          </p>
        )}
        {trend && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-3 w-3 ${!trend.isPositive ? 'rotate-180' : ''}`} />
            {trend.value}
          </div>
        )}
      </CardContent>
    </>
  );

  if (href) {
    return (
      <Card className="cursor-pointer hover:bg-muted/40 transition-all active:scale-[0.98]">
        <Link to={href} className="block no-underline text-inherit"
          data-testid={`card-link-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {cardContent}
        </Link>
      </Card>
    );
  }

  return <Card>{cardContent}</Card>;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function DashboardStats() {
  const { data: dashboardInfo, isLoading: infoLoading } = useQuery<DashboardInfo>({
    queryKey: ['/api/dashboard/info'],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const loading = infoLoading || statsLoading;

  const totalInstructors = dashboardInfo?.statistics?.totalInstructors ?? 0;
  const totalClassTypes = dashboardInfo?.statistics?.totalClassTypes ?? 0;

  const activeStudents = stats?.students.active ?? 0;
  const newThisMonth = stats?.students.newThisMonth ?? 0;
  const revenueThisMonth = stats?.financial.revenueThisMonth ?? 0;
  const overdueCount = stats?.financial.overdueCount ?? 0;
  const overdueAmount = stats?.financial.overdueAmount ?? 0;
  const attendanceRate = stats?.attendance.rateThisMonth;
  const attendancePrevRate = stats?.attendance.ratePreviousMonth;
  const attendanceTotalRecords = stats?.attendance.totalRecords ?? 0;

  // Tendência da presença: comparação com os 30 dias anteriores quando há
  // dado; senão recua para o selo saudável/baixa (corte em 70%).
  let attendanceTrend: { value: string; isPositive: boolean } | undefined;
  if (attendanceRate != null && attendancePrevRate != null) {
    const delta = attendanceRate - attendancePrevRate;
    attendanceTrend = delta === 0
      ? { value: "Estável vs. 30 dias antes", isPositive: true }
      : { value: `${delta > 0 ? '+' : ''}${delta}pp vs. 30 dias antes`, isPositive: delta > 0 };
  } else if (attendanceRate != null) {
    attendanceTrend = {
      value: attendanceRate >= 70 ? "Frequência saudável" : "Frequência baixa",
      isPositive: attendanceRate >= 70,
    };
  }
  const activeClasses = stats?.classes.activeTotal ?? 0;

  // 4 cards compactos: ficam em linha única a partir de md
  const topCards: StatCardProps[] = [
    {
      title: "Alunos Ativos",
      value: loading ? "..." : activeStudents,
      description: newThisMonth > 0 ? `+${newThisMonth} este mês` : "Matriculados",
      icon: <Users className="h-4 w-4" />,
      trend: newThisMonth > 0 ? { value: `${newThisMonth} novos este mês`, isPositive: true } : undefined,
      href: "/dashboard/alunos",
      compact: true,
    },
    {
      title: "Instrutores",
      value: loading ? "..." : totalInstructors,
      description: "Cadastrados",
      icon: <UserCheck className="h-4 w-4" />,
      href: "/dashboard/instrutores",
      compact: true,
    },
    {
      title: "Modalidades",
      value: loading ? "..." : totalClassTypes,
      description: "Gerenciar tipos de aula",
      icon: <Dumbbell className="h-4 w-4" />,
      // Modalidades são cadastradas em Configurações (aba padrão é Modalidades)
      href: "/settings",
      compact: true,
    },
    {
      title: "Aulas Ativas",
      value: loading ? "..." : activeClasses,
      description: "Ver grade de turmas",
      icon: <Calendar className="h-4 w-4" />,
      href: "/dashboard/aulas",
      compact: true,
    },
  ];

  // 2 cards largos: financeiro e presença
  const bottomCards: StatCardProps[] = [
    {
      title: "Receita do Mês",
      value: loading ? "..." : formatCurrency(revenueThisMonth),
      description: overdueCount > 0
        ? `${overdueCount} pag. em atraso (${formatCurrency(overdueAmount)})`
        : "Sem inadimplência",
      icon: overdueCount > 0 ? <AlertCircle className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />,
      alert: overdueCount > 0,
      trend: overdueCount > 0
        ? { value: `${overdueCount} inadimplente${overdueCount > 1 ? 's' : ''}`, isPositive: false }
        : { value: "Sem inadimplência", isPositive: true },
      href: "/dashboard/financeiro",
    },
    {
      title: "Taxa de Presença",
      value: loading ? "..." : (attendanceRate != null ? `${attendanceRate}%` : "Sem dados"),
      description: attendanceTotalRecords > 0
        ? `Últimos 30 dias (${attendanceTotalRecords} registros)`
        : "Nenhum registro ainda",
      icon: <Clock className="h-4 w-4" />,
      trend: attendanceTrend,
      emptyIcon: !loading && attendanceRate == null
        ? <CalendarOff className="h-9 w-9" />
        : undefined,
      href: "/dashboard/presenca",
    },
  ];

  return (
    <div className="space-y-3">
      {/* 4 cards em linha: 2×2 no mobile, 4 colunas a partir de md */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {topCards.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* 2 cards largos: empilhados no mobile, lado a lado a partir de sm */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {bottomCards.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>
    </div>
  );
}
