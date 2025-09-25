import { useState } from "react";
import { useLocation } from "wouter";
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
  CreditCard, 
  Users, 
  Plus,
  Edit,
  Power
} from "lucide-react";

interface AcademyPlan {
  id: string;
  nome: string;
  valor: number;
  periodicidade: string;
  alunosAtivos: number;
  status: 'ativo' | 'inativo';
}

export default function PlanManagement() {
  const [, setLocation] = useLocation();
  
  // Sample data for the table
  const [plans] = useState<AcademyPlan[]>([
    {
      id: "1",
      nome: "Jiu-Jitsu - 3x Semana",
      valor: 15000, // R$ 150,00 in cents
      periodicidade: "Mensal",
      alunosAtivos: 25,
      status: "ativo"
    },
    {
      id: "2", 
      nome: "Plano Antigo 2024",
      valor: 13000, // R$ 130,00 in cents
      periodicidade: "Mensal",
      alunosAtivos: 0,
      status: "inativo"
    }
  ]);

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(priceInCents / 100);
  };

  return (
    <div className="max-w-none w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos e Matrículas</h1>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Plano</TableHead>
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
                  <TableCell className="font-medium">{plan.nome}</TableCell>
                  <TableCell className="font-mono">
                    {formatPrice(plan.valor)}
                  </TableCell>
                  <TableCell>{plan.periodicidade}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {plan.alunosAtivos}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={plan.status === 'ativo' ? "default" : "secondary"}
                      className={
                        plan.status === 'ativo' 
                          ? "status-ativo bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "status-inativo bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }
                    >
                      {plan.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {plan.status === 'ativo' ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`button-edit-plan-${plan.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
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
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        Nenhum plano cadastrado
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}