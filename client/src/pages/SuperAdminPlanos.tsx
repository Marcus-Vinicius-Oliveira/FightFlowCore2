import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Calendar,
  DollarSign
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Plano, InsertPlano } from "@shared/schema";
import { insertPlanoSchema } from "@shared/schema";

export default function SuperAdminPlanos() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [location, setLocation] = useLocation();

  const form = useForm<InsertPlano>({
    resolver: zodResolver(insertPlanoSchema),
    defaultValues: {
      nome: "",
      limiteAlunos: 50,
      precoMensal: 5000, // in cents
      ativo: true
    }
  });

  // Handle deep-link create flow
  useEffect(() => {
    if (location === '/superadmin/planos/novo') {
      setIsCreateDialogOpen(true);
    }
  }, [location]);

  // Handle dialog close navigation
  const handleCreateDialogClose = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open && location === '/superadmin/planos/novo') {
      setLocation('/superadmin/planos');
    }
  };

  const { toast } = useToast();

  const { data: planos, isLoading } = useQuery<Plano[]>({
    queryKey: ["/api/superadmin/planos"],
  });

  const createPlanoMutation = useMutation({
    mutationFn: (planoData: InsertPlano) =>
      apiRequest("POST", "/api/superadmin/planos", planoData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/planos"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Plano criado com sucesso",
        description: "O novo plano foi adicionado à plataforma.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao criar plano",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertPlano) => {
    // Ensure precoMensal is converted to cents if needed
    const submitData = {
      ...data,
      precoMensal: typeof data.precoMensal === 'string' 
        ? Math.round(parseFloat(data.precoMensal) * 100)
        : data.precoMensal
    };
    createPlanoMutation.mutate(submitData);
  };

  const updatePlanoMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<InsertPlano>) =>
      apiRequest("PATCH", `/api/superadmin/planos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/planos"] });
      setEditingPlano(null);
      toast({
        title: "Plano atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar plano",
        description: "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePlano = () => {
    form.handleSubmit(onSubmit)();
  };

  const handleUpdatePlano = () => {
    if (!editingPlano) return;
    const { id, ...planoData } = editingPlano;
    updatePlanoMutation.mutate({ id, ...planoData });
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Planos</h1>
          <p className="text-muted-foreground mt-2">
            Criar e gerenciar planos de assinatura da plataforma
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Planos</h1>
          <p className="text-muted-foreground mt-2">
            Criar e gerenciar planos de assinatura da plataforma SaaS
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/superadmin/dashboard" data-testid="button-back-dashboard">
              Voltar ao Dashboard
            </Link>
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogClose}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-plan">
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Plano</DialogTitle>
                <DialogDescription>
                  Configure um novo plano de assinatura para a plataforma
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome do Plano</Label>
                  <Input
                    id="nome"
                    {...form.register("nome")}
                    placeholder="Ex: Faixa Branca"
                    data-testid="input-plan-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="limiteAlunos">Limite de Alunos</Label>
                  <Input
                    id="limiteAlunos"
                    type="number"
                    {...form.register("limiteAlunos", { valueAsNumber: true })}
                    data-testid="input-student-limit"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="precoMensal">Preço Mensal (R$)</Label>
                  <Input
                    id="precoMensal"
                    type="number"
                    step="0.01"
                    {...form.register("precoMensal", { 
                      setValueAs: (value) => Math.round(parseFloat(value) * 100)
                    })}
                    data-testid="input-monthly-price"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ativo"
                    {...form.register("ativo")}
                    data-testid="switch-plan-active"
                  />
                  <Label htmlFor="ativo">Plano ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreatePlano} disabled={createPlanoMutation.isPending}>
                  {createPlanoMutation.isPending ? "Criando..." : "Criar Plano"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-plans">
              {planos?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planos?.filter(p => p.ativo).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {planos && planos.length > 0
                ? formatPrice(planos.reduce((sum, p) => sum + p.precoMensal, 0) / planos.length)
                : 'R$ 0,00'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Planos</CardTitle>
          <CardDescription>
            Gerencie os planos de assinatura disponíveis na plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Limite de Alunos</TableHead>
                <TableHead>Preço Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planos?.map((plano) => (
                <TableRow key={plano.id} data-testid={`row-plan-${plano.id}`}>
                  <TableCell className="font-medium">{plano.nome}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {plano.limiteAlunos}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatPrice(plano.precoMensal)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={plano.ativo ? "default" : "secondary"}
                      className={plano.ativo 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                        : ""
                      }
                    >
                      {plano.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {plano.createdAt ? new Date(plano.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingPlano(plano)}
                      data-testid={`button-edit-plan-${plano.id}`}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!planos || planos.length === 0) && (
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

      {/* Edit Plan Dialog */}
      {editingPlano && (
        <Dialog open={!!editingPlano} onOpenChange={() => setEditingPlano(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Plano</DialogTitle>
              <DialogDescription>
                Modifique as configurações do plano {editingPlano.nome}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-nome">Nome do Plano</Label>
                <Input
                  id="edit-nome"
                  value={editingPlano.nome}
                  onChange={(e) => setEditingPlano({ ...editingPlano, nome: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-limiteAlunos">Limite de Alunos</Label>
                <Input
                  id="edit-limiteAlunos"
                  type="number"
                  value={editingPlano.limiteAlunos}
                  onChange={(e) => setEditingPlano({ ...editingPlano, limiteAlunos: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-precoMensal">Preço Mensal (R$)</Label>
                <Input
                  id="edit-precoMensal"
                  type="number"
                  step="0.01"
                  value={editingPlano.precoMensal / 100}
                  onChange={(e) => setEditingPlano({ ...editingPlano, precoMensal: Math.round(parseFloat(e.target.value) * 100) })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-ativo"
                  checked={editingPlano.ativo ?? false}
                  onCheckedChange={(checked) => setEditingPlano({ ...editingPlano, ativo: checked })}
                />
                <Label htmlFor="edit-ativo">Plano ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdatePlano} disabled={updatePlanoMutation.isPending}>
                {updatePlanoMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}