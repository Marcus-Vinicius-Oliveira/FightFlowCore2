import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp, UserCheck, Clock, AlertCircle } from "lucide-react";
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
}

function StatCard({ title, value, description, icon, trend, href, alert }: StatCardProps) {
  const cardContent = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={alert ? "text-destructive" : "text-muted-foreground"}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${alert ? "text-destructive" : ""}`}
          data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
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
      <Card className="hover-elevate">
        <a href={href} className="block no-underline text-inherit"
          data-testid={`card-link-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {cardContent}
        </a>
      </Card>
    );
  }

  return <Card className="hover-elevate">{cardContent}</Card>;
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
  const attendanceTotalRecords = stats?.attendance.totalRecords ?? 0;
  const activeClasses = stats?.classes.activeTotal ?? 0;

  const statCards: StatCardProps[] = [
    {
      title: "Alunos Ativos",
      value: loading ? "..." : activeStudents,
      description: newThisMonth > 0 ? `+${newThisMonth} novos este mês` : "Matriculados",
      icon: <Users className="h-4 w-4" />,
      trend: newThisMonth > 0 ? { value: `${newThisMonth} novos este mês`, isPositive: true } : undefined,
      href: "/dashboard/alunos",
    },
    {
      title: "Instrutores",
      value: loading ? "..." : totalInstructors,
      description: "Instrutores cadastrados",
      icon: <UserCheck className="h-4 w-4" />,
      href: "/dashboard/instrutores",
    },
    {
      title: "Modalidades",
      value: loading ? "..." : totalClassTypes,
      description: "Tipos de aula disponíveis",
      icon: <TrendingUp className="h-4 w-4" />,
      href: "/dashboard/aulas",
    },
    {
      title: "Aulas Ativas",
      value: loading ? "..." : activeClasses,
      description: "Turmas recorrentes na grade",
      icon: <Calendar className="h-4 w-4" />,
      href: "/dashboard/aulas",
    },
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
      trend: attendanceRate != null
        ? { value: attendanceRate >= 70 ? "Frequência saudável" : "Frequência baixa", isPositive: attendanceRate >= 70 }
        : undefined,
      href: "/dashboard/presenca",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {statCards.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}
