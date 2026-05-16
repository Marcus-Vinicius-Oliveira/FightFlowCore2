import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, Clock, Users, UserCheck, UserX, User, Search, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Student {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attendance?: {
    id: string;
    status: string;
    notes?: string;
    date: string;
  } | null;
}

interface ClassAttendanceData {
  classId: string;
  className: string;
  instructor: string;
  date: string;
  students: Student[];
}

const ATTENDANCE_STATUS = [
  { value: "presente", label: "Presente", icon: UserCheck, color: "text-green-600" },
  { value: "falta", label: "Falta", icon: UserX, color: "text-red-600" },
  { value: "justificado", label: "Justificado", icon: User, color: "text-yellow-600" },
];

interface AttendanceRowProps {
  student: Student;
  date: string;
  onUpdate: (studentId: string, status: string, notes?: string) => void;
  isUpdating: boolean;
}

function AttendanceRow({ student, date, onUpdate, isUpdating }: AttendanceRowProps) {
  const [status, setStatus] = useState(student.attendance?.status || "");
  const [notes, setNotes] = useState(student.attendance?.notes || "");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const originalStatus = student.attendance?.status || "";
    const originalNotes = student.attendance?.notes || "";
    setHasChanges(status !== originalStatus || notes !== originalNotes);
  }, [status, notes, student.attendance]);

  const handleSave = () => {
    if (status && hasChanges) {
      onUpdate(student.studentId, status, notes);
    }
  };

  const statusData = ATTENDANCE_STATUS.find(s => s.value === status);

  return (
    <TableRow data-testid={`attendance-row-${student.studentId}`}>
      <TableCell className="font-medium">
        <div>
          <div className="font-medium">{student.studentName}</div>
          <div className="text-sm text-muted-foreground">{student.studentEmail}</div>
        </div>
      </TableCell>
      
      <TableCell className="min-w-[200px]">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid={`select-status-${student.studentId}`}>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_STATUS.map((statusOption) => (
              <SelectItem key={statusOption.value} value={statusOption.value}>
                <div className="flex items-center gap-2">
                  <statusOption.icon className={`h-4 w-4 ${statusOption.color}`} />
                  {statusOption.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      
      <TableCell className="min-w-[200px]">
        <Textarea
          placeholder="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px] resize-none"
          data-testid={`textarea-notes-${student.studentId}`}
        />
      </TableCell>
      
      <TableCell>
        <div className="flex items-center gap-2">
          {statusData && (
            <Badge 
              variant={status === "presente" ? "default" : 
                      status === "falta" ? "destructive" : "secondary"}
              className="flex items-center gap-1"
            >
              <statusData.icon className="h-3 w-3" />
              {statusData.label}
            </Badge>
          )}
        </div>
      </TableCell>
      
      <TableCell>
        <Button
          size="sm"
          variant={hasChanges ? "default" : "ghost"}
          onClick={handleSave}
          disabled={!status || !hasChanges || isUpdating}
          data-testid={`button-save-${student.studentId}`}
        >
          <Save className="h-3 w-3 mr-1" />
          Salvar
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function AttendanceControl() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { toast } = useToast();

  // Get class ID from URL parameters
  const classId = window.location.pathname.split('/').pop();

  const { data: attendanceData, isLoading, error } = useQuery<ClassAttendanceData>({
    queryKey: ['/api/classes', classId, 'attendance', selectedDate],
    queryFn: () => apiRequest('GET', `/api/classes/${classId}/attendance?date=${selectedDate}`).then(res => res.json()),
    enabled: !!classId
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: ({ studentId, status, notes }: { studentId: string; status: string; notes?: string }) =>
      apiRequest('POST', `/api/classes/${classId}/attendance`, {
        studentId,
        date: selectedDate,
        status,
        notes
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes', classId, 'attendance'] });
      toast({
        title: "Presença registrada",
        description: "A presença foi registrada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar presença",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateAttendance = (studentId: string, status: string, notes?: string) => {
    updateAttendanceMutation.mutate({ studentId, status, notes });
  };

  const handleBulkAttendance = (status: string) => {
    if (!attendanceData?.students) return;

    const filteredStudents = attendanceData.students.filter((student: Student) =>
      student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredStudents.forEach((student: Student) => {
      updateAttendanceMutation.mutate({ 
        studentId: student.studentId, 
        status,
        notes: `Marcação em lote - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
      });
    });
  };

  const filteredStudents = attendanceData?.students?.filter((student: Student) =>
    student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const attendanceSummary = {
    total: filteredStudents.length,
    present: filteredStudents.filter(s => s.attendance?.status === "presente").length,
    absent: filteredStudents.filter(s => s.attendance?.status === "falta").length,
    justified: filteredStudents.filter(s => s.attendance?.status === "justificado").length,
    pending: filteredStudents.filter(s => !s.attendance?.status).length,
  };

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Erro ao carregar dados da aula. Verifique se você tem permissão para acessar esta aula.
            </p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => setLocation('/dashboard/grade')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar à Grade
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation('/dashboard/grade')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à Grade
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Controle de Presença</h1>
            <p className="text-muted-foreground">
              {attendanceData?.className} - {attendanceData?.instructor}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Label htmlFor="date">Data:</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
            data-testid="input-date"
          />
        </div>
      </div>

      {/* Resumo da Presença */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{attendanceSummary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{attendanceSummary.present}</p>
                <p className="text-xs text-muted-foreground">Presentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <UserX className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{attendanceSummary.absent}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{attendanceSummary.justified}</p>
                <p className="text-xs text-muted-foreground">Justificados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{attendanceSummary.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Lista de Presença
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAttendance("presente")}
                disabled={updateAttendanceMutation.isPending}
                data-testid="button-bulk-present"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Marcar Todos Presentes
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAttendance("falta")}
                disabled={updateAttendanceMutation.isPending}
                data-testid="button-bulk-absent"
              >
                <UserX className="h-4 w-4 mr-2" />
                Marcar Todos Falta
              </Button>
            </div>
          </div>
          
          <CardDescription>
            {format(new Date(selectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-student"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando lista de alunos...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhum aluno encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhum aluno corresponde aos filtros." : "Não há alunos matriculados nesta aula."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student: Student) => (
                  <AttendanceRow
                    key={student.studentId}
                    student={student}
                    date={selectedDate}
                    onUpdate={handleUpdateAttendance}
                    isUpdating={updateAttendanceMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}