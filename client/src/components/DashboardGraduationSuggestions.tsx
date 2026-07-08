import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ArrowRight } from "lucide-react";
import { BeltBar } from "@/components/BeltBadge";

interface GraduationSuggestion {
  studentId: string;
  studentName: string;
  classTypeId: string;
  classTypeName: string;
  rankName: string;
  rankColor: string | null;
  nextRankName: string;
  daysInRank: number;
  presencesSincePromotion: number;
}

interface SuggestionsData {
  minDaysInRank: number;
  minPresences: number;
  suggestions: GraduationSuggestion[];
}

const MAX_VISIBLE = 8;

/** Painel de sugestões de graduação: candidatos a promoção por modalidade
 *  (tempo na faixa + presenças desde a última promoção). É sugestão — o
 *  registro continua manual, pela ficha do aluno. */
export function DashboardGraduationSuggestions() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useQuery<SuggestionsData>({
    queryKey: ['/api/dashboard/graduation-suggestions'],
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" data-testid="graduation-suggestions-loading" />;
  }
  // Sem candidatos: painel some — sugestão vazia não é informação acionável
  if (!data || data.suggestions.length === 0) return null;

  const visible = showAll ? data.suggestions : data.suggestions.slice(0, MAX_VISIBLE);
  const hiddenCount = data.suggestions.length - visible.length;

  return (
    <Card data-testid="graduation-suggestions-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-500" />
            Sugestões de graduação
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {data.minPresences}+ presenças e {data.minDaysInRank}+ dias na faixa
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1" data-testid="graduation-suggestions-list">
          {visible.map(s => (
            <Link
              key={`${s.studentId}-${s.classTypeId}`}
              to={`/dashboard/alunos/${s.studentId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent transition-colors"
              data-testid={`graduation-suggestion-${s.studentId}-${s.classTypeId}`}
            >
              <span className="text-sm font-medium truncate">{s.studentName}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {s.classTypeName} ·
                {s.rankColor && <BeltBar color={s.rankColor} name={s.rankName} width={22} height={7} />}
                {s.rankName}
                <ArrowRight className="h-3 w-3" />
                <span className="font-semibold text-foreground">{s.nextRankName}</span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
                {s.presencesSincePromotion} presenças · há {s.daysInRank} dias na faixa
              </span>
            </Link>
          ))}
          {hiddenCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowAll(true)}
              data-testid="graduation-suggestions-show-all"
            >
              Mostrar mais {hiddenCount} candidato{hiddenCount > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
