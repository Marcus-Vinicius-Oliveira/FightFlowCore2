import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ClassSchedule {
  id: string;
  classType: string;
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

const TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00"
];

interface ClassCardProps {
  classData: ClassSchedule;
  onAttendance?: (classId: string) => void;
}

function ClassCard({ classData, onAttendance }: ClassCardProps) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'PROFESSOR';
  
  const timeSlots = Math.ceil(
    (parseInt(classData.endTime.split(':')[0]) - parseInt(classData.startTime.split(':')[0])) || 1
  );

  return (
    <div 
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm transition-all hover:shadow-md",
        !classData.active && "opacity-60"
      )}
      style={{ 
        gridRow: `span ${timeSlots} / span ${timeSlots}`,
        minHeight: `${timeSlots * 60}px`,
        maxHeight: `${timeSlots * 60}px`
      }}
      data-testid={`class-card-${classData.id}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="font-medium text-sm leading-tight">{classData.classType}</h4>
          <Badge 
            variant={classData.active ? "default" : "secondary"}
            className="text-xs"
          >
            {classData.active ? "Ativa" : "Inativa"}
          </Badge>
        </div>
        
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="truncate">{classData.instructor}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{classData.startTime} - {classData.endTime}</span>
          </div>
        </div>

        {isTeacher && classData.active && onAttendance && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-6"
            onClick={() => onAttendance(classData.id)}
            data-testid={`button-attendance-${classData.id}`}
          >
            Presença
          </Button>
        )}
      </div>
    </div>
  );
}

interface WeeklyGridProps {
  schedule: WeeklyScheduleData;
  onAttendance?: (classId: string) => void;
}

function WeeklyGrid({ schedule, onAttendance }: WeeklyGridProps) {
  return (
    <div className="overflow-x-auto">
    <div className="border rounded-lg overflow-hidden bg-background min-w-[600px]">
      {/* Header com dias da semana */}
      <div className="grid grid-cols-8 border-b bg-muted/30">
        <div className="p-3 border-r font-medium text-sm">Horário</div>
        {DAYS_OF_WEEK.map((day) => (
          <div key={day.value} className="p-3 border-r last:border-r-0 text-center">
            <div className="font-medium text-sm">{day.short}</div>
            <div className="text-xs text-muted-foreground">{day.label}</div>
          </div>
        ))}
      </div>

      {/* Grid principal */}
      <div className="relative">
        {TIME_SLOTS.map((time, timeIndex) => (
          <div key={time} className="grid grid-cols-8 border-b last:border-b-0 min-h-[60px]">
            {/* Coluna de horário */}
            <div className="p-3 border-r bg-muted/10 flex items-center justify-center">
              <span className="text-sm font-medium">{time}</span>
            </div>

            {/* Colunas dos dias */}
            {DAYS_OF_WEEK.map((day) => {
              const dayClasses = schedule[day.value] || [];
              const timeHour = parseInt(time.split(':')[0]);
              
              // Encontrar aulas que começam neste horário
              const classesAtTime = dayClasses.filter(cls => {
                const classHour = parseInt(cls.startTime.split(':')[0]);
                return classHour === timeHour;
              });

              return (
                <div 
                  key={`${day.value}-${time}`} 
                  className="border-r last:border-r-0 p-2 relative min-h-[60px]"
                  data-testid={`time-slot-${day.value}-${time}`}
                >
                  {classesAtTime.map((classData) => (
                    <ClassCard
                      key={classData.id}
                      classData={classData}
                      onAttendance={onAttendance}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

export default function WeeklySchedule() {
  const [currentWeek, setCurrentWeek] = useState(0); // 0 = semana atual
  const { user } = useAuth();

  const { data: schedule = {}, isLoading, error } = useQuery<WeeklyScheduleData>({
    queryKey: ['/api/classes/schedule/weekly'],
    queryFn: () => apiRequest('GET', '/api/classes/schedule/weekly').then(res => res.json())
  });

  const handleAttendance = (classId: string) => {
    // Navegar para a página de controle de presença
    window.location.pathname = `/dashboard/presenca/${classId}`;
  };

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => prev - 1);
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => prev + 1);
  };

  const getWeekLabel = () => {
    if (currentWeek === 0) return "Esta Semana";
    if (currentWeek === 1) return "Próxima Semana";
    if (currentWeek === -1) return "Semana Passada";
    return currentWeek > 0 ? `+${currentWeek} semanas` : `${Math.abs(currentWeek)} semanas atrás`;
  };

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
        
        {user?.role === 'ADMIN_ACADEMIA' && (
          <Button 
            onClick={() => window.location.pathname = '/dashboard/aulas'}
            data-testid="button-manage-classes"
          >
            <Plus className="h-4 w-4 mr-2" />
            Gerenciar Aulas
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Grade Semanal
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousWeek}
                data-testid="button-previous-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm font-medium min-w-[120px] text-center">
                {getWeekLabel()}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando grade horária...</p>
            </div>
          ) : Object.keys(schedule).length === 0 || Object.values(schedule).every(day => day.length === 0) ? (
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
                  onClick={() => window.location.pathname = '/dashboard/aulas'}
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
              onAttendance={user?.role === 'PROFESSOR' ? handleAttendance : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-start sm:items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-primary rounded"></div>
                <span>Aula Ativa</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-secondary rounded"></div>
                <span>Aula Inativa</span>
              </div>
            </div>
            
            <div className="text-muted-foreground">
              {user?.role === 'PROFESSOR' && "Clique em 'Presença' para registrar a frequência dos alunos"}
              {user?.role === 'ADMIN_ACADEMIA' && "Use 'Gerenciar Aulas' para adicionar ou editar aulas"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}