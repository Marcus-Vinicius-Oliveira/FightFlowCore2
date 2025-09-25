import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp, UserCheck, Clock } from "lucide-react";

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
  // TODO: Remove mock data - replace with real data from API
  const stats = [
    {
      title: "Total de Alunos",
      value: 147,
      description: "Alunos ativos matriculados",
      icon: <Users className="h-4 w-4" />,
      trend: { value: "+12% desde o mês passado", isPositive: true },
      href: "/alunos"
    },
    {
      title: "Aulas desta Semana",
      value: 28,
      description: "Aulas agendadas",
      icon: <Calendar className="h-4 w-4" />,
      trend: { value: "+2 a mais que na semana passada", isPositive: true },
      href: "/aulas"
    },
    {
      title: "Receita Mensal",
      value: "R$ 8.940",
      description: "Ganhos do mês atual",
      icon: <DollarSign className="h-4 w-4 text-green-600" />,
      trend: { value: "+8% desde o mês passado", isPositive: true },
      href: "/financeiro"
    },
    {
      title: "Taxa de Presença",
      value: "89%",
      description: "Média deste mês",
      icon: <UserCheck className="h-4 w-4" />,
      trend: { value: "+3% desde o mês passado", isPositive: true },
      href: "/presenca"
    },
    {
      title: "Pagamentos Pendentes",
      value: 12,
      description: "Pagamentos em atraso",
      icon: <Clock className="h-4 w-4 text-orange-500" />,
      trend: { value: "-5 desde a semana passada", isPositive: true },
      href: "/pagamentos"
    },
    {
      title: "Novas Matrículas",
      value: 8,
      description: "Neste mês",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      trend: { value: "+60% desde o mês passado", isPositive: true },
      href: "/matriculas"
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