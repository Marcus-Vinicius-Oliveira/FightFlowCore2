import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  Clock, 
  Users, 
  ArrowLeft,
  LogOut,
  Award,
  AlertCircle,
  MapPin 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface EnrollmentData {
  id: string;
  membershipPlan: {
    name: string;
    classesPerWeek: number;
  };
  class: {
    id: string;
    classType: {
      name: string;
      duration: number;
      description: string;
    };
    instructor: {
      name: string;
    };
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  };
  startDate: string;
  endDate?: string;
  active: boolean;
}

interface StudentScheduleData {
  enrollments: EnrollmentData[];
}

export default function PortalSchedule() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: studentData, isLoading, error } = useQuery<StudentScheduleData>({
    queryKey: ['/api/student/me'],
    enabled: !!user && user.role === 'ALUNO',
  });

  const handleLogout = () => {
    logout();
    setLocation("/portal/login");
  };

  const goBackToDashboard = () => {
    setLocation("/portal/dashboard");
  };

  // Group classes by day of week
  const weeklySchedule = studentData?.enrollments
    ?.filter(enrollment => enrollment.active)
    ?.reduce((acc, enrollment) => {
      const dayOfWeek = enrollment.class.dayOfWeek;
      if (!acc[dayOfWeek]) {
        acc[dayOfWeek] = [];
      }
      acc[dayOfWeek].push(enrollment);
      return acc;
    }, {} as Record<number, EnrollmentData[]>) || {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} onLogout={handleLogout} onBack={goBackToDashboard} />
        <main className="container max-w-6xl mx-auto p-6">
          <div className="space-y-6">
            <ScheduleSkeletonLoader />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} onLogout={handleLogout} onBack={goBackToDashboard} />
        <main className="container max-w-6xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar horários. Tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  const daysOfWeek = [
    { id: 1, name: 'Segunda-feira', short: 'SEG' },
    { id: 2, name: 'Terça-feira', short: 'TER' },
    { id: 3, name: 'Quarta-feira', short: 'QUA' },
    { id: 4, name: 'Quinta-feira', short: 'QUI' },
    { id: 5, name: 'Sexta-feira', short: 'SEX' },
    { id: 6, name: 'Sábado', short: 'SAB' },
    { id: 0, name: 'Domingo', short: 'DOM' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} onLogout={handleLogout} onBack={goBackToDashboard} />
      
      <main className="container max-w-6xl mx-auto p-6">
        <div className="space-y-6">
          {/* Header Section */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Grade de Horários
            </h1>
            <p className="text-muted-foreground mt-2">
              Suas aulas matriculadas organizadas por dia da semana
            </p>
          </div>

          {/* Summary Card */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Resumo da Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary" data-testid="total-classes-week">
                    {Object.values(weeklySchedule).flat().length}
                  </p>
                  <p className="text-sm text-muted-foreground">Aulas por semana</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary" data-testid="total-days-active">
                    {Object.keys(weeklySchedule).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Dias com aulas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary" data-testid="total-unique-instructors">
                    {new Set(Object.values(weeklySchedule).flat().map(e => e.class.instructor.name)).size}
                  </p>
                  <p className="text-sm text-muted-foreground">Professores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Schedule Grid */}
          <div className="grid gap-4">
            {daysOfWeek.map(day => {
              const dayClasses = weeklySchedule[day.id] || [];
              const sortedClasses = dayClasses.sort((a, b) => 
                a.class.startTime.localeCompare(b.class.startTime)
              );

              return (
                <Card key={day.id} className={`${dayClasses.length > 0 ? 'border-primary/20' : ''}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${dayClasses.length > 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                        <span className="text-lg">{day.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {day.short}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {dayClasses.length} {dayClasses.length === 1 ? 'aula' : 'aulas'}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {dayClasses.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma aula neste dia
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sortedClasses.map((enrollment) => (
                          <div 
                            key={enrollment.id}
                            className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                            data-testid={`schedule-class-${enrollment.id}`}
                          >
                            <div className="flex items-center space-x-4 flex-1">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Award className="h-6 w-6 text-primary" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground" data-testid={`class-name-${enrollment.id}`}>
                                  {enrollment.class.classType.name}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {enrollment.class.instructor.name}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {enrollment.class.startTime} - {enrollment.class.endTime}
                                  </span>
                                  <span>
                                    {enrollment.class.classType.duration} min
                                  </span>
                                </div>
                                {enrollment.class.classType.description && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {enrollment.class.classType.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <Badge 
                                variant="default" 
                                className="bg-green-100 text-green-800 border-green-200"
                                data-testid={`enrollment-status-${enrollment.id}`}
                              >
                                Matriculado
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Information Card */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Informações Importantes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Os horários podem sofrer alterações. Confirme sempre com a recepção.</p>
              <p>• Chegue pelo menos 10 minutos antes do início da aula.</p>
              <p>• Em caso de dúvidas sobre horários, entre em contato com a academia.</p>
              <p>• Faltas devem ser comunicadas com antecedência quando possível.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function PortalHeader({ 
  user, 
  onLogout, 
  onBack 
}: { 
  user: any; 
  onLogout: () => void; 
  onBack: () => void; 
}) {
  return (
    <header className="border-b bg-background/95 backdrop-blur-sm">
      <div className="container max-w-6xl mx-auto flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="bg-primary/10 p-2 rounded-lg">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{user?.academy?.name || 'Portal do Aluno'}</h2>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onLogout}
          data-testid="button-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}

function ScheduleSkeletonLoader() {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-[60px] mx-auto" />
                <Skeleton className="h-4 w-[100px] mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center space-x-4 p-4 bg-secondary/30 rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-[200px]" />
                    <Skeleton className="h-4 w-[300px]" />
                  </div>
                  <Skeleton className="h-6 w-[80px]" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}