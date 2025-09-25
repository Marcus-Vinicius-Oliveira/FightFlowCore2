import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Activity,
  TrendingUp,
  Plus,
  Settings
} from "lucide-react";
import { Link } from "wouter";

interface SuperAdminStats {
  totalAcademies: number;
  totalPlanos: number;
  totalAssinaturas: number;
  activePlanos: number;
  activeAssinaturas: number;
}

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = useQuery<SuperAdminStats>({
    queryKey: ["/api/superadmin/stats"],
  });

  if (isLoading) {
    return (
      <div className="max-w-none w-full space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Painel Super Admin</h1>
          <p className="text-muted-foreground mt-2">
            Gerenciamento global da plataforma Centro de Lutas
          </p>
        </div>
        
        {/* Two-column layout skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">
          {/* Main Column (Left) - Action Cards Skeleton */}
          <div className="space-y-6">
            <div className="h-6 bg-muted rounded w-40 animate-pulse"></div>
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-0 pb-2">
                  <div className="h-5 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-full mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-9 bg-muted rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sidebar Column (Right) - Stats and Status Skeleton */}
          <div className="space-y-6">
            <div className="h-6 bg-muted rounded w-28 animate-pulse"></div>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="space-y-0 pb-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-8 bg-muted rounded w-1/2 mt-2"></div>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <div>
              <div className="h-5 bg-muted rounded w-36 mb-4 animate-pulse"></div>
              <Card className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-full mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-none w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Painel Super Admin</h1>
          <p className="text-muted-foreground mt-2">
            Gerenciamento global da plataforma Centro de Lutas
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/superadmin/planos/novo" data-testid="button-new-plan">
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Link>
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">
        {/* Main Column (Left) - Action Cards */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Ações Rápidas</h2>
          
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Gerenciar Academias
              </CardTitle>
              <CardDescription>
                Visualizar e gerenciar todas as academias cadastradas na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-manage-academies">
                <Link href="/superadmin/academias">
                  <Users className="h-4 w-4 mr-2" />
                  Ver Academias
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Planos de Assinatura
              </CardTitle>
              <CardDescription>
                Criar e gerenciar os planos de assinatura da plataforma SaaS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-manage-plans">
                <Link href="/superadmin/planos">
                  <Settings className="h-4 w-4 mr-2" />
                  Gerenciar Planos
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Assinaturas Ativas
              </CardTitle>
              <CardDescription>
                Monitorar e gerenciar as assinaturas das academias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" data-testid="button-manage-subscriptions">
                <Link href="/superadmin/assinaturas">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Ver Assinaturas
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column (Right) - Stats and Status */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Estatísticas</h2>
          
          {/* KPI Cards */}
          <div className="space-y-4">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Academias Ativas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-academies">
                  {stats?.totalAcademies || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total de academias na plataforma
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planos Disponíveis</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-plans">
                  {stats?.activePlanos || 0}
                  <span className="text-sm text-muted-foreground ml-1">
                    / {stats?.totalPlanos || 0}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Planos ativos / total
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-subscriptions">
                  {stats?.activeAssinaturas || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Academias com assinaturas ativas
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-conversion">
                  {stats?.totalAcademies && stats?.activeAssinaturas 
                    ? Math.round((stats.activeAssinaturas / stats.totalAcademies) * 100)
                    : 0
                  }%
                </div>
                <p className="text-xs text-muted-foreground">
                  Academias com assinaturas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <div>
            <h3 className="text-lg font-medium mb-4">Status do Sistema</h3>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado da Plataforma</CardTitle>
                <CardDescription>
                  Informações sobre o estado atual da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <Activity className="h-3 w-3 mr-1" />
                      Sistema Operacional
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Todos os serviços funcionando normalmente
                  </p>
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Última atualização: {new Date().toLocaleString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}