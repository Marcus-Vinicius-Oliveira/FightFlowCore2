import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, Trash2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  groupStudentEnrollments,
  missingEnrollmentIds,
  occupancy,
  formatDaysShort,
  type StudentEnrollmentRecord,
} from "@/lib/enrollments";

interface ClassGroupOption {
  id: string;
  ids: string[];
  classTypeId: string;
  instructorId: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  enrolledCount: number;
  classType?: { name: string; maxCapacity?: number | null };
  instructor?: { name: string };
}

interface MembershipPlanOption {
  id: string;
  name: string;
}

interface StudentClassEnrollmentsProps {
  studentId: string;
  studentName: string;
}

/** Seção "Turmas" da ficha do aluno: turmas em que está matriculado,
 *  matrícula em nova turma e remoção com confirmação. */
export function StudentClassEnrollments({ studentId, studentName }: StudentClassEnrollmentsProps) {
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [groupToRemove, setGroupToRemove] = useState<{ key: string; classTypeName: string; classIds: string[] } | null>(null);

  const {
    data: enrollmentRecords,
    isLoading,
    isError,
    refetch,
  } = useQuery<StudentEnrollmentRecord[]>({
    queryKey: ['/api/students', studentId, 'enrollments'],
    queryFn: () => apiRequest('GET', `/api/students/${studentId}/enrollments`).then(r => r.json()),
    enabled: !!studentId,
  });

  const { data: classGroups = [] } = useQuery<ClassGroupOption[]>({
    queryKey: ['/api/classes'],
  });

  const { data: plans = [] } = useQuery<MembershipPlanOption[]>({
    queryKey: ['/api/membership-plans'],
  });

  const enrolledGroups = useMemo(
    () => groupStudentEnrollments(enrollmentRecords ?? []),
    [enrollmentRecords]
  );

  const enrolledKeys = useMemo(() => new Set(enrolledGroups.map(g => g.key)), [enrolledGroups]);

  const groupKey = (g: ClassGroupOption) => `${g.classTypeId}|${g.instructorId}|${g.startTime}|${g.endTime}`;

  const availableGroups = useMemo(
    () => classGroups.filter(g => !enrolledKeys.has(groupKey(g))),
    [classGroups, enrolledKeys]
  );

  const selectedGroup = classGroups.find(g => g.id === selectedGroupId);

  const enrollMutation = useMutation({
    mutationFn: async ({ group, planId }: { group: ClassGroupOption; planId: string }) => {
      // Sequencial para parar na primeira falha (ex.: turma lotada)
      for (const id of missingEnrollmentIds(group.ids, [])) {
        await apiRequest('POST', `/api/classes/${id}/enrollments`, {
          studentId,
          membershipPlanId: planId,
        });
      }
    },
    onSuccess: (_data, { group }) => {
      invalidate();
      toast({
        title: "Aluno matriculado!",
        description: `${studentName} foi matriculado em ${group.classType?.name ?? 'turma'}.`,
      });
      setSelectedGroupId("");
    },
    onError: (error: Error) => {
      invalidate();
      toast({ title: "Não foi possível matricular", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ classIds }: { classIds: string[] }) => {
      await Promise.all(
        classIds.map(id => apiRequest('DELETE', `/api/classes/${id}/enrollments/${studentId}`))
      );
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Matrícula removida", description: `${studentName} foi removido da turma.` });
      setGroupToRemove(null);
    },
    onError: (error: Error) => {
      invalidate();
      toast({ title: "Erro ao remover matrícula", description: error.message, variant: "destructive" });
    },
  });

  function invalidate() {
    // Prefixo ['/api/classes'] cobre ocupação da lista de turmas, matrículas
    // por turma e queries de presença.
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'enrollments'] });
  }

  const handleEnroll = () => {
    if (!selectedGroup) {
      toast({ title: "Selecione uma turma", description: "Escolha a turma para matricular.", variant: "destructive" });
      return;
    }
    if (!selectedPlanId) {
      toast({ title: "Selecione um plano", description: "A matrícula precisa de um plano de mensalidade.", variant: "destructive" });
      return;
    }
    enrollMutation.mutate({ group: selectedGroup, planId: selectedPlanId });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Turmas
      </p>

      {/* ── Lista de turmas do aluno ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as turmas.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : enrolledGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="student-classes-empty">
          Nenhuma turma ainda — matricule o aluno abaixo para liberar o check-in de presença.
        </p>
      ) : (
        <div className="space-y-2" data-testid="student-classes-list">
          {enrolledGroups.map(g => (
            <div
              key={g.key}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card"
              data-testid={`student-class-${g.classIds[0]}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{g.classTypeName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDaysShort(g.daysOfWeek)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {g.startTime} – {g.endTime}
                  </span>
                  <span>Prof. {g.instructorName}</span>
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setGroupToRemove(g)}
                aria-label={`Remover matrícula em ${g.classTypeName}`}
                data-testid={`button-remove-class-${g.classIds[0]}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Matricular em nova turma ── */}
      {availableGroups.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="flex-1 h-9 text-sm" data-testid="select-new-class">
              <span className={cn("truncate", !selectedGroup && "text-muted-foreground")}>
                {selectedGroup
                  ? `${selectedGroup.classType?.name} · ${formatDaysShort(selectedGroup.daysOfWeek)} ${selectedGroup.startTime}`
                  : "Matricular em turma..."}
              </span>
            </SelectTrigger>
            <SelectContent>
              {availableGroups.map(g => {
                const occ = occupancy(g.enrolledCount, g.classType?.maxCapacity);
                return (
                  <SelectItem key={g.id} value={g.id} disabled={occ.isFull} data-testid={`option-class-${g.id}`}>
                    <span className="flex items-center gap-2">
                      <span>{g.classType?.name} · {formatDaysShort(g.daysOfWeek)} {g.startTime}</span>
                      <span className="text-xs text-muted-foreground">
                        {occ.isFull ? 'lotada' : occ.hasLimit ? `${occ.label} vagas` : ''}
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="sm:w-[150px] h-9 text-sm" data-testid="select-new-class-plan">
              <span className={cn("truncate", !selectedPlanId && "text-muted-foreground")}>
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
            size="sm"
            className="h-9"
            onClick={handleEnroll}
            disabled={enrollMutation.isPending}
            data-testid="button-enroll-in-class"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            {enrollMutation.isPending ? "Matriculando..." : "Matricular"}
          </Button>
        </div>
      )}

      {/* ── Confirmação de remoção ── */}
      <AlertDialog open={!!groupToRemove} onOpenChange={open => !open && setGroupToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover matrícula</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a matrícula de {studentName} na turma de {groupToRemove?.classTypeName}?
              O histórico de presenças será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => groupToRemove && removeMutation.mutate(groupToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove-class"
            >
              {removeMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
