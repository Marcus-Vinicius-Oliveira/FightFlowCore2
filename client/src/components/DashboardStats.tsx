import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp, UserCheck, Clock } from "lucide-react";
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
}

function StatCard({ title, value, description, icon, trend, href }: StatCardProps) {
  const cardContent = (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        <div className="sparkline-placeholder h-8 my-2"></div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        {trend && (
          <div className={`text-xs mt-1 flex items-center ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            <TrendingUp className={`h-3 w-3 mr-1 ${!trend.isPositive ? 'rotate-180' : ''}`} />
            {trend.value}
          </div>
        )}
      </CardContent>
    </>
  );

  if (href) {
    return (
      <Card className="hover-elevate">
        <a 
          href={href}
          style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit'
          }}
          data-testid={`card-link-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {cardContent}
        </a>
      </Card>
    );
  }

  return (
    <Card className="hover-elevate">
      {cardContent}
    </Card>
  );
}

export function DashboardStats() {
  // Fetch real data from API
  const { data: dashboardInfo, isLoading } = useQuery<DashboardInfo>({
    queryKey: ['/api/dashboard/info'],
  });

  // Extract real statistics from API response
  const totalStudents = dashboardInfo?.statistics?.totalStudents || 0;
  const totalInstructors = dashboardInfo?.statistics?.totalInstructors || 0;
  const totalClassTypes = dashboardInfo?.statistics?.totalClassTypes || 0;

  const stats = [
    {
      title: "Total de Alunos",
      value: isLoading ? "..." : totalStudents,
      description: "Alunos ativos matriculados",
      icon: <Users className="h-4 w-4" />,
      trend: totalStudents > 0 ? { value: `${totalStudents} alunos cadastrados`, isPositive: true } : undefined,
      href: "/dashboard/alunos"
    },
    {
      title: "Total de Instrutores", 
      value: isLoading ? "..." : totalInstructors,
      description: "Instrutores cadastrados",
      icon: <UserCheck className="h-4 w-4" />,
      trend: totalInstructors > 0 ? { value: `${totalInstructors} instrutores ativos`, isPositive: true } : undefined,
      href: "/dashboard/instrutores"
    },
    {
      title: "Modalidades",
      value: isLoading ? "..." : totalClassTypes,
      description: "Tipos de aula disponíveis",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: totalClassTypes > 0 ? { value: `${totalClassTypes} modalidades cadastradas`, isPositive: true } : undefined,
      href: "/dashboard/aulas"
    },
    {
      title: "Aulas desta Semana",
      value: "Em breve",
      description: "Aulas agendadas",
      icon: <Calendar className="h-4 w-4" />,
      trend: { value: "Funcionalidade em desenvolvimento", isPositive: true },
      href: "/dashboard/aulas"
    },
    {
      title: "Receita Mensal",
      value: "Em breve",
      description: "Ganhos do mês atual",
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      trend: { value: "Funcionalidade em desenvolvimento", isPositive: true },
      href: "/dashboard/financeiro"
    },
    {
      title: "Taxa de Presença",
      value: "Em breve",
      description: "Média deste mês",
      icon: <Clock className="h-4 w-4" />,
      trend: { value: "Funcionalidade em desenvolvimento", isPositive: true },
      href: "/dashboard/presenca"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          description={stat.description}
          icon={stat.icon}
          trend={stat.trend}
          href={stat.href}
        />
      ))}
    </div>
  );
}