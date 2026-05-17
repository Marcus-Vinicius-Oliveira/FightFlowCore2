import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, UserPlus, Edit, Trash2, Eye, AlertTriangle, Mail, UserX, UserCheck, Award } from "lucide-react";
import { type Student } from "@/lib/api";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { GraduationDialog } from "@/components/GraduationDialog";
import { BeltBar } from "@/components/BeltBadge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// ─── Modality rank types and badge ────────────────────────────────────────────

interface ModalityRankEntry {
  studentId: string;
  classTypeId: string;
  rankId: string;
  rankName: string;
  colorClass: string;
}

function ModalityRanksBadges({ studentId, ranks }: { studentId: string; ranks: ModalityRankEntry[] }) {
  const mine = ranks.filter(r => r.studentId === studentId);
  if (mine.length === 0) return <span className="text-muted-foreground text-sm">—</span>;

  const visible = mine.slice(0, 3);
  const extra = mine.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {visible.map(r => (
        <BeltBar key={r.classTypeId} color={r.colorClass} name={r.rankName} width={52} height={14} />
      ))}
      {extra > 0 && (
        <span className="text-xs text-muted-foreground">+{extra}</span>
      )}
    </div>
  );
}

// Student Edit Form Schema
const studentEditFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  belt: z.string().optional(),
});

type StudentEditFormData = z.infer<typeof studentEditFormSchema>;

// Shared grid layout for students table
const STUDENTS_GRID_COLUMNS = '2fr 2fr 1fr 1.5fr 100px';

interface StudentEditFormProps {
  student?: Student;
  onClose: () => void;
  updateMutation: any;
}

function StudentEditForm({ student, onClose, updateMutation }: StudentEditFormProps) {
  const [formData, setFormData] = useState<StudentEditFormData>({
    name: student?.name || "",
    email: student?.email || "",
    phone: student?.phone || "",
    dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.split('T')[0] : "",
    belt: student?.belt || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = studentEditFormSchema.parse(formData);
      updateMutation.mutate(validatedData);
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

  const handleChange = (field: keyof StudentEditFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const isLoading = updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Nome Completo *</Label>
          <Input
            id="edit-name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="João Silva"
            data-testid="input-edit-student-name"
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-email">Email *</Label>
          <Input
            id="edit-email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="joao@email.com"
            data-testid="input-edit-student-email"
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-phone">Telefone</Label>
          <Input
            id="edit-phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="(11) 99999-9999"
            data-testid="input-edit-student-phone"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-dateOfBirth">Data de Nascimento</Label>
          <Input
            id="edit-dateOfBirth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            data-testid="input-edit-student-birthdate"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-belt">Graduação/Faixa</Label>
        <Input
          id="edit-belt"
          value={formData.belt}
          onChange={(e) => handleChange("belt", e.target.value)}
          placeholder="Faixa Branca, 1º Kyu, etc."
          data-testid="input-edit-student-belt"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          data-testid="button-cancel-edit"
        >
          Cancelar
        </Button>
        <Button 
          type="submit"
          disabled={isLoading}
          data-testid="button-save-edit"
        >
          {isLoading ? "Salvando..." : "Atualizar"}
        </Button>
      </div>
    </form>
  );
}

export function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClassTypeId, setFilterClassTypeId] = useState('');
  const [filterRankId, setFilterRankId] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();
  const [showEditForm, setShowEditForm] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | undefined>();
  const [deleteStudent, setDeleteStudent] = useState<Student | undefined>();
  const [activateStudent, setActivateStudent] = useState<Student | undefined>();
  const [permanentDeleteStudent, setPermanentDeleteStudent] = useState<Student | undefined>();
  const [graduateStudent, setGraduateStudent] = useState<Student | undefined>();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch students
  const { data: students = [], isLoading, error } = useQuery<Student[]>({
    queryKey: ['/api/students'],
  });

  // Fetch all modality ranks for the academy (for multi-badge display)
  const { data: modalityRanks = [] } = useQuery<ModalityRankEntry[]>({
    queryKey: ['/api/graduation/modality-ranks'],
    queryFn: () => apiRequest('GET', '/api/graduation/modality-ranks').then(r => r.json()),
  });

  // Fetch academy-wide modality enrollments for the modality filter
  const { data: modalityEnrollments = [] } = useQuery<{ studentId: string; classTypeId: string }[]>({
    queryKey: ['/api/students/academy-modality-enrollments'],
    queryFn: () => apiRequest('GET', '/api/students/academy-modality-enrollments').then(r => r.json()),
  });

  // Fetch class types for the modality filter labels
  const { data: classTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/classes/class-types'],
  });

  // Fetch graduation systems for the rank filter dropdown
  const { data: graduationSystems = [] } = useQuery<{ id: string; classTypeId: string | null; ranks: { id: string; name: string; displayOrder: number; colorClass: string }[] }[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
  });

  // Class types that have at least one active enrollment (for modality dropdown)
  const enrolledClassTypeIds = new Set(modalityEnrollments.map(e => e.classTypeId));
  const filterableClassTypes = classTypes.filter(ct => enrolledClassTypeIds.has(ct.id));

  // Ranks for the currently selected modality filter
  const activeFilterSystem = graduationSystems.find(s => s.classTypeId === filterClassTypeId);
  const ranksForFilter = (activeFilterSystem?.ranks ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);

  // Handler functions
  const handleViewDetails = (student: Student) => {
    setViewStudent(student);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setShowEditForm(true);
  };

  const handleCloseEditForm = () => {
    setShowEditForm(false);
    setSelectedStudent(undefined);
  };

  // Mutations for student operations
  const deleteMutation = useMutation({
    mutationFn: (studentId: string) => {
      const studentName = deleteStudent?.name || "Aluno";
      return apiRequest('DELETE', `/api/students/${studentId}`)
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({
        title: "Aluno desativado com sucesso!",
        description: `${data.studentName} foi desativado da academia.`,
      });
      setDeleteStudent(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desativar aluno",
        description: error.message,
        variant: "destructive",
      });
      setDeleteStudent(undefined);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (studentId: string) => {
      const studentName = activateStudent?.name || "Aluno";
      return apiRequest('PATCH', `/api/students/${studentId}`, { active: true })
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({
        title: "Aluno ativado com sucesso!",
        description: `${data.studentName} foi reativado na academia.`,
      });
      setActivateStudent(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar aluno",
        description: error.message,
        variant: "destructive",
      });
      setActivateStudent(undefined);
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (studentId: string) => {
      const studentName = permanentDeleteStudent?.name || "Aluno";
      return apiRequest('DELETE', `/api/students/${studentId}/permanent`)
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({
        title: "Aluno excluído permanentemente!",
        description: `${data.studentName} foi removido definitivamente do sistema.`,
      });
      setPermanentDeleteStudent(undefined);
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      let errorTitle = "Erro ao excluir aluno";
      
      if (error.message?.includes("Cannot permanently delete student with associated records")) {
        errorTitle = "Aluno não pode ser excluído";
        errorMessage = "Este aluno possui registros vinculados (matrículas, frequência ou pagamentos). Remova estes registros antes de excluir o aluno permanentemente.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setPermanentDeleteStudent(undefined);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      const studentName = selectedStudent?.name || "Aluno";
      return apiRequest('PATCH', `/api/students/${selectedStudent!.id}`, data)
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({
        title: "Aluno atualizado com sucesso!",
        description: `Dados de ${data.studentName} foram atualizados.`,
      });
      handleCloseEditForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar aluno",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesModality = !filterClassTypeId ||
      modalityEnrollments.some(e => e.studentId === student.id && e.classTypeId === filterClassTypeId);

    const matchesRank = !filterRankId || !filterClassTypeId ||
      modalityRanks.some(r => r.studentId === student.id && r.classTypeId === filterClassTypeId && r.rankId === filterRankId);

    return matchesSearch && matchesModality && matchesRank;
  });

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

          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            data-testid="button-add-student"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Adicionar Aluno
          </Button>
          
          <AddStudentDialog 
            open={isAddDialogOpen} 
            onOpenChange={setIsAddDialogOpen} 
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar alunos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-student-search"
            />
          </div>

          {filterableClassTypes.length > 0 && (
            <Select
              value={filterClassTypeId || '__all__'}
              onValueChange={(v) => {
                setFilterClassTypeId(v === '__all__' ? '' : v);
                setFilterRankId('');
              }}
            >
              <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por modalidade">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as modalidades</SelectItem>
                {filterableClassTypes.map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filterClassTypeId && ranksForFilter.length > 0 && (
            <Select
              value={filterRankId || '__all__'}
              onValueChange={(v) => setFilterRankId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por graduação">
                <SelectValue placeholder="Graduação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as graduações</SelectItem>
                {ranksForFilter.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block rounded-sm shrink-0"
                        style={{
                          width: 32,
                          height: 10,
                          background: r.colorClass.includes('|')
                            ? `linear-gradient(to right, ${r.colorClass.split('|')[0]} 50%, ${r.colorClass.split('|')[1]} 50%)`
                            : r.colorClass,
                          border: '1px solid #d1d5db',
                        }}
                      />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando alunos...</p>
          </div>
        )}

        {/* Students Table - Custom Implementation with Sticky Header */}
        {!isLoading && (
          <div className="rounded-md border" data-testid="students-table-container">
            <div 
              className="h-[400px] overflow-y-auto"
              data-testid="scroll-area-students"
            >
              {/* Fixed Header */}
              <div 
                className="sticky top-0 z-20 bg-background border-b grid gap-4 p-4 font-semibold text-sm text-muted-foreground"
                style={{
                  gridTemplateColumns: STUDENTS_GRID_COLUMNS
                }}
              >
                <div>Aluno</div>
                <div>Contato</div>
                <div>Status</div>
                <div>Graduações</div>
                <div>Ações</div>
              </div>

              {/* Table Content */}
              <div className="divide-y">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {students.length === 0 ? "Nenhum aluno encontrado" : "Nenhum aluno corresponde à sua busca"}
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <div 
                      key={student.id} 
                      className="grid gap-4 p-4"
                      style={{ gridTemplateColumns: STUDENTS_GRID_COLUMNS }}
                      data-testid={`row-student-${student.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium" data-testid={`text-student-name-${student.id}`}>
                          {student.name}
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <div data-testid={`text-student-email-${student.id}`}>{student.email}</div>
                        <div className="text-muted-foreground">{student.phone || 'Sem telefone'}</div>
                      </div>
                      
                      <div>
                        {getStatusBadge(student.active)}
                      </div>

                      <div>
                        <ModalityRanksBadges studentId={student.id} ranks={modalityRanks} />
                      </div>
                      
                      <div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              data-testid={`button-student-actions-${student.id}`}
                            >
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleViewDetails(student)}
                              data-testid={`button-view-student-${student.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(student)}
                              data-testid={`button-edit-student-${student.id}`}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setGraduateStudent(student)}
                              data-testid={`button-graduate-student-${student.id}`}
                            >
                              <Award className="mr-2 h-4 w-4 text-yellow-500" />
                              Registrar Graduação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {student.active ? (
                              <DropdownMenuItem 
                                onClick={() => setDeleteStudent(student)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-deactivate-student-${student.id}`}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Desativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => setActivateStudent(student)}
                                className="text-green-600 focus:text-green-600"
                                data-testid={`button-activate-student-${student.id}`}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Reativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => setPermanentDeleteStudent(student)}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-permanent-delete-student-${student.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal de Edição */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="sm:max-w-[600px]" key={selectedStudent?.id}>
          <DialogHeader>
            <DialogTitle>Editar Aluno</DialogTitle>
            <DialogDescription>
              Atualize as informações do aluno {selectedStudent?.name}.
            </DialogDescription>
          </DialogHeader>
          <StudentEditForm 
            student={selectedStudent} 
            onClose={handleCloseEditForm}
            updateMutation={updateMutation}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Ver Detalhes */}
      <Dialog open={!!viewStudent} onOpenChange={(open) => !open && setViewStudent(undefined)}>
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
              <div className="p-2 bg-muted rounded-md text-sm">
                {viewStudent?.phone || "Não informado"}
              </div>
            </div>

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
              <div className="p-2 bg-muted rounded-md text-sm">
                {viewStudent?.createdAt ? new Date(viewStudent.createdAt).toLocaleDateString() : "N/A"}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog de Desativação */}
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
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog de Ativação */}
      <AlertDialog open={!!activateStudent} onOpenChange={(open) => !open && setActivateStudent(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ativação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reativar o aluno <strong>{activateStudent?.name}</strong>?
              O aluno voltará a ter acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-activate">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activateStudent && activateMutation.mutate(activateStudent.id)}
              disabled={activateMutation.isPending}
              data-testid="button-confirm-activate"
            >
              {activateMutation.isPending ? "Ativando..." : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog de Exclusão Permanente */}
      <AlertDialog open={!!permanentDeleteStudent} onOpenChange={(open) => !open && setPermanentDeleteStudent(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão Permanente</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              Tem certeza que deseja <strong>excluir permanentemente</strong> o aluno <strong>{permanentDeleteStudent?.name}</strong>?
              <br />
              <span className="text-destructive font-medium">⚠️ Esta ação não pode ser desfeita!</span>
              <br />
              <span className="text-sm text-muted-foreground">Todos os dados do aluno serão removidos definitivamente do sistema.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-permanent-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteStudent && permanentDeleteMutation.mutate(permanentDeleteStudent.id)}
              disabled={permanentDeleteMutation.isPending}
              data-testid="button-confirm-permanent-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleteMutation.isPending ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GraduationDialog
        student={graduateStudent}
        open={!!graduateStudent}
        onOpenChange={(open) => !open && setGraduateStudent(undefined)}
      />
    </Card>
  );
}