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
import { Plus, Search, Edit, Mail, Phone, Calendar, MoreHorizontal, Trash2, Eye, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  belt?: string;
  active: boolean;
  createdAt: string;
}

const studentFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  belt: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentFormSchema>;

interface StudentFormProps {
  student?: Student;
  onClose: () => void;
}

function StudentForm({ student, onClose }: StudentFormProps) {
  const [formData, setFormData] = useState<StudentFormData>({
    name: student?.name || "",
    email: student?.email || "",
    phone: student?.phone || "",
    dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.split('T')[0] : "",
    belt: student?.belt || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: StudentFormData) => apiRequest('POST', '/api/students', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Aluno cadastrado com sucesso!",
        description: `${formData.name} foi adicionado à academia.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar aluno",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: StudentFormData) => apiRequest('PATCH', `/api/students/${student!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Aluno atualizado com sucesso!",
        description: `Dados de ${formData.name} foram atualizados.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar aluno",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = studentFormSchema.parse(formData);
      if (student) {
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

  const handleChange = (field: keyof StudentFormData, value: string) => {
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
            placeholder="João Silva"
            data-testid="input-student-name"
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
            placeholder="joao@email.com"
            data-testid="input-student-email"
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
            data-testid="input-student-phone"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Data de Nascimento</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            data-testid="input-student-birthdate"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="belt">Graduação/Faixa</Label>
        <Input
          id="belt"
          value={formData.belt}
          onChange={(e) => handleChange("belt", e.target.value)}
          placeholder="Faixa Branca, 1º Kyu, etc."
          data-testid="input-student-belt"
        />
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
          data-testid="button-save-student"
        >
          {isLoading ? "Salvando..." : (student ? "Atualizar" : "Cadastrar")}
        </Button>
      </div>
    </form>
  );
}

export default function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<Student | undefined>();
  const [viewStudent, setViewStudent] = useState<Student | undefined>();

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['/api/students'],
  });

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (student: Student) => {
    console.log("handleEdit called for:", student.id);
    setSelectedStudent(student);
    setShowForm(true);
  };

  const handleViewDetails = (student: Student) => {
    console.log("handleViewDetails called for:", student.id);
    setViewStudent(student);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedStudent(undefined);
  };

  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (studentId: string) => apiRequest('DELETE', `/api/students/${studentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      toast({
        title: "Aluno removido com sucesso!",
        description: `${deleteStudent?.name} foi removido da academia.`,
      });
      setDeleteStudent(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover aluno",
        description: error.message,
        variant: "destructive",
      });
      setDeleteStudent(undefined);
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
            <h1 className="text-3xl font-bold">Gerenciamento de Alunos</h1>
            <p className="text-muted-foreground mt-2">Carregando dados dos alunos...</p>
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
          <h1 className="text-3xl font-bold">Gerenciamento de Alunos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todos os alunos da sua academia
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} data-testid="button-add-student">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Novo Aluno
        </Button>
        
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-[600px]" key={selectedStudent?.id || 'new'}>
            <DialogHeader>
              <DialogTitle>
                {selectedStudent ? "Editar Aluno" : "Adicionar Novo Aluno"}
              </DialogTitle>
              <DialogDescription>
                {selectedStudent 
                  ? "Atualize as informações do aluno abaixo."
                  : "Preencha as informações do novo aluno abaixo."
                }
              </DialogDescription>
            </DialogHeader>
            <StudentForm student={selectedStudent} onClose={handleCloseForm} />
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteStudent} onOpenChange={(open) => !open && setDeleteStudent(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Desativação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar o aluno <strong>{deleteStudent?.name}</strong>?
                O aluno será marcado como inativo mas seus dados serão preservados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteStudent && deleteMutation.mutate(deleteStudent.id)}
                disabled={deleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Desativando..." : "Desativar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!viewStudent} onOpenChange={(open) => !open && setViewStudent(undefined)}>
          {/* Debug: This should render when viewStudent is set */}
          {console.log("Dialog render - viewStudent:", viewStudent?.id, "isOpen:", !!viewStudent)}
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detalhes do Aluno</DialogTitle>
              <DialogDescription>
                Informações completas de {viewStudent?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {viewStudent?.name}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <div className="p-2 bg-muted rounded-md text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {viewStudent?.email}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Telefone</Label>
                <div className="p-2 bg-muted rounded-md text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {formatPhone(viewStudent?.phone)}
                </div>
              </div>

              {viewStudent?.dateOfBirth && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Data de Nascimento</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {new Date(viewStudent.dateOfBirth).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}

              {viewStudent?.belt && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Graduação</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    <Badge variant="secondary">{viewStudent.belt}</Badge>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  <Badge variant={viewStudent?.active ? "default" : "secondary"}>
                    {viewStudent?.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data de Cadastro</Label>
                <div className="p-2 bg-muted rounded-md text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {viewStudent && formatDate(viewStudent.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewStudent(undefined)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Alunos ({students.length})</span>
            <div className="relative w-72">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar alunos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-students"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum aluno encontrado com esse termo." : "Nenhum aluno cadastrado ainda."}
              </p>
              {!searchTerm && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowForm(true)}
                  data-testid="button-add-first-student"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Primeiro Aluno
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
                  <TableHead>Graduação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{student.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPhone(student.phone)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.belt ? (
                        <Badge variant="secondary">{student.belt}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.active ? "default" : "secondary"}>
                        {student.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(student.createdAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`button-student-actions-${student.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              try {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log("View student details:", student);
                                console.log("About to call handleViewDetails...");
                                handleViewDetails(student);
                                console.log("handleViewDetails completed");
                              } catch (error) {
                                console.error("Error in View Details onClick:", error);
                              }
                            }}
                            data-testid={`button-view-student-${student.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("Edit student:", student);
                              handleEdit(student);
                            }}
                            data-testid={`button-edit-student-${student.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("Deactivate student:", student);
                              console.log("Setting deleteStudent for confirmation");
                              setDeleteStudent(student);
                            }}
                            className="text-destructive focus:text-destructive"
                            data-testid={`button-delete-student-${student.id}`}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Desativar
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