import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BeltBadge, BeltBar } from "@/components/BeltBadge";

interface GraduationStudent {
  id: string;
  name: string;
  belt?: string | null;
}

// ─── Legacy belt list (fallback when no graduation system is configured) ───────
const BELTS = [
  "branca", "cinza", "amarela", "laranja", "verde",
  "azul", "roxa", "marrom", "preta", "coral", "vermelha",
];

interface BeltHistoryEntry {
  id: string;
  beltBefore: string | null;
  beltAfter: string;
  promotedAt: string;
  notes: string | null;
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

interface ClassType {
  id: string;
  name: string;
}

interface RankHistoryEntry {
  id: string;
  classTypeId: string;
  rankBeforeId: string | null;
  rankAfterId: string;
  promotedAt: string;
  notes: string | null;
}

interface GraduationDialogProps {
  student: GraduationStudent | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RankBadge({ rank }: { rank: Pick<GraduationRank, 'name' | 'colorClass'> }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <BeltBar color={rank.colorClass} name={rank.name} width={40} height={10} />
      <span className="text-xs font-medium truncate">{rank.name}</span>
    </span>
  );
}

export function GraduationDialog({ student, open, onOpenChange }: GraduationDialogProps) {
  const [mode, setMode] = useState<'modality' | 'legacy'>('modality');
  const [selectedClassTypeId, setSelectedClassTypeId] = useState('');
  const [selectedRankId, setSelectedRankId] = useState('');
  const [beltAfter, setBeltAfter] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load graduation systems (with ranks)
  const { data: systems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
    enabled: open,
  });

  // Load class types for labels
  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types'],
    enabled: open,
  });

  // Legacy belt history
  const { data: beltHistory = [] } = useQuery<BeltHistoryEntry[]>({
    queryKey: ['/api/students', student?.id, 'belt-history'],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/belt-history`).then(r => r.json()),
    enabled: open && !!student?.id && mode === 'legacy',
  });

  // New modality rank history for selected classType
  const { data: rankHistory = [] } = useQuery<RankHistoryEntry[]>({
    queryKey: ['/api/students', student?.id, 'rank-history', selectedClassTypeId],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/rank-history?classTypeId=${selectedClassTypeId}`).then(r => r.json()),
    enabled: open && !!student?.id && !!selectedClassTypeId && mode === 'modality',
  });

  const hasModalitySystems = systems.length > 0;

  // Find the system for the selected classType
  const activeSystem = systems.find(s => s.classTypeId === selectedClassTypeId);
  const ranksForSystem = activeSystem?.ranks.sort((a, b) => a.displayOrder - b.displayOrder) ?? [];

  // Build a map of rankId → rank for history display
  const allRanks: Record<string, GraduationRank> = {};
  for (const sys of systems) {
    for (const r of sys.ranks) allRanks[r.id] = r;
  }

  const classTypeName = (id: string) => classTypes.find(c => c.id === id)?.name ?? id;

  // ─── Mutation: modality graduation ─────────────────────────────────────────
  const graduateModalityMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/students/${student!.id}/graduate-modality`, {
        classTypeId: selectedClassTypeId,
        rankId: selectedRankId,
        notes,
      }).then(r => r.json()),
    onSuccess: () => {
      toast({
        title: 'Graduação registrada!',
        description: `${student?.name} promovido(a) em ${classTypeName(selectedClassTypeId)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'rank-history', selectedClassTypeId] });
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/modality-ranks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Erro ao registrar graduação', variant: 'destructive' }),
  });

  // ─── Mutation: legacy belt graduation ──────────────────────────────────────
  const graduateLegacyMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/students/${student!.id}/graduate`, { beltAfter, notes }).then(r => r.json()),
    onSuccess: () => {
      toast({
        title: 'Graduação registrada!',
        description: `${student?.name} promovido(a) para faixa ${beltAfter}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'belt-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Erro ao registrar graduação', variant: 'destructive' }),
  });

  function resetForm() {
    setSelectedClassTypeId('');
    setSelectedRankId('');
    setBeltAfter('');
    setNotes('');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'modality') {
      if (!selectedClassTypeId || !selectedRankId) return;
      graduateModalityMutation.mutate();
    } else {
      if (!beltAfter) return;
      graduateLegacyMutation.mutate();
    }
  };

  const isPending = graduateModalityMutation.isPending || graduateLegacyMutation.isPending;
  const canSubmit = mode === 'modality'
    ? !!(selectedClassTypeId && selectedRankId)
    : !!beltAfter;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh] gap-0 p-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Registrar Graduação
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 flex-wrap mt-1">
            {student?.name}
            {student?.belt && (
              <>
                {' '}— faixa atual: <BeltBadge belt={student.belt} />
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle (only if systems exist) */}
        {hasModalitySystems && (
          <div className="px-6 pt-4 flex gap-2">
            <Button
              size="sm"
              variant={mode === 'modality' ? 'default' : 'outline'}
              onClick={() => setMode('modality')}
            >
              Por Modalidade
            </Button>
            <Button
              size="sm"
              variant={mode === 'legacy' ? 'default' : 'outline'}
              onClick={() => setMode('legacy')}
            >
              Faixa Geral
            </Button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          <form id="graduation-form" onSubmit={handleSubmit} className="space-y-4">

            {/* ── MODALITY MODE ── */}
            {mode === 'modality' && (
              <>
                <div className="space-y-2">
                  <Label>Modalidade</Label>
                  <Select
                    value={selectedClassTypeId}
                    onValueChange={(v) => {
                      setSelectedClassTypeId(v);
                      setSelectedRankId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {systems.map(sys => (
                        <SelectItem key={sys.id} value={sys.classTypeId ?? sys.id}>
                          {sys.classTypeId ? classTypeName(sys.classTypeId) : sys.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {systems.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhum sistema de graduação configurado.{' '}
                      <a href="/settings" className="underline text-primary">Criar em Configurações</a>.
                    </p>
                  )}
                </div>

                {selectedClassTypeId && ranksForSystem.length > 0 && (
                  <div className="space-y-2">
                    <Label>Nova graduação</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ranksForSystem.map(rank => (
                        <button
                          key={rank.id}
                          type="button"
                          title={rank.name}
                          onClick={() => setSelectedRankId(rank.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-left ${
                            selectedRankId === rank.id
                              ? 'border-primary ring-2 ring-primary ring-offset-1'
                              : 'border-border hover:border-muted-foreground'
                          }`}
                        >
                          <RankBadge rank={rank} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedClassTypeId && ranksForSystem.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhuma graduação configurada para esta modalidade.
                    <a href="/settings" className="ml-1 underline text-primary">Adicionar em Configurações</a>.
                  </p>
                )}
              </>
            )}

            {/* ── LEGACY MODE ── */}
            {mode === 'legacy' && (
              <div className="space-y-2">
                <Label>Nova faixa</Label>
                <Select value={beltAfter} onValueChange={setBeltAfter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a nova faixa" />
                  </SelectTrigger>
                  <SelectContent>
                    {BELTS.map(belt => (
                      <SelectItem key={belt} value={belt}>
                        <BeltBadge belt={belt} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Aprovado no exame de faixa, desempenho excelente..."
                rows={3}
              />
            </div>
          </form>

          {/* History */}
          {mode === 'modality' && selectedClassTypeId && rankHistory.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Histórico — {classTypeName(selectedClassTypeId)}</p>
              <div className="space-y-2">
                {rankHistory.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground text-xs w-20 shrink-0">
                      {new Date(entry.promotedAt).toLocaleDateString('pt-BR')}
                    </span>
                    {entry.rankBeforeId && allRanks[entry.rankBeforeId]
                      ? <RankBadge rank={allRanks[entry.rankBeforeId]} />
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    {allRanks[entry.rankAfterId]
                      ? <RankBadge rank={allRanks[entry.rankAfterId]} />
                      : <span className="text-xs text-muted-foreground">{entry.rankAfterId}</span>
                    }
                    {entry.notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{entry.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === 'legacy' && beltHistory.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Histórico de faixas gerais</p>
              <div className="space-y-2">
                {beltHistory.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground text-xs w-20 shrink-0">
                      {new Date(entry.promotedAt).toLocaleDateString('pt-BR')}
                    </span>
                    <BeltBadge belt={entry.beltBefore} />
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <BeltBadge belt={entry.beltAfter} />
                    {entry.notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{entry.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="graduation-form"
            disabled={!canSubmit || isPending}
          >
            {isPending ? 'Salvando...' : 'Confirmar Graduação'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
