import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Clock, Search, Trash2, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  mergeGroupEnrollments,
  missingEnrollmentIds,
  occupancyText,
  formatDaysShort,
  type ClassEnrollmentRecord,
} from "@/lib/enrollments";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrollmentsDialogClass {
  id: string;
  ids: string[];
  classTypeId: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  classType?: { name: string; maxCapacity?: number | null };
  instructor?: { name: string };
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
  active?: boolean;
}

interface MembershipPlanOption {
  id: string;
  name: string;
  classTypeId: string | null;
}

interface ClassEnrollmentsDialogProps {
  classData: EnrollmentsDialogClass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

/** Invalida tudo que depende de matrículas: lista de turmas (ocupação),
 *  matrículas do grupo, presença e a ficha do aluno afetado. */
function invalidateAfterEnrollmentChange(studentId: string) {
  // Prefixo ['/api/classes'] cobre a lista de turmas, as matrículas do grupo,
  // o resumo por modalidade e as queries de presença ['/api/classes', id, 'attendance', ...].
  queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
  queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'enrollments'] });
  // Matricular em turma pode criar vínculo de modalidade + graduação inicial.
  queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'modality-enrollments'] });
  queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'modality-ranks'] });
  queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
  // 1ª matrícula num plano gera a 1ª mensalidade — Financeiro precisa refletir
  queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ClassEnrollmentsDialog({ classData, open, onOpenChange }: ClassEnrollmentsDialogProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [studentToRemove, setStudentToRemove] = useState<{ studentId: string; studentName: string; enrolledClassIds: string[] } | null>(null);

  const groupIds = classData?.ids ?? [];

  const {
    data: perClassEnrollments,
    isLoading,
    isError,
    refetch,
  } = useQuery<ClassEnrollmentRecord[]>({
    queryKey: ['/api/classes', 'group-enrollments', groupIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        groupIds.map(async id => ({
          classId: id,
          enrollments: await apiRequest('GET', `/api/classes/${id}/enrollments`).then(r => r.json()),
        }))
      );
      return results;
    },
    enabled: open && groupIds.length > 0,
  });

  const { data: students = [] } = useQuery<StudentOption[]>({
    queryKey: ['/api/students'],
    enabled: open,
  });

  const { data: plans = [] } = useQuery<MembershipPlanOption[]>({
    queryKey: ['/api/membership-plans'],
    enabled: open,
  });

  const enrolled = useMemo(
    () => mergeGroupEnrollments(perClassEnrollments ?? []),
    [perClassEnrollments]
  );

  const enrolledIds = useMemo(() => new Set(enrolled.map(e => e.studentId)), [enrolled]);

  const availableStudents = useMemo(
    () => students.filter(s => s.active !== false && !enrolledIds.has(s.id)),
    [students, enrolledIds]
  );

  const filteredEnrolled = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return enrolled;
    return enrolled.filter(e =>
      e.studentName.toLowerCase().includes(term) || e.studentEmail.toLowerCase().includes(term)
    );
  }, [enrolled, searchTerm]);

  // Pré-seleciona o plano da modalidade da turma quando o diálogo abre (o gestor
  // ainda pode trocar). Sem match (só planos gerais), deixa em branco.
  useEffect(() => {
    if (!open || !classData) return;
    const match = plans.find(p => p.classTypeId === classData.classTypeId);
    setSelectedPlanId(match ? match.id : "");
  }, [open, classData?.id, plans]);

  const enrollMutation = useMutation({
    mutationFn: async ({ studentId, planId }: { studentId: string; planId: string }) => {
      // Matricula em todos os registros (dias) do grupo em que o aluno ainda
      // não está — um request, transacional no servidor.
      const already = enrolled.find(e => e.studentId === studentId)?.enrolledClassIds ?? [];
      const classIds = missingEnrollmentIds(groupIds, already);
      if (classIds.length === 0) return { modalityAdded: false, modalityName: null, firstPaymentCreated: false };
      const res = await apiRequest('POST', '/api/classes/enrollment-groups', {
        studentId,
        membershipPlanId: planId,
        classIds,
      });
      const body = await res.json().catch(() => null);
      return {
        modalityAdded: !!body?.modalityAdded,
        modalityName: (body?.modalityName ?? null) as string | null,
        firstPaymentCreated: !!body?.firstPaymentCreated,
      };
    },
    onSuccess: ({ modalityAdded, modalityName, firstPaymentCreated }, { studentId }) => {
      invalidateAfterEnrollmentChange(studentId);
      const student = students.find(s => s.id === studentId);
      const base = modalityAdded
        ? `${student?.name ?? 'O aluno'} foi matriculado na turma — modalidade${modalityName ? ` ${modalityName}` : ''} adicionada ao perfil.`
        : `${student?.name ?? 'O aluno'} foi matriculado na turma.`;
      toast({
        title: "Aluno matriculado!",
        description: firstPaymentCreated ? `${base} 1ª mensalidade gerada no Financeiro.` : base,
      });
      setSelectedStudentId("");
    },
    onError: (error: Error, { studentId }) => {
      invalidateAfterEnrollmentChange(studentId);
      toast({ title: "Não foi possível matricular", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ studentId, enrolledClassIds }: { studentId: string; enrolledClassIds: string[] }) => {
      // Um request encerra o grupo inteiro (UPDATE único no servidor)
      await apiRequest('DELETE', '/api/classes/enrollment-groups', {
        studentId,
        classIds: enrolledClassIds,
      });
    },
    onSuccess: (_data, { studentId }) => {
      invalidateAfterEnrollmentChange(studentId);
      toast({ title: "Matrícula removida", description: "O aluno foi removido da turma." });
      setStudentToRemove(null);
    },
    onError: (error: Error, { studentId }) => {
      invalidateAfterEnrollmentChange(studentId);
      toast({ title: "Erro ao remover matrícula", description: error.message, variant: "destructive" });
    },
  });

  const handleEnroll = () => {
    if (!selectedStudentId) {
      toast({ title: "Selecione um aluno", description: "Escolha o aluno que será matriculado.", variant: "destructive" });
      return;
    }
    if (!selectedPlanId) {
      toast({ title: "Selecione um plano", description: "A matrícula precisa de um plano de mensalidade.", variant: "destructive" });
      return;
    }
    enrollMutation.mutate({ studentId: selectedStudentId, planId: selectedPlanId });
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const title = classData?.classType?.name ?? 'Turma';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Users className="h-5 w-5 shrink-0" />
              Matrículas — {title}
              <Badge variant="secondary" data-testid="badge-occupancy">
                {occupancyText(enrolled.length)}
              </Badge>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{formatDaysShort(classData?.daysOfWeek ?? [])}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {classData?.startTime} – {classData?.endTime}
              </span>
              {classData?.instructor?.name && <span>Prof. {classData.instructor.name}</span>}
            </DialogDescription>
          </DialogHeader>

          {/* ── Matricular aluno ── */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="flex-1 justify-between font-normal"
                  data-testid="button-pick-student"
                >
                  <span className={cn("truncate", !selectedStudent && "text-muted-foreground")}>
                    {selectedStudent?.name ?? "Selecionar aluno..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar aluno por nome..." data-testid="input-search-student" />
                  <CommandList>
                    <CommandEmpty>Nenhum aluno disponível encontrado.</CommandEmpty>
                    <CommandGroup>
                      {availableStudents.map(s => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => {
                            setSelectedStudentId(s.id === selectedStudentId ? "" : s.id);
                            setPickerOpen(false);
                          }}
                          data-testid={`option-student-${s.id}`}
                        >
                          <Check className={cn("mr-2 h-4 w-4", s.id === selectedStudentId ? "opacity-100" : "opacity-0")} />
                          <div className="min-w-0">
                            <p className="truncate">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger
                className="sm:w-[170px]"
                data-testid="select-enrollment-plan"
              >
                <span className={cn("truncate text-sm", !selectedPlanId && "text-muted-foreground")}>
                  {selectedPlanId ? plans.find(p => p.id === selectedPlanId)?.name ?? "Plano" : "Plano"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleEnroll}
              disabled={enrollMutation.isPending}
              data-testid="button-enroll-student"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {enrollMutation.isPending ? "Matriculando..." : "Matricular"}
            </Button>
          </div>

          {/* ── Busca na lista ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar matriculados..."
              className="pl-9"
              data-testid="input-search-enrolled"
            />
          </div>

          {/* ── Lista de matriculados ── */}
          {isLoading ? (
            <div className="space-y-2" data-testid="enrollments-loading">
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">Não foi possível carregar as matrículas.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-enrollments">
                Tentar novamente
              </Button>
            </div>
          ) : filteredEnrolled.length === 0 ? (
            <div className="text-center py-6" data-testid="enrollments-empty">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">
                {enrolled.length === 0 ? "Nenhum aluno matriculado ainda" : "Nenhum aluno corresponde à busca"}
              </p>
              <p className="text-sm text-muted-foreground">
                {enrolled.length === 0
                  ? "Use o campo acima para matricular o primeiro aluno."
                  : "Ajuste o termo de busca."}
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border" data-testid="enrollments-list">
              {filteredEnrolled.map(e => (
                <li key={e.studentId} className="flex items-center gap-3 p-2.5" data-testid={`enrollment-row-${e.studentId}`}>
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs">{getInitials(e.studentName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.studentEmail}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setStudentToRemove(e)}
                    aria-label={`Remover matrícula de ${e.studentName}`}
                    data-testid={`button-remove-enrollment-${e.studentId}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de remoção ── */}
      <AlertDialog open={!!studentToRemove} onOpenChange={open => !open && setStudentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover matrícula</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a matrícula de {studentToRemove?.studentName} desta turma?
              O histórico de presenças será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => studentToRemove && removeMutation.mutate(studentToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {removeMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
