import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  Award, 
  Users, 
  CheckCircle2, 
  LogOut,
  CalendarDays,
  AlertCircle 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { apiClient } from "@/lib/api";

interface StudentData {
  enrollments: Array<{
    id: string;
    membershipPlan: {
      name: string;
      price: number;
      classesPerWeek: number;
    };
    class: {
      classType: {
        name: string;
        duration: number;
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
  }>;
  attendance: Array<{
    id: string;
    date: string;
    status: string;
    notes?: string;
    class: {
      classType: {
        name: string;
      };
      instructor: {
        name: string;
      };
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    dueDate: string;
    paidDate?: string;
    status: string;
    membershipPlan: {
      name: string;
    };
  }>;
}

export default function PortalDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const { data: studentData, isLoading, error } = useQuery<StudentData>({
    queryKey: ['/api/student/me'],
    enabled: !!user && user.role === 'ALUNO',
  });

  const handleLogout = () => {
    logout();
    setLocation("/portal/login");
  };

  const navigateToSchedule = () => {
    setLocation("/portal/horarios");
  };

  // Calculate stats
  const stats = studentData ? calculateStats(studentData) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} onLogout={handleLogout} />
        <main className="container max-w-6xl mx-auto p-6">
          <div className="space-y-6">
            <SkeletonLoader />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} onLogout={handleLogout} />
        <main className="container max-w-6xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar dados do portal. Tente novamente mais tarde.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader user={user} onLogout={handleLogout} />
      
      <main className="container max-w-6xl mx-auto p-6">
        <div className="space-y-6">
          {/* Welcome Section */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Bem-vindo de volta, {user?.name}!
            </h1>
            <p className="text-muted-foreground mt-2">
              Aqui está seu resumo de treinos e próximas aulas.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={navigateToSchedule} data-testid="button-view-schedule">
              <CalendarDays className="mr-2 h-4 w-4" />
              Ver Grade de Horários
            </Button>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Presença</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-attendance-rate">
                    {stats.attendanceRate.toFixed(0)}%
                  </div>
                  <Progress value={stats.attendanceRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aulas Frequentadas</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-classes-attended">
                    {stats.classesAttended}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    de {stats.totalClasses} este mês
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sequência Atual</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-current-streak">
                    {stats.currentStreak}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    aulas consecutivas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Próximo Pagamento</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold mb-1" data-testid="text-next-payment">
                    {stats.nextPaymentDate || "Não informado"}
                  </div>
                  <Badge 
                    variant={stats.paymentStatus === 'paid' ? 'default' : 'destructive'}
                    data-testid="badge-payment-status"
                  >
                    {stats.paymentStatus === 'paid' ? 'Em dia' : 'Pendente'}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming Classes */}
            <Card>
              <CardHeader>
                <CardTitle>Próximas Aulas</CardTitle>
                <CardDescription>Suas aulas matriculadas esta semana</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {studentData?.enrollments?.filter(e => e.active).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma matrícula ativa encontrada
                  </p>
                ) : (
                  studentData?.enrollments
                    ?.filter(e => e.active)
                    ?.slice(0, 3)
                    ?.map((enrollment) => (
                      <div 
                        key={enrollment.id} 
                        className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`upcoming-class-${enrollment.id}`}
                      >
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`class-name-${enrollment.id}`}>
                            {enrollment.class.classType.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {enrollment.class.instructor.name}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                            <span>{getDayName(enrollment.class.dayOfWeek)}</span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {enrollment.class.startTime} - {enrollment.class.endTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card>
              <CardHeader>
                <CardTitle>Presenças Recentes</CardTitle>
                <CardDescription>Seu histórico de frequência</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!studentData?.attendance || studentData.attendance.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum registro de presença encontrado
                  </p>
                ) : (
                  studentData.attendance
                    .slice(0, 5)
                    .map((record, index) => (
                      <div 
                        key={record.id} 
                        className="flex items-center space-x-4 p-3 rounded-lg"
                        data-testid={`attendance-record-${index}`}
                      >
                        <div className="flex-shrink-0">
                          {record.status === 'presente' ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                          ) : (
                            <div className="h-6 w-6 rounded-full border-2 border-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`attendance-class-${index}`}>
                            {record.class.classType.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {record.class.instructor.name} • {formatDate(record.date)}
                          </p>
                          {record.notes && (
                            <p className="text-xs text-orange-600 mt-1">{record.notes}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Badge 
                            variant={record.status === 'presente' ? "default" : "secondary"}
                            className={record.status === 'presente' ? "text-green-600" : "text-muted-foreground"}
                            data-testid={`attendance-status-${index}`}
                          >
                            {record.status === 'presente' ? 'Presente' : 
                             record.status === 'falta' ? 'Falta' : 'Justificado'}
                          </Badge>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Membership Info */}
          {studentData?.enrollments && studentData.enrollments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Informações da Matrícula</CardTitle>
                <CardDescription>Detalhes da sua mensalidade atual</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Plano</p>
                  <p className="text-lg font-semibold" data-testid="text-membership-plan">
                    {studentData.enrollments[0].membershipPlan.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Início da Matrícula</p>
                  <p className="text-lg font-semibold" data-testid="text-enrollment-start">
                    {formatDate(studentData.enrollments[0].startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aulas por Semana</p>
                  <p className="text-lg font-semibold" data-testid="text-classes-per-week">
                    {studentData.enrollments[0].membershipPlan.classesPerWeek || 'Ilimitado'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function PortalHeader({ user, onLogout }: { user: any; onLogout: () => void }) {
  return (
    <header className="border-b bg-background/95 backdrop-blur-sm">
      <div className="container max-w-6xl mx-auto flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Award className="h-6 w-6 text-primary" />
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

function SkeletonLoader() {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-8 w-[300px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <Skeleton className="h-4 w-[120px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[80px] mb-2" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function calculateStats(studentData: StudentData) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Filter attendance for current month
  const monthlyAttendance = studentData.attendance.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
  });

  const totalClasses = monthlyAttendance.length;
  const attendedClasses = monthlyAttendance.filter(record => record.status === 'presente').length;
  const attendanceRate = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

  // Calculate current streak
  const sortedAttendance = [...studentData.attendance]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  let currentStreak = 0;
  for (const record of sortedAttendance) {
    if (record.status === 'presente') {
      currentStreak++;
    } else {
      break;
    }
  }

  // Find next payment
  const upcomingPayments = studentData.payments
    .filter(payment => payment.status === 'pending')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  const nextPayment = upcomingPayments[0];
  const nextPaymentDate = nextPayment ? formatDate(nextPayment.dueDate) : null;
  const paymentStatus = nextPayment ? 'pending' : 'paid';

  return {
    attendanceRate,
    classesAttended: attendedClasses,
    totalClasses,
    currentStreak,
    nextPaymentDate,
    paymentStatus,
  };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getDayName(dayOfWeek: number) {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[dayOfWeek] || 'Dia inválido';
}