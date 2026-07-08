import { useEffect, useMemo, useState } from "react";
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
import { BeltBar } from "@/components/BeltBadge";
import {
  groupStudentEnrollments,
  missingEnrollmentIds,
  occupancyText,
  formatDaysShort,
  type StudentEnrollmentRecord,
  type StudentClassGroup,
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
  classTypeId: string | null;
}

/** Modalidade do aluno (vínculo + graduação) — vem da ficha, que já carrega
 *  ranks e sistemas de graduação. */
export interface StudentModalityInfo {
  classTypeId: string;
  name: string;
  rankName?: string;
  /** colorClass da faixa no formato "hex" ou "hex|hex" */
  rankColor?: string;
}

interface StudentClassEnrollmentsProps {
  studentId: string;
  studentName: string;
  modalities: StudentModalityInfo[];
}

/** Card exibido: modalidade do aluno com as turmas dela aninhadas.
 *  Turma em modalidade sem vínculo (dado legado) vira card sem graduação. */
interface ModalityCard {
  classTypeId: string;
  name: string;
  rankName?: string;
  rankColor?: string;
  groups: StudentClassGroup[];
}

/** Seção "Modalidades e Turmas" da ficha do aluno: um card por modalidade com
 *  graduação e as turmas em que o aluno treina, matrícula em nova turma e
 *  remoção com confirmação. Remover turma não remove a modalidade/graduação. */
export function StudentClassEnrollments({ studentId, studentName, modalities }: StudentClassEnrollmentsProps) {
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

  // Um card por modalidade do aluno, com as turmas dela dentro. Turmas de
  // modalidade ainda sem vínculo (legado pré-backfill) ganham card próprio.
  const modalityCards = useMemo<ModalityCard[]>(() => {
    const cards: ModalityCard[] = modalities.map(m => ({
      classTypeId: m.classTypeId,
      name: m.name,
      rankName: m.rankName,
      rankColor: m.rankColor,
      groups: enrolledGroups.filter(g => g.classTypeId === m.classTypeId),
    }));
    const known = new Set(modalities.map(m => m.classTypeId));
    for (const g of enrolledGroups) {
      if (known.has(g.classTypeId)) continue;
      known.add(g.classTypeId);
      cards.push({ classTypeId: g.classTypeId, name: g.classTypeName, groups: enrolledGroups.filter(x => x.classTypeId === g.classTypeId) });
    }
    return cards;
  }, [modalities, enrolledGroups]);

  const enrolledKeys = useMemo(() => new Set(enrolledGroups.map(g => g.key)), [enrolledGroups]);

  const groupKey = (g: ClassGroupOption) => `${g.classTypeId}|${g.instructorId}|${g.startTime}|${g.endTime}`;

  const availableGroups = useMemo(
    () => classGroups.filter(g => !enrolledKeys.has(groupKey(g))),
    [classGroups, enrolledKeys]
  );

  const selectedGroup = classGroups.find(g => g.id === selectedGroupId);

  // Ao escolher a turma, sugere o plano da modalidade dela (o gestor pode trocar).
  useEffect(() => {
    if (!selectedGroup) return;
    const match = plans.find(p => p.classTypeId === selectedGroup.classTypeId);
    setSelectedPlanId(match ? match.id : "");
  }, [selectedGroupId, plans]);

  const enrollMutation = useMutation({
    mutationFn: async ({ group, planId }: { group: ClassGroupOption; planId: string }) => {
      // Um request matricula no grupo inteiro — transacional no servidor
      const res = await apiRequest('POST', '/api/classes/enrollment-groups', {
        studentId,
        membershipPlanId: planId,
        classIds: missingEnrollmentIds(group.ids, []),
      });
      const body = await res.json().catch(() => null);
      return {
        modalityAdded: !!body?.modalityAdded,
        modalityName: (body?.modalityName ?? null) as string | null,
      };
    },
    onSuccess: ({ modalityAdded, modalityName }, { group }) => {
      invalidate();
      const className = group.classType?.name ?? 'turma';
      toast({
        title: "Aluno matriculado!",
        description: modalityAdded
          ? `${studentName} foi matriculado em ${className} — modalidade ${modalityName ?? className} adicionada ao perfil.`
          : `${studentName} foi matriculado em ${className}.`,
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
      // Um request encerra o grupo inteiro (UPDATE único no servidor)
      await apiRequest('DELETE', '/api/classes/enrollment-groups', { studentId, classIds });
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
    // por turma, resumo por modalidade e queries de presença.
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'enrollments'] });
    // Matricular em turma pode criar vínculo de modalidade + graduação inicial.
    queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'modality-enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'modality-ranks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
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
        Modalidades e Turmas
      </p>

      {/* ── Cards de modalidade com turmas aninhadas ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as turmas.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : modalityCards.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="student-classes-empty">
          Nenhuma modalidade ainda — matricule o aluno em uma turma abaixo para
          vincular a modalidade e liberar o check-in de presença.
        </p>
      ) : (
        <div className="space-y-2" data-testid="student-classes-list">
          {modalityCards.map(card => {
            const rankColor = card.rankColor?.split('|')[0];
            // Barra cinza neutra quando sem graduação; cor da faixa quando graduado
            const barColor = rankColor ?? '#94a3b8'; // slate-400
            return (
              <div
                key={card.classTypeId}
                className="rounded-lg border bg-card px-3 py-2.5 space-y-2"
                data-testid={`student-modality-${card.classTypeId}`}
              >
                <div className="flex items-center gap-3">
                  <svg width="5" height="28" viewBox="0 0 5 28" className="shrink-0" aria-hidden="true">
                    <rect width="5" height="28" rx="2.5" fill={barColor} />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight truncate">{card.name}</p>
                    {rankColor && card.rankName ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <BeltBar color={card.rankColor!} name={card.rankName} width={26} height={8} />
                        <span className="text-xs text-muted-foreground">{card.rankName}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Sem graduação</p>
                    )}
                  </div>
                </div>

                {card.groups.length > 0 ? (
                  <div className="space-y-1.5 pl-[17px]">
                    {card.groups.map(g => (
                      <div
                        key={g.key}
                        className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5"
                        data-testid={`student-class-${g.classIds[0]}`}
                      >
                        <p className="flex-1 min-w-0 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
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
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setGroupToRemove({ key: g.key, classTypeName: card.name, classIds: g.classIds })}
                          aria-label={`Remover matrícula na turma de ${card.name}`}
                          data-testid={`button-remove-class-${g.classIds[0]}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="pl-[17px] text-xs text-muted-foreground" data-testid={`student-modality-no-class-${card.classTypeId}`}>
                    Sem turma — matricule abaixo para o check-in de presença.
                  </p>
                )}
              </div>
            );
          })}
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
              {availableGroups.map(g => (
                <SelectItem key={g.id} value={g.id} data-testid={`option-class-${g.id}`}>
                  <span className="flex items-center gap-2">
                    <span>{g.classType?.name} · {formatDaysShort(g.daysOfWeek)} {g.startTime}</span>
                    <span className="text-xs text-muted-foreground">
                      {occupancyText(g.enrolledCount)}
                    </span>
                  </span>
                </SelectItem>
              ))}
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
            <AlertDialogTitle>Remover matrícula da turma</AlertDialogTitle>
            <AlertDialogDescription>
              Remover a matrícula de {studentName} na turma de {groupToRemove?.classTypeName}?
              A modalidade, a graduação e o histórico de presenças serão mantidos.
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
