import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, AlertTriangle, RefreshCw } from "lucide-react";
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
}

export function DashboardInfo() {
  const { isAuthenticated } = useAuth();
  
  const { data, isLoading, error, refetch } = useQuery<DashboardInfoData>({
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Erro ao carregar informações da academia</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="text-xs"
              data-testid="button-retry-academy-info"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Tentar Novamente
            </Button>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Academia: {data.academy.name}</p>
              <p className="text-sm text-muted-foreground">Email: {data.academy.email}</p>
            </div>
            <Badge
              variant="secondary"
              className="text-xs"
              title="Identificador público da academia — usado nas URLs do portal do aluno e do QR de check-in. O ID interno é um UUID."
            >
              Identificador: {data.academy.slug}
            </Badge>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}