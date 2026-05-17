import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, Mail, Phone, Calendar, MoreHorizontal, Trash2, Eye, UserX, UserCheck, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { AdvancedFilters, FilterOptions, applyFilters } from "@/components/AdvancedFilters";

interface Instructor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}

const instructorFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  role: z.literal("PROFESSOR").default("PROFESSOR"),
});

type InstructorFormData = z.infer<typeof instructorFormSchema>;

interface InstructorFormProps {
  instructor?: Instructor;
  onClose: () => void;
}

function InstructorForm({ instructor, onClose }: InstructorFormProps) {
  const [formData, setFormData] = useState<InstructorFormData>({
    name: instructor?.name || "",
    email: instructor?.email || "",
    phone: instructor?.phone || "",
    role: "PROFESSOR",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: InstructorFormData) => apiRequest('POST', '/api/students', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Instrutor cadastrado com sucesso!",
        description: `${formData.name} foi adicionado à academia.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar instrutor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InstructorFormData) => apiRequest('PATCH', `/api/instructors/${instructor!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Instrutor atualizado com sucesso!",
        description: `Dados de ${formData.name} foram atualizados.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar instrutor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = instructorFormSchema.parse(formData);
      if (instructor) {
        updateMutation.mutate(validatedData);
      } else {
        createMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path) {
            errorMap[err.path[0] as string] = err.message;
          }
        });
        setErrors(errorMap);
      }
    }
  };

  const handleChange = (field: keyof InstructorFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome Completo *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Carlos Silva"
            data-testid="input-instructor-name"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="carlos@academia.com"
            data-testid="input-instructor-email"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(11) 99999-9999"
            data-testid="input-instructor-phone"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button 
          type="submit"
          disabled={isLoading}
          data-testid="button-save-instructor"
        >
          {isLoading ? "Salvando..." : (instructor ? "Atualizar" : "Cadastrar")}
        </Button>
      </div>
    </form>
  );
}

export default function InstructorManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deleteInstructor, setDeleteInstructor] = useState<Instructor | undefined>();
  const [permanentDeleteInstructor, setPermanentDeleteInstructor] = useState<Instructor | undefined>();
  const [activateInstructor, setActivateInstructor] = useState<Instructor | undefined>();
  const [viewInstructor, setViewInstructor] = useState<Instructor | undefined>();
  
  const [filters, setFilters] = useState<FilterOptions>({
    status: "all",
    belt: "",
    classTypeId: "",
    rankId: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "name",
    sortOrder: "asc",
  });

  const { data: instructors = [], isLoading } = useQuery<Instructor[]>({
    queryKey: ['/api/instructors'],
  });

  const filteredInstructors = applyFilters(instructors, filters, searchTerm);

  const handleEdit = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setShowForm(true);
  };

  const handleViewDetails = (instructor: Instructor) => {
    setViewInstructor(instructor);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedInstructor(undefined);
  };

  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (instructorId: string) => apiRequest('DELETE', `/api/instructors/${instructorId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      toast({
        title: "Instrutor removido com sucesso!",
        description: `${deleteInstructor?.name} foi removido da academia.`,
      });
      setDeleteInstructor(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover instrutor",
        description: error.message,
        variant: "destructive",
      });
      setDeleteInstructor(undefined);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (instructorId: string) => apiRequest('PATCH', `/api/instructors/${instructorId}`, { active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      toast({
        title: "Instrutor ativado com sucesso!",
        description: `${activateInstructor?.name} foi reativado na academia.`,
      });
      setActivateInstructor(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar instrutor",
        description: error.message,
        variant: "destructive",
      });
      setActivateInstructor(undefined);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (instructorId: string) => {
      // Capture instructor name before mutation for toast
      const instructorName = permanentDeleteInstructor?.name || "Instrutor";
      return apiRequest('DELETE', `/api/instructors/${instructorId}/permanent`)
        .then(result => ({ ...result, instructorName }));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      toast({
        title: "Instrutor excluído permanentemente!",
        description: `${data.instructorName} foi removido definitivamente do sistema.`,
      });
      setPermanentDeleteInstructor(undefined);
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      let errorTitle = "Erro ao excluir instrutor";
      
      // Handle specific error for instructor with associated classes
      if (error.message?.includes("Cannot permanently delete instructor with associated classes")) {
        errorTitle = "Instrutor não pode ser excluído";
        errorMessage = "Este instrutor possui aulas vinculadas. Remova ou reassigne as aulas antes de excluir o instrutor permanentemente.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setPermanentDeleteInstructor(undefined);
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return "-";
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Instrutores</h1>
            <p className="text-muted-foreground mt-2">Carregando dados dos instrutores...</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Instrutores</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todos os instrutores da sua academia
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="button-add-instructor">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Novo Instrutor
        </Button>
        
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-[600px]" key={selectedInstructor?.id || 'new'}>
            <DialogHeader>
              <DialogTitle>
                {selectedInstructor ? "Editar Instrutor" : "Adicionar Novo Instrutor"}
              </DialogTitle>
              <DialogDescription>
                {selectedInstructor 
                  ? "Atualize as informações do instrutor abaixo."
                  : "Preencha as informações do novo instrutor abaixo."
                }
              </DialogDescription>
            </DialogHeader>
            <InstructorForm instructor={selectedInstructor} onClose={handleCloseForm} />
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteInstructor} onOpenChange={(open) => !open && setDeleteInstructor(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Desativação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar o instrutor <strong>{deleteInstructor?.name}</strong>?
                O instrutor será marcado como inativo mas seus dados serão preservados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteInstructor && deleteMutation.mutate(deleteInstructor.id)}
                disabled={deleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Desativando..." : "Desativar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!activateInstructor} onOpenChange={(open) => !open && setActivateInstructor(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Ativação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja ativar o instrutor <strong>{activateInstructor?.name}</strong>?
                O instrutor voltará a ter acesso às funcionalidades da academia.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-activate">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => activateInstructor && activateMutation.mutate(activateInstructor.id)}
                disabled={activateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="button-confirm-activate"
              >
                {activateMutation.isPending ? "Ativando..." : "Ativar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!permanentDeleteInstructor} onOpenChange={(open) => !open && setPermanentDeleteInstructor(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão Permanente</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja <strong>excluir permanentemente</strong> o instrutor <strong>{permanentDeleteInstructor?.name}</strong>?
                <br /><br />
                <span className="text-destructive font-medium">⚠️ ATENÇÃO: Esta ação não pode ser desfeita!</span> Todos os dados do instrutor serão removidos definitivamente do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-permanent-delete">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => permanentDeleteInstructor && permanentDeleteMutation.mutate(permanentDeleteInstructor.id)}
                disabled={permanentDeleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-permanent-delete"
              >
                {permanentDeleteMutation.isPending ? "Excluindo..." : "Excluir Permanentemente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!viewInstructor} onOpenChange={(open) => !open && setViewInstructor(undefined)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detalhes do Instrutor</DialogTitle>
              <DialogDescription>
                Informações completas de {viewInstructor?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {viewInstructor?.name}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <div className="p-2 bg-muted rounded-md text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {viewInstructor?.email}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Telefone</Label>
                <div className="p-2 bg-muted rounded-md text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {formatPhone(viewInstructor?.phone)}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  <Badge variant={viewInstructor?.active ? "default" : "secondary"}>
                    {viewInstructor?.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data de Cadastro</Label>
                <div className="p-2 bg-muted rounded-md text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {viewInstructor && formatDate(viewInstructor.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewInstructor(undefined)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={filters}
        onFiltersChange={setFilters}
        className="mb-4"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Instrutores ({filteredInstructors.length} de {instructors.length})</span>
            <div className="relative w-72">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar instrutores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-instructors"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInstructors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum instrutor encontrado com esse termo." : "Nenhum instrutor cadastrado ainda."}
              </p>
              {!searchTerm && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowForm(true)}
                  data-testid="button-add-first-instructor"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Primeiro Instrutor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstructors.map((instructor) => (
                  <TableRow key={instructor.id} data-testid={`row-instructor-${instructor.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{instructor.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{instructor.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPhone(instructor.phone)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={instructor.active ? "default" : "secondary"}>
                        {instructor.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(instructor.createdAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`button-instructor-actions-${instructor.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleViewDetails(instructor);
                            }}
                            data-testid={`button-view-instructor-${instructor.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(instructor);
                            }}
                            data-testid={`button-edit-instructor-${instructor.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          {instructor.active ? (
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteInstructor(instructor);
                              }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-delete-instructor-${instructor.id}`}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Desativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActivateInstructor(instructor);
                              }}
                              className="text-emerald-600 focus:text-emerald-600"
                              data-testid={`button-activate-instructor-${instructor.id}`}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Ativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPermanentDeleteInstructor(instructor);
                            }}
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-permanent-delete-instructor-${instructor.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}