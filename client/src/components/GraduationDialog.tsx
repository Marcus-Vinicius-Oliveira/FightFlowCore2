import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Award, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type Student } from "@/lib/api";

const BELTS = [
  "Branca",
  "Cinza",
  "Amarela",
  "Laranja",
  "Verde",
  "Azul",
  "Roxa",
  "Marrom",
  "Preta",
  "Coral",
  "Vermelha",
];

interface BeltHistoryEntry {
  id: string;
  beltBefore: string | null;
  beltAfter: string;
  promotedAt: string;
  notes: string | null;
}

interface GraduationDialogProps {
  student: Student | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function beltColor(belt: string): string {
  const map: Record<string, string> = {
    branca: "bg-white border border-gray-300 text-gray-800",
    cinza: "bg-gray-400 text-white",
    amarela: "bg-yellow-400 text-gray-900",
    laranja: "bg-orange-500 text-white",
    verde: "bg-green-600 text-white",
    azul: "bg-blue-600 text-white",
    roxa: "bg-purple-600 text-white",
    marrom: "bg-amber-800 text-white",
    preta: "bg-gray-950 text-white",
    coral: "bg-red-700 text-white",
    vermelha: "bg-red-600 text-white",
  };
  return map[belt.toLowerCase()] ?? "bg-muted text-muted-foreground";
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Registrar Graduação
          </DialogTitle>
          <DialogDescription>
            {student?.name} — faixa atual:{" "}
            {student?.belt
              ? <Badge className={`ml-1 ${beltColor(student.belt)}`}>{student.belt}</Badge>
              : <span className="text-muted-foreground">não informada</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nova faixa</Label>
            <Select value={beltAfter} onValueChange={setBeltAfter}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a nova faixa" />
              </SelectTrigger>
              <SelectContent>
                {BELTS.map(belt => (
                  <SelectItem key={belt} value={belt}>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${beltColor(belt)}`}>
                      {belt}
                    </span>
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
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!beltAfter || graduateMutation.isPending}>
              {graduateMutation.isPending ? "Salvando..." : "Confirmar Graduação"}
            </Button>
          </DialogFooter>
        </form>

        {history.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Histórico de graduações</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map(entry => (
                <div key={entry.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground text-xs w-20 shrink-0">
                    {new Date(entry.promotedAt).toLocaleDateString('pt-BR')}
                  </span>
                  {entry.beltBefore
                    ? <Badge variant="outline" className={`text-xs ${beltColor(entry.beltBefore)}`}>{entry.beltBefore}</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Badge className={`text-xs ${beltColor(entry.beltAfter)}`}>{entry.beltAfter}</Badge>
                  {entry.notes && <span className="text-xs text-muted-foreground truncate">{entry.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
