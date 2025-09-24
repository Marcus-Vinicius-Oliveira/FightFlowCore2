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
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card className="hover-elevate">
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
      trend: { value: "+12% desde o mês passado", isPositive: true }
    },
    {
      title: "Aulas desta Semana",
      value: 28,
      description: "Aulas agendadas",
      icon: <Calendar className="h-4 w-4" />,
      trend: { value: "+2 a mais que na semana passada", isPositive: true }
    },
    {
      title: "Receita Mensal",
      value: "R$ 8.940",
      description: "Ganhos do mês atual",
      icon: <DollarSign className="h-4 w-4" />,
      trend: { value: "+8% desde o mês passado", isPositive: true }
    },
    {
      title: "Taxa de Presença",
      value: "89%",
      description: "Média deste mês",
      icon: <UserCheck className="h-4 w-4" />,
      trend: { value: "+3% desde o mês passado", isPositive: true }
    },
    {
      title: "Pagamentos Pendentes",
      value: 12,
      description: "Pagamentos em atraso",
      icon: <Clock className="h-4 w-4" />,
      trend: { value: "-5 desde a semana passada", isPositive: true }
    },
    {
      title: "Novas Matrículas",
      value: 8,
      description: "Neste mês",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: { value: "+60% desde o mês passado", isPositive: true }
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
        />
      ))}
    </div>
  );
}