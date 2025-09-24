import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Calendar, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DashboardInfoData {
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
  multitenancyProof: {
    requestorRole: string;
    isolatedByAcademyId: string;
    timestamp: string;
  };
}

export function DashboardInfo() {
  const { isAuthenticated } = useAuth();
  
  const { data, isLoading, error } = useQuery<DashboardInfoData>({
    queryKey: ['/api/dashboard/info'],
    enabled: isAuthenticated, // Only run query when authenticated
    retry: 1, // Reduce retries to avoid persistent error states
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">Carregando informações da academia...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-destructive">
            Erro ao carregar informações da academia
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Welcome Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{data.message}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Academia: {data.academy.name}</p>
              <p className="text-sm text-muted-foreground">Email: {data.academy.email}</p>
            </div>
            <Badge variant="secondary" className="text-xs">
              ID: {data.academy.slug}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Alunos</p>
                <p className="text-2xl font-bold">{data.statistics.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Instrutores</p>
                <p className="text-2xl font-bold">{data.statistics.totalInstructors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Modalidades</p>
                <p className="text-2xl font-bold">{data.statistics.totalClassTypes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multitenancy Proof */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Contexto de Segurança Multi-tenant</span>
          </CardTitle>
          <CardDescription>
            Prova de que a arquitetura de segurança e isolamento de dados está funcionando
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Função do usuário:</span>
              <Badge variant="outline">{data.multitenancyProof.requestorRole}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Academia isolada por ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {data.multitenancyProof.isolatedByAcademyId}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timestamp da consulta:</span>
              <span className="text-xs">
                {new Date(data.multitenancyProof.timestamp).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}