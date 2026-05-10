import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Clock, TrendingUp, Award, Users, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";

export function StudentPortal() {
  const { user } = useAuth();

  const { data: studentData } = useQuery({
    queryKey: ['student/me'],
    queryFn: () => apiClient.getStudentData(),
  });

  const attendance: any[] = studentData?.attendance ?? [];
  const payments: any[] = studentData?.payments ?? [];
  const enrollments: any[] = studentData?.enrollments ?? [];

  // Stats computed from real data
  const classesAttended = attendance.filter(a => a.status === 'presente').length;
  const totalClasses = attendance.length;
  const attendanceRate = totalClasses > 0 ? Math.round((classesAttended / totalClasses) * 100) : 0;

  const sortedAttendance = [...attendance].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let currentStreak = 0;
  for (const record of sortedAttendance) {
    if (record.status === 'presente') currentStreak++;
    else break;
  }

  const pendingPayments = payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const nextPayment = pendingPayments[0];

  const paidPayments = payments.filter(p => p.status === 'paid');
  const lastPaid = paidPayments.sort(
    (a, b) => new Date(b.paidDate ?? b.dueDate).getTime() - new Date(a.paidDate ?? a.dueDate).getTime()
  )[0];
  const paymentStatus = nextPayment?.status === 'overdue' ? 'overdue' : lastPaid ? 'paid' : 'pending';

  const recentAttendance = sortedAttendance.slice(0, 5);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

  const getPaymentBadge = (status: string) =>
    status === 'paid' ? (
      <Badge variant="default" className="text-green-600" data-testid="badge-payment-paid">
        Pago
      </Badge>
    ) : status === 'overdue' ? (
      <Badge variant="destructive" data-testid="badge-payment-overdue">
        Atrasado
      </Badge>
    ) : (
      <Badge variant="secondary" data-testid="badge-payment-pending">
        Pendente
      </Badge>
    );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">Bem-vindo, {user?.name ?? ''}!</h1>
        <p className="text-muted-foreground mt-2">Veja seu resumo de treinos e próximas aulas.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Presença</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-attendance-rate">
              {attendanceRate}%
            </div>
            <Progress value={attendanceRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aulas Assistidas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-classes-attended">
              {classesAttended}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              de {totalClasses} registradas
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
              {currentStreak}
            </div>
            <p className="text-xs text-muted-foreground mt-1">aulas consecutivas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo Pagamento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {nextPayment ? (
              <>
                <div className="text-sm font-bold mb-1" data-testid="text-next-payment">
                  {formatDate(nextPayment.dueDate)}
                </div>
                {getPaymentBadge(nextPayment.status === 'overdue' ? 'overdue' : 'pending')}
              </>
            ) : (
              <div className="text-sm font-bold mb-1" data-testid="text-next-payment">
                {getPaymentBadge(paymentStatus)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matriculas ativas */}
        <Card>
          <CardHeader>
            <CardTitle>Matrículas Ativas</CardTitle>
            <CardDescription>
              {enrollments.filter(e => e.active).length} turma(s) matriculada(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrollments.filter(e => e.active).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma matrícula ativa no momento.</p>
            ) : (
              enrollments.filter(e => e.active).map((enrollment: any) => (
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
                      Turma ativa
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Desde {formatDate(enrollment.startDate)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Histórico de presença */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Presença</CardTitle>
            <CardDescription>Últimas aulas registradas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAttendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro de presença ainda.</p>
            ) : (
              recentAttendance.map((record: any, index: number) => (
                <div
                  key={record.id ?? index}
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
                      Aula registrada
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(record.date)}
                    </p>
                    {record.notes && (
                      <p className="text-xs text-orange-600 mt-1">{record.notes}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <Badge
                      variant={record.status === 'presente' ? 'default' : 'secondary'}
                      className={record.status === 'presente' ? 'text-green-600' : 'text-muted-foreground'}
                      data-testid={`attendance-status-${index}`}
                    >
                      {record.status === 'presente' ? 'Presente' : record.status === 'justificado' ? 'Justificado' : 'Falta'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Membership info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Matrícula</CardTitle>
          <CardDescription>Resumo da sua situação na academia</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Matrículas ativas</p>
            <p className="text-lg font-semibold" data-testid="text-membership-plan">
              {enrollments.filter(e => e.active).length} turma(s)
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total de presenças</p>
            <p className="text-lg font-semibold" data-testid="text-join-date">
              {classesAttended} aulas
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status do pagamento</p>
            <div className="mt-1">
              {getPaymentBadge(paymentStatus)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
