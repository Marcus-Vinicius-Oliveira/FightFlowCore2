import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, Plus, Printer } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { getModalityColor } from "@/lib/modality-colors";
import { cn } from "@/lib/utils";

interface ClassSchedule {
  id: string;
  classType: string;
  classTypeId?: string;
  instructor: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

interface WeeklyScheduleData {
  [key: string]: ClassSchedule[];
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Domingo", short: "Dom" },
  { value: "1", label: "Segunda", short: "Seg" },
  { value: "2", label: "Terça", short: "Ter" },
  { value: "3", label: "Quarta", short: "Qua" },
  { value: "4", label: "Quinta", short: "Qui" },
  { value: "5", label: "Sexta", short: "Sex" },
  { value: "6", label: "Sábado", short: "Sáb" },
];

function startHour(cls: ClassSchedule): number {
  return parseInt(cls.startTime.split(':')[0]);
}

/**
 * Só as horas realmente usadas pela grade: da primeira à última aula.
 * Sem isto a página renderiza 06:00–22:00 fixo e vira um scroll de
 * linhas vazias quando a academia concentra as aulas de manhã.
 */
function visibleHours(schedule: WeeklyScheduleData): number[] {
  const hours = Object.values(schedule).flat().map(startHour);
  if (hours.length === 0) return [];
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

interface ClassCardProps {
  classData: ClassSchedule;
  onOpen?: (classId: string) => void;
}

function ClassCard({ classData, onOpen }: ClassCardProps) {
  const color = getModalityColor(classData.classTypeId ?? classData.classType, classData.classType);
  const clickable = !!onOpen && classData.active;

  const content = (
    <>
      {/* Barra de modalidade — mesma identidade de cor do perfil do aluno */}
      <svg width="4" height="100%" viewBox="0 0 4 40" preserveAspectRatio="none" className="shrink-0 self-stretch" aria-hidden="true">
        <rect width="4" height="40" rx="2" fill={color} />
      </svg>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <p className="font-semibold text-xs leading-tight truncate">{classData.classType}</p>
          {!classData.active && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">Inativa</Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          {classData.startTime}–{classData.endTime}
        </p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 min-w-0">
          <Users className="h-3 w-3 shrink-0" />
          <span className="truncate">{classData.instructor}</span>
        </p>
      </div>
    </>
  );

  const baseCls = cn(
    "w-full flex items-stretch gap-2 bg-card border rounded-lg p-2 shadow-sm text-left",
    !classData.active && "opacity-60",
  );

  if (!clickable) {
    return (
      <div className={baseCls} data-testid={`class-card-${classData.id}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen!(classData.id)}
      aria-label={`Abrir controle de presença — ${classData.classType} ${classData.startTime}`}
      className={cn(
        baseCls,
        "transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
      )}
      data-testid={`class-card-${classData.id}`}
    >
      {content}
    </button>
  );
}

interface WeeklyGridProps {
  schedule: WeeklyScheduleData;
  onOpen?: (classId: string) => void;
}

function WeeklyGrid({ schedule, onOpen }: WeeklyGridProps) {
  const hours = visibleHours(schedule);
  const today = new Date().getDay().toString();

  return (
    // Scroll interno (X e Y) num único container: a grade rola por dentro em vez
    // de crescer a página, e o header dos dias fica sticky. O overflow-hidden
    // interno saiu — ele viraria o "scrollport" do sticky e o header não grudaria.
    <div className="border rounded-lg bg-background overflow-auto max-h-[65vh]">
      <div className="min-w-[700px]">
        {/* Header com dias da semana — hoje ganha destaque. bg-background opaco
            por baixo dos tints: as linhas passam por trás durante o scroll. */}
        <div className="grid grid-cols-8 border-b bg-background sticky top-0 z-10">
          <div className="p-3 border-r font-medium text-sm bg-muted/30">Horário</div>
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day.value}
              className={cn(
                "p-3 border-r last:border-r-0 text-center bg-muted/30",
                day.value === today && "bg-primary/10",
              )}
            >
              <div className={cn("font-medium text-sm", day.value === today && "text-primary")}>
                {day.short}
              </div>
              <div className="text-xs text-muted-foreground">
                {day.value === today ? 'Hoje' : day.label}
              </div>
            </div>
          ))}
        </div>

        {/* Linhas por hora — a linha cresce com o conteúdo; cards nunca colidem */}
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
            <div className="p-3 border-r bg-muted/10 flex items-start justify-center pt-3">
              <span className="text-sm font-medium tabular-nums">
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>

            {DAYS_OF_WEEK.map((day) => {
              const classesAtTime = (schedule[day.value] || [])
                .filter(cls => startHour(cls) === hour)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              return (
                <div
                  key={`${day.value}-${hour}`}
                  className={cn(
                    "border-r last:border-r-0 p-1.5 min-h-[56px] space-y-1.5",
                    day.value === today && "bg-primary/[0.04]",
                  )}
                  data-testid={`time-slot-${day.value}-${String(hour).padStart(2, '0')}:00`}
                >
                  {classesAtTime.map((classData) => (
                    <ClassCard key={classData.id} classData={classData} onOpen={onOpen} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeeklySchedule() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: schedule = {}, isLoading, error } = useQuery<WeeklyScheduleData>({
    queryKey: ['/api/classes/schedule/weekly'],
    queryFn: () => apiRequest('GET', '/api/classes/schedule/weekly').then(res => res.json())
  });

  const isEmpty = Object.keys(schedule).length === 0
    || Object.values(schedule).every(day => day.length === 0);

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Erro ao carregar a grade horária. Tente novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Grade de Aulas</h1>
          <p className="text-muted-foreground">
            Visualize a grade semanal de aulas e horários
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={isLoading || isEmpty}
            onClick={() => window.print()}
            data-testid="button-print-grade"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
          {user?.role === 'ADMIN_ACADEMIA' && (
            <Button
              onClick={() => navigate('/dashboard/aulas')}
              data-testid="button-manage-classes"
            >
              <Plus className="h-4 w-4 mr-2" />
              Gerenciar Aulas
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Grade Semanal
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique numa aula para abrir o controle de presença
            </p>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando grade horária...</p>
            </div>
          ) : isEmpty ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhuma aula agendada</h3>
              <p className="text-muted-foreground mb-4">
                {user?.role === 'ADMIN_ACADEMIA'
                  ? "Comece criando aulas na grade horária."
                  : "Não há aulas agendadas para esta semana."
                }
              </p>
              {user?.role === 'ADMIN_ACADEMIA' && (
                <Button
                  onClick={() => navigate('/dashboard/aulas')}
                  data-testid="button-create-first-class"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Aula
                </Button>
              )}
            </div>
          ) : (
            <WeeklyGrid
              schedule={schedule}
              onOpen={(classId) => navigate(`/dashboard/presenca/${classId}`)}
            />
          )}
        </CardContent>
      </Card>

      {/*
        Grade imprimível — portal direto no <body> (padrão .print-sheet, ver
        index.css): na tela fica oculto; ao imprimir, esconde-se o app e sai só
        a grade. O <style> embutido força paisagem enquanto ESTA página está
        montada — @page não é escopável por seletor, então o override vive e
        morre com o portal, sem afetar a impressão das outras páginas.
      */}
      {!isEmpty && createPortal(
        <div id="print-grade" className="print-sheet" aria-hidden="true">
          <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
          <h1>Grade de Aulas</h1>
          <p className="print-sub">
            {user?.academy?.name ? `${user.academy.name} — ` : ''}grade semanal
          </p>
          <p className="print-sub">
            Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <table className="print-grade-table">
            <thead>
              <tr>
                <th>Horário</th>
                {DAYS_OF_WEEK.map(day => <th key={day.value}>{day.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleHours(schedule).map(hour => (
                <tr key={hour}>
                  <td className="print-grade-hour">{String(hour).padStart(2, '0')}:00</td>
                  {DAYS_OF_WEEK.map(day => {
                    const classesAtTime = (schedule[day.value] || [])
                      .filter(cls => startHour(cls) === hour)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    return (
                      <td key={`${day.value}-${hour}`}>
                        {classesAtTime.map(cls => (
                          <div key={cls.id} className="print-grade-class">
                            <strong>{cls.classType}</strong>{!cls.active && ' (inativa)'}
                            <br />{cls.startTime}–{cls.endTime}
                            <br />{cls.instructor}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="print-footer">
            Fight Club App — grade gerada automaticamente a partir das turmas ativas da academia.
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}
