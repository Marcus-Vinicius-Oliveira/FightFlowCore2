import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserX } from "lucide-react";

interface RetentionStudent {
  id: string;
  name: string;
  daysSinceLastSeen: number;
  neverAttended: boolean;
  bucket: 'risk' | 'attention';
}

interface RetentionData {
  /** Opt-in por academia (Configurações → Painel); desligado, o resto não vem */
  enabled: boolean;
  attentionDays?: number;
  riskDays?: number;
  counts?: { risk: number; attention: number; ok: number };
  students?: RetentionStudent[];
}

const MAX_VISIBLE = 8;

/** Painel de retenção: alunos ativos sem presença há 14/30+ dias, piores primeiro.
 *  Alerta proativo de churn — cada linha leva à ficha do aluno para a cobrança/contato. */
export function DashboardRetention() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useQuery<RetentionData>({
    queryKey: ['/api/dashboard/retention'],
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" data-testid="retention-loading" />;
  }
  // Painel é opt-in (Configurações → Painel) — desligado por padrão
  if (!data?.enabled) return null;

  const students = data.students ?? [];
  const visible = showAll ? students : students.slice(0, MAX_VISIBLE);
  const hiddenCount = students.length - visible.length;

  return (
    <Card data-testid="retention-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserX className="h-4 w-4 text-muted-foreground" />
            Retenção — presença em queda
          </CardTitle>
          {students.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span
                className="rounded-full bg-destructive/10 text-destructive font-semibold px-2.5 py-0.5"
                data-testid="retention-count-risk"
              >
                {data.counts!.risk} em risco ({data.riskDays}+ dias)
              </span>
              <span
                className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold px-2.5 py-0.5"
                data-testid="retention-count-attention"
              >
                {data.counts!.attention} em atenção ({data.attentionDays}+)
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="retention-empty">
            Todos os alunos ativos treinaram nos últimos {data.attentionDays} dias. 👊
          </p>
        ) : (
          <div className="space-y-1" data-testid="retention-list">
            {visible.map(s => (
              <Link
                key={s.id}
                to={`/dashboard/alunos/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent transition-colors"
                data-testid={`retention-row-${s.id}`}
              >
                <span className="text-sm font-medium truncate">{s.name}</span>
                <span
                  className={`text-xs shrink-0 tabular-nums ${
                    s.bucket === 'risk' ? 'text-destructive font-semibold' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {s.neverAttended
                    ? `nunca veio · há ${s.daysSinceLastSeen} dias na academia`
                    : `sem treinar há ${s.daysSinceLastSeen} dias`}
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
                data-testid="retention-show-all"
              >
                Mostrar mais {hiddenCount} aluno{hiddenCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
