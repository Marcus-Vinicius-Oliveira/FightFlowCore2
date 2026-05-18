import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Mail, Phone, Calendar, MoreHorizontal, Trash2, Eye, UserX, UserCheck, Award, GraduationCap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { AdvancedFilters, FilterOptions, applyFilters } from "@/components/AdvancedFilters";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { BeltBadge, BeltBar, isLightHex } from "@/components/BeltBadge";
import { GraduationDialog } from "@/components/GraduationDialog";
import { invalidateAfterStudentChange } from "@/lib/cache-helpers";

interface Student {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  dateOfBirth?: string;
  belt?: string;
  active: boolean;
  createdAt: string;
}

interface GraduationRank {
  id: string;
  name: string;
  displayOrder: number;
  colorClass: string;
}
interface GraduationSystem {
  id: string;
  classTypeId: string | null;
  name: string;
  ranks: GraduationRank[];
}
interface ModalidadeFormRow {
  _key: string;
  classTypeId: string;
  rankId: string;
}

// Paleta para modalidades criadas pelo usuário (cores distintas e vividas)
const MODALITY_COLOR_PALETTE = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#a855f7',
];

function hashModalityColor(classTypeId: string): string {
  let h = 0;
  for (let i = 0; i < classTypeId.length; i++) {
    h = Math.imul(31, h) + classTypeId.charCodeAt(i) | 0;
  }
  return MODALITY_COLOR_PALETTE[Math.abs(h) % MODALITY_COLOR_PALETTE.length];
}

// Cores fixas para modalidades conhecidas (case-insensitive, sem acentos alternativos)
const KNOWN_MODALITY_COLORS: Record<string, string> = {
  'bjj':            '#3b82f6',
  'jiu-jitsu':      '#3b82f6',
  'jiu jitsu':      '#3b82f6',
  'muay thai':      '#ef4444',
  'muay-thai':      '#ef4444',
  'muaythai':       '#ef4444',
  'judô':           '#f97316',
  'judo':           '#f97316',
  'judô brasileiro':'#f97316',
};

function getModalityColor(classTypeId: string, name: string): string {
  const key = name.toLowerCase().trim();
  return KNOWN_MODALITY_COLORS[key] ?? hashModalityColor(classTypeId);
}

const studentFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
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
  });
  const [modalidadesForm, setModalidadesForm] = useState<ModalidadeFormRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasInitialized = useRef(false);
  const { toast } = useToast();

  const { data: formClassTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/classes/class-types'],
    queryFn: () => apiRequest('GET', '/api/classes/class-types').then(r => r.json()),
    enabled: !!student,
  });

  const { data: formGraduationSystems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
    enabled: !!student,
  });

  const { data: currentModalityRanks = [], isSuccess: ranksLoaded } = useQuery<{ classTypeId: string; rankId: string }[]>({
    queryKey: ['/api/students', student?.id, 'modality-ranks'],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/modality-ranks`).then(r => r.json()),
    enabled: !!student,
  });

  useEffect(() => {
    if (!student || hasInitialized.current || !ranksLoaded) return;
    hasInitialized.current = true;
    setModalidadesForm(
      currentModalityRanks.map(r => ({
        _key: Math.random().toString(36).slice(2) + Date.now().toString(36),
        classTypeId: r.classTypeId,
        rankId: r.rankId,
      }))
    );
  }, [ranksLoaded, currentModalityRanks, student]);

  const usedClassTypeIds = new Set(modalidadesForm.map(r => r.classTypeId).filter(Boolean));
  const canAddMore = formClassTypes.length > usedClassTypeIds.size;

  const getRanksForClassType = (classTypeId: string) => {
    const sys = formGraduationSystems.find(s => s.classTypeId === classTypeId);
    return (sys?.ranks ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
  };

  const addModalidade = () =>
    setModalidadesForm(prev => [...prev, { _key: Math.random().toString(36).slice(2) + Date.now().toString(36), classTypeId: '', rankId: '' }]);

  const removeModalidade = (_key: string) =>
    setModalidadesForm(prev => prev.filter(r => r._key !== _key));

  const updateModalidade = (_key: string, field: 'classTypeId' | 'rankId', value: string) =>
    setModalidadesForm(prev =>
      prev.map(r => {
        if (r._key !== _key) return r;
        if (field === 'classTypeId') return { ...r, classTypeId: value, rankId: '' };
        return { ...r, [field]: value };
      })
    );

  const updateMutation = useMutation({
    mutationFn: async (data: StudentFormData) => {
      await apiRequest('PATCH', `/api/students/${student!.id}`, {
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
        dateOfBirth: data.dateOfBirth || undefined,
      });

      const validRows = modalidadesForm.filter(r => r.classTypeId && r.rankId);
      const formIds = validRows.map(r => r.classTypeId);
      const initialIds = currentModalityRanks.map(r => r.classTypeId);
      const toRemove = initialIds.filter(id => !formIds.includes(id));
      const toUpsert = validRows.filter(row => {
        const initial = currentModalityRanks.find(r => r.classTypeId === row.classTypeId);
        return !initial || initial.rankId !== row.rankId;
      });

      await Promise.all([
        ...toRemove.map(classTypeId =>
          apiRequest('DELETE', `/api/students/${student!.id}/modality-enrollments/${classTypeId}`)
        ),
        ...toUpsert.map(row =>
          apiRequest('POST', `/api/students/${student!.id}/graduate-modality`, {
            classTypeId: row.classTypeId,
            rankId: row.rankId,
          })
        ),
      ]);
    },
    onSuccess: () => {
      invalidateAfterStudentChange(queryClient);
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/modality-ranks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'modality-ranks'] });
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
      updateMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path) errorMap[err.path[0] as string] = err.message;
        });
        setErrors(errorMap);
      }
    }
  };

  const handleChange = (field: keyof StudentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

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
          <input
            id="dateOfBirth"
            type="date"
            title="Data de Nascimento"
            value={formData.dateOfBirth}
            onChange={(e) => handleChange("dateOfBirth", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
            data-testid="input-student-birthdate"
          />
        </div>
      </div>

      {/* Modalidades e Graduações — somente no modo de edição */}
      {!!student && (
        <div className="space-y-2">
          <Label>Modalidades e Graduações</Label>
          <div className="space-y-2">
            {modalidadesForm.map((row) => {
              const ranks = getRanksForClassType(row.classTypeId);
              return (
                <div key={row._key} className="flex items-center gap-2">
                  <Select
                    value={row.classTypeId}
                    onValueChange={(v) => updateModalidade(row._key, 'classTypeId', v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {formClassTypes.map(ct => (
                        <SelectItem
                          key={ct.id}
                          value={ct.id}
                          disabled={usedClassTypeIds.has(ct.id) && ct.id !== row.classTypeId}
                        >
                          {ct.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={row.rankId}
                    onValueChange={(v) => updateModalidade(row._key, 'rankId', v)}
                    disabled={!row.classTypeId || ranks.length === 0}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Faixa" />
                    </SelectTrigger>
                    <SelectContent>
                      {ranks.map(rank => {
                        const c1 = rank.colorClass.split('|')[0];
                        return (
                          <SelectItem key={rank.id} value={rank.id}>
                            <span className="flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0 inline-block">
                                <circle cx="6" cy="6" r="6" fill={c1} />
                                {isLightHex(c1) && <circle cx="6" cy="6" r="5.5" fill="none" stroke="#d1d5db" strokeWidth="1" />}
                              </svg>
                              {rank.name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeModalidade(row._key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {canAddMore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addModalidade}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Modalidade
              </Button>
            )}

            {formClassTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma modalidade cadastrada ainda.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          data-testid="button-save-student"
        >
          {updateMutation.isPending ? "Salvando..." : "Atualizar"}
        </Button>
      </div>
    </form>
  );
}

export default function StudentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<Student | undefined>();
  const [viewStudent, setViewStudent] = useState<Student | undefined>();
  const [activateStudent, setActivateStudent] = useState<Student | undefined>();
  const [permanentDeleteStudent, setPermanentDeleteStudent] = useState<Student | undefined>();
  const [graduateStudent, setGraduateStudent] = useState<Student | undefined>();
  
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

  const { data: students = [], isLoading } = useQuery<Student[]>({
    queryKey: ['/api/students'],
  });

  const { data: modalityEnrollments = [] } = useQuery<{ studentId: string; classTypeId: string }[]>({
    queryKey: ['/api/students/academy-modality-enrollments'],
    queryFn: () => apiRequest('GET', '/api/students/academy-modality-enrollments').then(r => r.json()),
  });

  const { data: modalityRanks = [] } = useQuery<{ studentId: string; classTypeId: string; rankId: string }[]>({
    queryKey: ['/api/graduation/modality-ranks'],
    queryFn: () => apiRequest('GET', '/api/graduation/modality-ranks').then(r => r.json()),
  });

  const { data: classTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/classes/class-types'],
    queryFn: () => apiRequest('GET', '/api/classes/class-types').then(r => r.json()),
  });

  const { data: graduationSystems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
  });

  // Fix 2: pré-computa Sets por modalidade para lookups O(1) no filter
  const enrolledByModality = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const e of modalityEnrollments) {
      if (!map.has(e.classTypeId)) map.set(e.classTypeId, new Set());
      map.get(e.classTypeId)!.add(e.studentId);
    }
    return map;
  }, [modalityEnrollments]);

  // Fix 6: apenas modalidades com alunos aparecem no dropdown
  const availableClassTypeIds = useMemo(
    () => new Set(modalityEnrollments.map(e => e.classTypeId)),
    [modalityEnrollments]
  );

  // Fix 3: pré-computa Set de alunos por (modalidade + rank) para lookup O(1)
  const enrolledByModalityAndRank = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of modalityRanks) {
      const key = `${r.classTypeId}:${r.rankId}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(r.studentId);
    }
    return map;
  }, [modalityRanks]);

  const baseFiltered = applyFilters(students, filters, searchTerm);

  const filteredStudents = useMemo(() => {
    let result = baseFiltered;
    if (filters.classTypeId) {
      const enrolled = enrolledByModality.get(filters.classTypeId);
      result = result.filter(s => enrolled?.has(s.id) ?? false);
    }
    if (filters.classTypeId && filters.rankId) {
      const ranked = enrolledByModalityAndRank.get(`${filters.classTypeId}:${filters.rankId}`);
      result = result.filter(s => ranked?.has(s.id) ?? false);
    }
    return result;
  }, [baseFiltered, filters.classTypeId, filters.rankId, enrolledByModality, enrolledByModalityAndRank]);

  // rankId → colorClass (hex ou hex|hex)
  const rankById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sys of graduationSystems) {
      for (const rank of sys.ranks) map.set(rank.id, rank.colorClass);
    }
    return map;
  }, [graduationSystems]);

  // classTypeId → nome legível
  const classTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ct of classTypes) map.set(ct.id, ct.name);
    return map;
  }, [classTypes]);

  // studentId → [{ classTypeId, name, colorClass, modalityColor }]
  // colorClass = cor da faixa/rank (usada no anel do avatar ao filtrar)
  // modalityColor = cor fixa por modalidade (usada nos badges de chip)
  const studentModalityData = useMemo(() => {
    const rankKey = new Map<string, string>();
    for (const r of modalityRanks) {
      rankKey.set(`${r.studentId}:${r.classTypeId}`, r.rankId);
    }
    const map = new Map<string, { classTypeId: string; name: string; colorClass: string; modalityColor: string }[]>();
    for (const e of modalityEnrollments) {
      if (!map.has(e.studentId)) map.set(e.studentId, []);
      const rankId = rankKey.get(`${e.studentId}:${e.classTypeId}`);
      const colorClass = rankId ? (rankById.get(rankId) ?? '#6b7280') : '#6b7280';
      const name = classTypeById.get(e.classTypeId) ?? '—';
      map.get(e.studentId)!.push({
        classTypeId: e.classTypeId,
        name,
        colorClass,
        modalityColor: getModalityColor(e.classTypeId, name),
      });
    }
    return map;
  }, [modalityEnrollments, modalityRanks, rankById, classTypeById]);

  const hasModalityFilter = !!filters.classTypeId;

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setShowForm(true);
  };

  const handleViewDetails = (student: Student) => {
    setViewStudent(student);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedStudent(undefined);
  };

  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (studentId: string) => {
      // Capture student name before mutation for toast
      const studentName = deleteStudent?.name || "Aluno";
      return apiRequest('DELETE', `/api/students/${studentId}`)
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      invalidateAfterStudentChange(queryClient);
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
      // Capture student name before mutation for toast
      const studentName = activateStudent?.name || "Aluno";
      return apiRequest('PATCH', `/api/students/${studentId}`, { active: true })
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      invalidateAfterStudentChange(queryClient);
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
      // Capture student name before mutation for toast
      const studentName = permanentDeleteStudent?.name || "Aluno";
      return apiRequest('DELETE', `/api/students/${studentId}/permanent`)
        .then(result => ({ ...result, studentName }));
    },
    onSuccess: (data: any) => {
      invalidateAfterStudentChange(queryClient);
      toast({
        title: "Aluno excluído permanentemente!",
        description: `${data.studentName} foi removido definitivamente do sistema.`,
      });
      setPermanentDeleteStudent(undefined);
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      let errorTitle = "Erro ao excluir aluno";
      
      // Handle specific error for student with associated records
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return "-";
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gerenciamento de Alunos</h1>
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
      <div className="flex flex-wrap gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciamento de Alunos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todos os alunos da sua academia
          </p>
        </div>
        <Button onClick={() => setShowAddStudentDialog(true)} data-testid="button-add-student">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Novo Aluno
        </Button>
        
        <AddStudentDialog 
          open={showAddStudentDialog} 
          onOpenChange={setShowAddStudentDialog} 
        />
        
        {/* Dialog apenas para edição de alunos existentes */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-[600px]" key={selectedStudent?.id} onCloseAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Editar Aluno</DialogTitle>
              <DialogDescription>
                Atualize as informações do aluno abaixo.
              </DialogDescription>
            </DialogHeader>
            <StudentForm student={selectedStudent} onClose={handleCloseForm} />
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteStudent} onOpenChange={(open) => !open && setDeleteStudent(undefined)}>
          <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
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

        <AlertDialog open={!!activateStudent} onOpenChange={(open) => !open && setActivateStudent(undefined)}>
          <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
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

        <AlertDialog open={!!permanentDeleteStudent} onOpenChange={(open) => !open && setPermanentDeleteStudent(undefined)}>
          <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
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
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-permanent-delete"
              >
                {permanentDeleteMutation.isPending ? "Excluindo..." : "Excluir Permanentemente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!viewStudent} onOpenChange={(open) => !open && setViewStudent(undefined)}>
          <DialogContent className="max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
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

              <div className="space-y-2">
                <Label className="text-sm font-medium">Graduação</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  <BeltBadge belt={viewStudent?.belt} />
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

      {/* Search + Filters (mobile-first: search on top, filter bar below) */}
      <AdvancedFilters
        filters={filters}
        onFiltersChange={setFilters}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        availableClassTypeIds={availableClassTypeIds}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lista de Alunos —{" "}
            <span className="text-foreground font-semibold">
              {filteredStudents.length}
            </span>{" "}
            de {students.length}
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
                  onClick={() => setShowAddStudentDialog(true)}
                  data-testid="button-add-first-student"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Primeiro Aluno
                </Button>
              )}
            </div>
          ) : (
            <>
            {/* ── MOBILE: cards (< md) ─────────────────────────────────── */}
            <div className="md:hidden space-y-1.5">
              {filteredStudents.map((student) => {
                const modalities = studentModalityData.get(student.id) ?? [];

                // Quando há filtro de modalidade: mostra a cor da faixa naquela luta
                // como anel colorido no Avatar em vez de chips
                const activeModality = hasModalityFilter
                  ? modalities.find(m => m.classTypeId === filters.classTypeId)
                  : null;
                const ringColor = activeModality?.colorClass.split('|')[0];
                const ringNeedsBorder = ringColor ? isLightHex(ringColor) : false;

                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg border bg-card"
                    data-testid={`row-student-${student.id}`}
                  >
                    {/* Avatar — anel colorido pela faixa quando filtro de modalidade ativo */}
                    <Avatar
                      className="h-9 w-9 shrink-0"
                      style={ringColor ? {
                        outline: `3px solid ${ringColor}`,
                        outlineOffset: '2px',
                        boxShadow: ringNeedsBorder ? '0 0 0 4px #d1d5db' : 'none',
                      } : {}}
                    >
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(student.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      {/* Linha 1: Nome + ponto de status + menu */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-sm leading-none truncate">{student.name}</p>
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${student.active ? 'bg-green-500' : 'bg-red-400'}`}
                          />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 shrink-0"
                              data-testid={`button-student-actions-${student.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewDetails(student); }}
                              data-testid={`button-view-student-${student.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(student); }}
                              data-testid={`button-edit-student-${student.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGraduateStudent(student); }}
                              data-testid={`button-graduate-student-${student.id}`}
                            >
                              <Award className="h-4 w-4 mr-2 text-yellow-500" />Registrar Graduação
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {student.active ? (
                              <DropdownMenuItem
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteStudent(student); }}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-deactivate-student-${student.id}`}
                              >
                                <UserX className="h-4 w-4 mr-2" />Desativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActivateStudent(student); }}
                                className="text-green-600 focus:text-green-600"
                                data-testid={`button-activate-student-${student.id}`}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />Reativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPermanentDeleteStudent(student); }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-permanent-delete-student-${student.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Linha 2: Telefone + Data de matrícula */}
                      <div className="flex items-center gap-3 mt-0.5">
                        {student.phone && (
                          <span className="text-xs text-muted-foreground">{formatPhone(student.phone)}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDate(student.createdAt)}</span>
                      </div>

                      {/* Linha 3: chips de modalidade — apenas sem filtro de modalidade ativo */}
                      {!hasModalityFilter && modalities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {modalities.map(m => (
                            <span
                              key={m.classTypeId}
                              className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                            >
                              <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0" aria-hidden="true">
                                <circle cx="4" cy="4" r="4" fill={m.modalityColor} />
                              </svg>
                              {m.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP: tabela (≥ md) ───────────────────────────────── */}
            <div className="hidden md:block w-full overflow-x-auto border rounded-md">
              <div className="min-w-[700px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Modalidades</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${student.active ? 'bg-green-500' : 'bg-red-400'}`} />
                            <span className="font-medium">{student.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatPhone(student.phone)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(studentModalityData.get(student.id) ?? []).map(m => (
                              <span
                                key={m.classTypeId}
                                className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                              >
                                <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0" aria-hidden="true">
                                  <circle cx="4" cy="4" r="4" fill={m.modalityColor} />
                                </svg>
                                {m.name}
                              </span>
                            ))}
                            {(studentModalityData.get(student.id) ?? []).length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.active ? "default" : "secondary"}>
                            {student.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(student.createdAt)}
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
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleViewDetails(student); }}
                                data-testid={`button-view-student-${student.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(student); }}
                                data-testid={`button-edit-student-${student.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGraduateStudent(student); }}
                                data-testid={`button-graduate-student-${student.id}`}
                              >
                                <Award className="h-4 w-4 mr-2 text-yellow-500" />Registrar Graduação
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {student.active ? (
                                <DropdownMenuItem
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteStudent(student); }}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`button-deactivate-student-${student.id}`}
                                >
                                  <UserX className="h-4 w-4 mr-2" />Desativar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActivateStudent(student); }}
                                  className="text-green-600 focus:text-green-600"
                                  data-testid={`button-activate-student-${student.id}`}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />Reativar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPermanentDeleteStudent(student); }}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-permanent-delete-student-${student.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <GraduationDialog
        student={graduateStudent}
        open={!!graduateStudent}
        onOpenChange={(open) => !open && setGraduateStudent(undefined)}
      />
    </div>
  );
}