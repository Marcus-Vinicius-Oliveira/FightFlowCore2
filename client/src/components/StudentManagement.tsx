import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, UserPlus, Edit, Trash2, Eye, AlertTriangle } from "lucide-react";
import { apiClient, type Student } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StudentFormData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  belt?: string;
}

export function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<StudentFormData>({
    name: "",
    email: "",
    password: "",
    phone: "",
    dateOfBirth: "",
    belt: ""
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch students
  const { data: students = [], isLoading, error } = useQuery({
    queryKey: ['/api/students'],
    queryFn: () => apiClient.getStudents(),
  });

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: (studentData: Omit<StudentFormData, 'id'>) =>
      apiClient.createStudent(studentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/instructors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
      setIsAddDialogOpen(false);
      setFormData({ name: "", email: "", password: "", phone: "", dateOfBirth: "", belt: "" });
      toast({
        title: "Aluno Adicionado",
        description: "Novo aluno foi adicionado com sucesso à sua academia.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Adicionar Aluno",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof StudentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createStudentMutation.mutate(formData);
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (active?: boolean) => {
    return active ? (
      <Badge variant="default" data-testid="badge-status-active">
        Ativo
      </Badge>
    ) : (
      <Badge variant="secondary" data-testid="badge-status-inactive">
        Inativo
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (error) {
    // Check if it's a permissions error
    const isPermissionError = error.message?.includes('Insufficient permissions') || 
                             error.message?.includes('permissions') ||
                             error.message?.includes('Academy ID required');
    
    const userFriendlyMessage = isPermissionError 
      ? "Você não tem permissão para visualizar estas informações. Fale com o administrador da sua conta para solicitar acesso."
      : `Erro ao carregar alunos: ${error.message}`;

    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center space-x-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>{userFriendlyMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Gerenciamento de Alunos</CardTitle>
            <CardDescription>
              Gerencie os alunos e matrículas da sua academia
            </CardDescription>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-student">
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Aluno
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Aluno</DialogTitle>
                <DialogDescription>
                  Crie uma nova conta de aluno para sua academia de artes marciais.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-name">Nome Completo</Label>
                    <Input
                      id="student-name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Nome completo do aluno"
                      required
                      data-testid="input-student-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-email">Email</Label>
                    <Input
                      id="student-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="aluno@email.com"
                      required
                      data-testid="input-student-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-phone">Telefone (Opcional)</Label>
                    <Input
                      id="student-phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="(11) 99999-9999"
                      data-testid="input-student-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-birthdate">Data de Nascimento (Opcional)</Label>
                    <Input
                      id="student-birthdate"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                      data-testid="input-student-birthdate"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-belt">Graduação/Faixa (Opcional)</Label>
                    <Input
                      id="student-belt"
                      value={formData.belt}
                      onChange={(e) => handleInputChange("belt", e.target.value)}
                      placeholder="Faixa Branca, 1º Kyu, etc."
                      data-testid="input-student-belt"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-password">Senha Temporária</Label>
                    <Input
                      id="student-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      placeholder="Aluno alterará no primeiro login"
                      required
                      data-testid="input-student-password"
                    />
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createStudentMutation.isPending}
                    data-testid="button-submit-student"
                  >
                    {createStudentMutation.isPending ? "Adicionando..." : "Adicionar Aluno"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar alunos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-student-search"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando alunos...</p>
          </div>
        )}

        {/* Students Table */}
        {!isLoading && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {students.length === 0 ? "Nenhum aluno encontrado" : "Nenhum aluno corresponde à sua busca"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span data-testid={`text-student-name-${student.id}`}>{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div data-testid={`text-student-email-${student.id}`}>{student.email}</div>
                          <div className="text-muted-foreground">{student.phone || 'Sem telefone'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(student.active)}
                      </TableCell>
                      <TableCell data-testid={`text-join-date-${student.id}`}>
                        {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              data-testid={`button-student-actions-${student.id}`}
                            >
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => console.log('View student:', student)}
                              data-testid={`button-view-student-${student.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => console.log('Edit student:', student)}
                              data-testid={`button-edit-student-${student.id}`}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => console.log('Delete student:', student)}
                              data-testid={`button-delete-student-${student.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Desativar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}