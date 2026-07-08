import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  Users,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MembershipPlan } from "@/lib/api";

const PLANS_KEY = ['/api/membership-plans', { includeInactive: true }] as const;

/** duration (dias) → periodicidade legível. Inverso do mapa de CreatePlan. */
function periodicityLabel(durationDays: number): string {
  const map: Record<number, string> = { 30: 'Mensal', 60: 'Bimestral', 90: 'Trimestral', 180: 'Semestral', 365: 'Anual' };
  return map[durationDays] ?? `${durationDays} dias`;
}

function formatPrice(priceInCents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceInCents / 100);
}

export default function PlanManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [planToDeactivate, setPlanToDeactivate] = useState<MembershipPlan | null>(null);

  const { data: plans = [], isLoading, isError, refetch } = useQuery<MembershipPlan[]>({
    queryKey: PLANS_KEY,
    queryFn: () => apiRequest('GET', '/api/membership-plans?includeInactive=true').then(r => r.json()),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest('PATCH', `/api/membership-plans/${id}`, { active }),
    onSuccess: (_data, { active }) => {
      // Invalida também a lista de planos ativos que os modais de matrícula usam.
      queryClient.invalidateQueries({ queryKey: ['/api/membership-plans'] });
      toast({
        title: active ? 'Plano reativado' : 'Plano desativado',
        description: active
          ? 'O plano voltou a ficar disponível para novas matrículas.'
          : 'O plano não aparece mais para novas matrículas. Os alunos já matriculados não são afetados.',
      });
      setPlanToDeactivate(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Não foi possível alterar o plano', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="max-w-none w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Planos e Matrículas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os planos de matrícula oferecidos pela sua academia
          </p>
        </div>
        <Button
          className="flex items-center gap-2"
          onClick={() => setLocation("/dashboard/planos/novo")}
          data-testid="button-create-plan"
        >
          <Plus className="h-4 w-4" />
          Criar Novo Plano
        </Button>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Planos de Matrícula
          </CardTitle>
          <CardDescription>
            Lista de todos os planos disponíveis para matrícula de alunos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" data-testid="plans-loading">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">Não foi possível carregar os planos.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-plans">
                Tentar novamente
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8" data-testid="plans-empty">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Nenhum plano cadastrado</div>
              <Button variant="outline" size="sm" onClick={() => setLocation("/dashboard/planos/novo")}>
                <Plus className="h-4 w-4 mr-2" />
                Criar o primeiro plano
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Plano</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Alunos Ativos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} data-testid={`row-plan-${plan.id}`}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>
                      {plan.classTypeName
                        ? <Badge variant="secondary" className="font-normal">{plan.classTypeName}</Badge>
                        : <span className="text-muted-foreground text-sm">Geral</span>}
                    </TableCell>
                    <TableCell className="font-mono">{formatPrice(plan.price)}</TableCell>
                    <TableCell>{periodicityLabel(plan.duration)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {plan.activeStudents ?? 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={plan.active ? "default" : "secondary"}
                        className={
                          plan.active
                            ? "status-ativo bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "status-inativo bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                        }
                      >
                        {plan.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {plan.active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPlanToDeactivate(plan)}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-deactivate-plan-${plan.id}`}
                          >
                            <PowerOff className="h-4 w-4 mr-2" />
                            Desativar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ id: plan.id, active: true })}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-reactivate-plan-${plan.id}`}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            Reativar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmação de desativação */}
      <AlertDialog open={!!planToDeactivate} onOpenChange={open => !open && setPlanToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar plano</AlertDialogTitle>
            <AlertDialogDescription>
              Desativar "{planToDeactivate?.name}"? Ele deixa de aparecer para novas matrículas.
              {(planToDeactivate?.activeStudents ?? 0) > 0
                ? ` Os ${planToDeactivate!.activeStudents} aluno(s) já matriculado(s) neste plano continuam sendo cobrados normalmente.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-deactivate">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => planToDeactivate && toggleMutation.mutate({ id: planToDeactivate.id, active: false })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-deactivate"
            >
              {toggleMutation.isPending ? 'Desativando...' : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
