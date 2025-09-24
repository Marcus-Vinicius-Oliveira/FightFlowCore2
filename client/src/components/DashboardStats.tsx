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
      title: "Total Students",
      value: 147,
      description: "Active enrolled students",
      icon: <Users className="h-4 w-4" />,
      trend: { value: "+12% from last month", isPositive: true }
    },
    {
      title: "Classes This Week",
      value: 28,
      description: "Scheduled classes",
      icon: <Calendar className="h-4 w-4" />,
      trend: { value: "+2 more than last week", isPositive: true }
    },
    {
      title: "Monthly Revenue",
      value: "$8,940",
      description: "Current month earnings",
      icon: <DollarSign className="h-4 w-4" />,
      trend: { value: "+8% from last month", isPositive: true }
    },
    {
      title: "Attendance Rate",
      value: "89%",
      description: "Average this month",
      icon: <UserCheck className="h-4 w-4" />,
      trend: { value: "+3% from last month", isPositive: true }
    },
    {
      title: "Pending Payments",
      value: 12,
      description: "Overdue student payments",
      icon: <Clock className="h-4 w-4" />,
      trend: { value: "-5 from last week", isPositive: true }
    },
    {
      title: "New Enrollments",
      value: 8,
      description: "This month",
      icon: <TrendingUp className="h-4 w-4" />,
      trend: { value: "+60% from last month", isPositive: true }
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