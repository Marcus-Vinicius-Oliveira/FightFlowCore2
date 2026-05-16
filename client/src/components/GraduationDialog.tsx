import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BeltBadge } from "@/components/BeltBadge";

interface GraduationStudent {
  id: string;
  name: string;
  belt?: string | null;
}

const BELTS = [
  "branca",
  "cinza",
  "amarela",
  "laranja",
  "verde",
  "azul",
  "roxa",
  "marrom",
  "preta",
  "coral",
  "vermelha",
];

interface BeltHistoryEntry {
  id: string;
  beltBefore: string | null;
  beltAfter: string;
  promotedAt: string;
  notes: string | null;
}

interface GraduationDialogProps {
  student: GraduationStudent | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GraduationDialog({ student, open, onOpenChange }: GraduationDialogProps) {
  const [beltAfter, setBeltAfter] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery<BeltHistoryEntry[]>({
    queryKey: ['/api/students', student?.id, 'belt-history'],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/belt-history`).then(r => r.json()),
    enabled: open && !!student?.id,
  });

  const graduateMutation = useMutation({
    mutationFn: (data: { beltAfter: string; notes: string }) =>
      apiRequest('POST', `/api/students/${student!.id}/graduate`, data).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Graduação registrada!", description: `${student?.name} promovido(a) para faixa ${beltAfter}.` });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'belt-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      setBeltAfter("");
      setNotes("");
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao registrar graduação", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beltAfter) return;
    graduateMutation.mutate({ beltAfter, notes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + flex col garante que o modal nunca ultrapasse a viewport */}
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh] gap-0 p-0">

        {/* Cabeçalho fixo */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Registrar Graduação
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 flex-wrap mt-1">
            {student?.name} — faixa atual:
            <BeltBadge belt={student?.belt} />
          </DialogDescription>
        </DialogHeader>

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          <form id="graduation-form" onSubmit={handleSubmit} className="space-y-4">
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

          {history.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Histórico de graduações</p>
              <div className="space-y-2">
                {history.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground text-xs w-20 shrink-0">
                      {new Date(entry.promotedAt).toLocaleDateString('pt-BR')}
                    </span>
                    <BeltBadge belt={entry.beltBefore} />
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <BeltBadge belt={entry.beltAfter} />
                    {entry.notes && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {entry.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="graduation-form"
            disabled={!beltAfter || graduateMutation.isPending}
          >
            {graduateMutation.isPending ? "Salvando..." : "Confirmar Graduação"}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
