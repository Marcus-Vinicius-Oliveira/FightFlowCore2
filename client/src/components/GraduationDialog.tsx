import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BeltBar } from "@/components/BeltBadge";

interface GraduationStudent {
  id: string;
  name: string;
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
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <BeltBar color={rank.colorClass} name={rank.name} width={36} height={10} />
      <span className="text-sm font-medium leading-tight">{rank.name}</span>
    </span>
  );
}

export function GraduationDialog({ student, open, onOpenChange }: GraduationDialogProps) {
  const [selectedClassTypeId, setSelectedClassTypeId] = useState('');
  const [selectedRankId, setSelectedRankId] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: systems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
    enabled: open,
  });

  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types'],
    enabled: open,
  });

  // Faixas atuais do aluno por modalidade
  const { data: currentModalityRanks = [] } = useQuery<{ classTypeId: string; rankId: string }[]>({
    queryKey: ['/api/students', student?.id, 'modality-ranks'],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/modality-ranks`).then(r => r.json()),
    enabled: open && !!student?.id,
  });

  const { data: rankHistory = [] } = useQuery<RankHistoryEntry[]>({
    queryKey: ['/api/students', student?.id, 'rank-history', selectedClassTypeId],
    queryFn: () =>
      apiRequest('GET', `/api/students/${student!.id}/rank-history?classTypeId=${selectedClassTypeId}`)
        .then(r => r.json()),
    enabled: open && !!student?.id && !!selectedClassTypeId,
  });

  // Mapa rankId → GraduationRank para lookups no histórico
  const allRanks: Record<string, GraduationRank> = {};
  for (const sys of systems) for (const r of sys.ranks) allRanks[r.id] = r;

  const activeSystem = systems.find(s => s.classTypeId === selectedClassTypeId);
  const ranksForSystem = activeSystem?.ranks.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? [];

  // Faixa atual do aluno na modalidade selecionada
  const currentRankId = currentModalityRanks.find(r => r.classTypeId === selectedClassTypeId)?.rankId;
  const currentRank = currentRankId ? allRanks[currentRankId] : null;

  const classTypeName = (id: string) => classTypes.find(c => c.id === id)?.name ?? id;

  const graduateMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'modality-ranks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'rank-history', selectedClassTypeId] });
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/modality-ranks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast({ title: 'Erro ao registrar graduação', variant: 'destructive' }),
  });

  function resetForm() {
    setSelectedClassTypeId('');
    setSelectedRankId('');
    setNotes('');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassTypeId || !selectedRankId) return;
    graduateMutation.mutate();
  };

  const showRankPanel = !!selectedClassTypeId;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh] gap-0 p-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Registrar Graduação
          </DialogTitle>
          <DialogDescription className="mt-1">{student?.name}</DialogDescription>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <form id="graduation-form" onSubmit={handleSubmit} className="space-y-4">

            {/* Seleção de modalidade */}
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select
                value={selectedClassTypeId}
                onValueChange={(v) => { setSelectedClassTypeId(v); setSelectedRankId(''); }}
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

            {/* Painel de faixa atual + grade de nova graduação — surge com transição suave */}
            <div
              className={`space-y-4 overflow-hidden transition-all duration-300 ease-in-out ${
                showRankPanel ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {/* Faixa atual na modalidade */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border">
                <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">Faixa atual:</span>
                {currentRank ? (
                  <span className="flex items-center gap-2">
                    <BeltBar color={currentRank.colorClass} name={currentRank.name} width={32} height={9} />
                    <span className="text-sm font-medium">{currentRank.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Sem graduação</span>
                )}
              </div>

              {/* Grade de faixas — coluna única para evitar truncamento */}
              {ranksForSystem.length > 0 ? (
                <div className="space-y-2">
                  <Label>Nova graduação</Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {ranksForSystem.map(rank => {
                      const isSelected = selectedRankId === rank.id;
                      return (
                        <button
                          key={rank.id}
                          type="button"
                          title={rank.name}
                          onClick={() => setSelectedRankId(rank.id)}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition-all duration-150 ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
                          }`}
                        >
                          <RankBadge rank={rank} />
                          <Check
                            className={`h-4 w-4 shrink-0 transition-opacity duration-150 ${
                              isSelected ? 'text-primary opacity-100' : 'opacity-0'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                selectedClassTypeId && (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhuma graduação configurada para esta modalidade.{' '}
                    <a href="/settings" className="underline text-primary">Adicionar em Configurações</a>.
                  </p>
                )
              )}
            </div>

            {/* Observações */}
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

          {/* Histórico de graduações na modalidade */}
          {selectedClassTypeId && rankHistory.length > 0 && (
            <div className="border-t mt-4 pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Histórico — {classTypeName(selectedClassTypeId)}
              </p>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="graduation-form"
            disabled={!(selectedClassTypeId && selectedRankId) || graduateMutation.isPending}
          >
            {graduateMutation.isPending ? 'Salvando...' : 'Confirmar Graduação'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
