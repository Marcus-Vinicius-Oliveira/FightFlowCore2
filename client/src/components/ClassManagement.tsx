import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, MapPin, CalendarPlus, Plus, Edit, Trash2, Eye } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ClassData {
  id: string;
  academyId: string;
  classTypeId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
  createdAt: string;
}

interface ClassType {
  id: string;
  academyId: string;
  name: string;
  description?: string;
  duration: number;
  maxCapacity?: number;
  active: boolean;
  createdAt: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ClassFormData {
  classTypeId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface ClassTypeFormData {
  name: string;
  description: string;
  duration: number;
  maxCapacity: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export function ClassManagement() {
  const [activeTab, setActiveTab] = useState("schedule");
  const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
  const [isAddClassTypeDialogOpen, setIsAddClassTypeDialogOpen] = useState(false);
  const [classFormData, setClassFormData] = useState<ClassFormData>({
    classTypeId: "",
    instructorId: "",
    dayOfWeek: 1,
    startTime: "",
    endTime: ""
  });
  const [classTypeFormData, setClassTypeFormData] = useState<ClassTypeFormData>({
    name: "",
    description: "",
    duration: 90,
    maxCapacity: 20
  });

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch data
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: () => apiClient.getClasses(),
  });

  const { data: classTypes = [], isLoading: loadingClassTypes } = useQuery({
    queryKey: ['/api/class-types'], 
    queryFn: () => apiClient.getClassTypes(),
  });

  // For now, use the current user as instructor (in real app, you'd fetch instructors)
  const instructors = user ? [{
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  }] : [];
  const loadingInstructors = false;

  // Mutations
  const createClassMutation = useMutation({
    mutationFn: (classData: ClassFormData) => apiClient.createClass(classData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      setIsAddClassDialogOpen(false);
      setClassFormData({
        classTypeId: "",
        instructorId: "",
        dayOfWeek: 1,
        startTime: "",
        endTime: ""
      });
      toast({
        title: "Aula Adicionada",
        description: "Nova aula foi agendada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Adicionar Aula",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createClassTypeMutation = useMutation({
    mutationFn: (classTypeData: ClassTypeFormData) => apiClient.createClassType(classTypeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/class-types'] });
      setIsAddClassTypeDialogOpen(false);
      setClassTypeFormData({
        name: "",
        description: "",
        duration: 90,
        maxCapacity: 20
      });
      toast({
        title: "Modalidade Adicionada",
        description: "Nova modalidade foi criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Adicionar Modalidade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClassMutation.mutate(classFormData);
  };

  const handleClassTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClassTypeMutation.mutate(classTypeFormData);
  };

  const getClassTypeById = (id: string) => classTypes.find(ct => ct.id === id);
  const getInstructorById = (id: string) => instructors.find(i => i.id === id);

  const groupClassesByDay = (classes: ClassData[]) => {
    return DAYS_OF_WEEK.map(day => ({
      ...day,
      classes: classes
        .filter(c => c.dayOfWeek === day.value)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    }));
  };

  const formatTime = (time: string) => {
    return new Date(`1970-01-01T${time}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
    return Math.round((end.getTime() - start.getTime()) / 60000); // minutes
  };

  if (loadingClasses || loadingClassTypes || loadingInstructors) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando dados das aulas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Gerenciamento de Aulas</CardTitle>
            <CardDescription>
              Gerencie o cronograma de aulas e modalidades da sua academia
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule" data-testid="tab-schedule">Cronograma</TabsTrigger>
            <TabsTrigger value="types" data-testid="tab-types">Modalidades</TabsTrigger>
          </TabsList>

          {/* Class Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Cronograma Semanal</h3>
                <p className="text-sm text-muted-foreground">Agende múltiplas aulas por dia para diferentes horários e níveis de alunos</p>
              </div>
              <Dialog open={isAddClassDialogOpen} onOpenChange={setIsAddClassDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-class">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Agendar Aula
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agendar Nova Aula</DialogTitle>
                    <DialogDescription>
                      Adicione uma aula recorrente ao cronograma da sua academia. Você pode agendar múltiplas aulas para o mesmo dia e mesma arte marcial em horários diferentes.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleClassSubmit}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="class-type">Modalidade</Label>
                        <Select 
                          value={classFormData.classTypeId}
                          onValueChange={(value) => setClassFormData(prev => ({ ...prev, classTypeId: value }))}
                        >
                          <SelectTrigger data-testid="select-class-type">
                            <SelectValue placeholder="Selecionar modalidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {classTypes.map((classType) => (
                              <SelectItem key={classType.id} value={classType.id}>
                                {classType.name} ({classType.duration} min)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instructor">Instrutor</Label>
                        <Select 
                          value={classFormData.instructorId}
                          onValueChange={(value) => setClassFormData(prev => ({ ...prev, instructorId: value }))}
                        >
                          <SelectTrigger data-testid="select-instructor">
                            <SelectValue placeholder="Selecionar instrutor" />
                          </SelectTrigger>
                          <SelectContent>
                            {instructors.map((instructor) => (
                              <SelectItem key={instructor.id} value={instructor.id}>
                                {instructor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="day-of-week">Dia da Semana</Label>
                        <Select 
                          value={classFormData.dayOfWeek.toString()}
                          onValueChange={(value) => setClassFormData(prev => ({ ...prev, dayOfWeek: parseInt(value) }))}
                        >
                          <SelectTrigger data-testid="select-day-of-week">
                            <SelectValue placeholder="Selecionar dia" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Horário de Início</Label>
                          <Input
                            id="start-time"
                            type="time"
                            value={classFormData.startTime}
                            onChange={(e) => setClassFormData(prev => ({ ...prev, startTime: e.target.value }))}
                            required
                            data-testid="input-start-time"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="end-time">Horário de Término</Label>
                          <Input
                            id="end-time"
                            type="time"
                            value={classFormData.endTime}
                            onChange={(e) => setClassFormData(prev => ({ ...prev, endTime: e.target.value }))}
                            required
                            data-testid="input-end-time"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddClassDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createClassMutation.isPending}
                        data-testid="button-submit-class"
                      >
                        {createClassMutation.isPending ? "Agendando..." : "Agendar Aula"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {classes.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma Aula Agendada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece criando algumas modalidades, depois agende suas aulas. Você pode criar múltiplas sessões por dia - por exemplo, Muay Thai às 08:00 e novamente às 18:00.
                </p>
                <Button 
                  onClick={() => setIsAddClassDialogOpen(true)}
                  data-testid="button-schedule-first-class"
                >
                  Agendar Primeira Aula
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {groupClassesByDay(classes).map((daySchedule) => (
                  <div key={daySchedule.value} className="space-y-3">
                    <h4 className="font-semibold text-lg flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      {daySchedule.label}
                      <Badge variant="secondary" className="ml-2">
                        {daySchedule.classes.length} aulas
                      </Badge>
                    </h4>
                    
                    {daySchedule.classes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        <p>Nenhuma aula agendada para {daySchedule.label}</p>
                        <p className="text-xs mt-1">Você pode agendar múltiplas aulas para este dia</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {daySchedule.classes.map((classItem) => {
                          const classType = getClassTypeById(classItem.classTypeId);
                          const instructor = getInstructorById(classItem.instructorId);
                          const duration = calculateDuration(classItem.startTime, classItem.endTime);
                          
                          return (
                            <Card key={classItem.id} className="hover-elevate cursor-pointer" data-testid={`card-class-${classItem.id}`}>
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between">
                                    <h5 className="font-medium leading-tight" data-testid={`text-class-name-${classItem.id}`}>
                                      {classType?.name || 'Modalidade Desconhecida'}
                                    </h5>
                                    <Badge variant="outline" data-testid={`badge-active-${classItem.id}`}>
                                      {classItem.active ? 'Ativa' : 'Inativa'}
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-2 text-sm text-muted-foreground">
                                    <div className="flex items-center space-x-2">
                                      <Clock className="h-4 w-4" />
                                      <span data-testid={`text-class-time-${classItem.id}`}>
                                        {formatTime(classItem.startTime)} - {formatTime(classItem.endTime)}
                                      </span>
                                      <span className="text-xs">({duration} min)</span>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <Users className="h-4 w-4" />
                                      <span data-testid={`text-instructor-${classItem.id}`}>
                                        {instructor?.name || 'Instrutor Desconhecido'}
                                      </span>
                                    </div>
                                    
                                    {classType?.maxCapacity && (
                                      <div className="flex items-center space-x-2">
                                        <Users className="h-4 w-4" />
                                        <span data-testid={`text-capacity-${classItem.id}`}>
                                          Máx {classType.maxCapacity} alunos
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {classType?.description && (
                                    <div className="pt-2 border-t">
                                      <p className="text-sm text-muted-foreground">
                                        {classType.description}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Class Types Tab */}
          <TabsContent value="types" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Modalidades</h3>
              <Dialog open={isAddClassTypeDialogOpen} onOpenChange={setIsAddClassTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-class-type">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Modalidade
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Modalidade</DialogTitle>
                    <DialogDescription>
                      Defina um novo tipo de aula para sua academia.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleClassTypeSubmit}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="class-type-name">Nome da Modalidade</Label>
                        <Input
                          id="class-type-name"
                          value={classTypeFormData.name}
                          onChange={(e) => setClassTypeFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="ex: Jiu-Jitsu Fundamentos, Karatê Avançado"
                          required
                          data-testid="input-class-type-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="class-type-description">Descrição</Label>
                        <Textarea
                          id="class-type-description"
                          value={classTypeFormData.description}
                          onChange={(e) => setClassTypeFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descreva o que esta aula abrange..."
                          data-testid="input-class-type-description"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="duration">Duração (minutos)</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={classTypeFormData.duration}
                            onChange={(e) => setClassTypeFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                            min="30"
                            max="240"
                            required
                            data-testid="input-duration"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="max-capacity">Capacidade Máxima</Label>
                          <Input
                            id="max-capacity"
                            type="number"
                            value={classTypeFormData.maxCapacity}
                            onChange={(e) => setClassTypeFormData(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) }))}
                            min="1"
                            max="100"
                            required
                            data-testid="input-max-capacity"
                          />
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="mt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddClassTypeDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createClassTypeMutation.isPending}
                        data-testid="button-submit-class-type"
                      >
                        {createClassTypeMutation.isPending ? "Criando..." : "Criar Modalidade"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {classTypes.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma Modalidade</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira modalidade para começar a agendar aulas.
                </p>
                <Button 
                  onClick={() => setIsAddClassTypeDialogOpen(true)}
                  data-testid="button-create-first-class-type"
                >
                  Criar Primeira Modalidade
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classTypes.map((classType) => (
                  <Card key={classType.id} className="hover-elevate" data-testid={`card-class-type-${classType.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h5 className="font-medium leading-tight" data-testid={`text-class-type-name-${classType.id}`}>
                            {classType.name}
                          </h5>
                          <Badge variant={classType.active ? "default" : "secondary"} data-testid={`badge-class-type-status-${classType.id}`}>
                            {classType.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        
                        {classType.description && (
                          <p className="text-sm text-muted-foreground" data-testid={`text-class-type-description-${classType.id}`}>
                            {classType.description}
                          </p>
                        )}
                        
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span data-testid={`text-class-type-duration-${classType.id}`}>
                              {classType.duration} minutos
                            </span>
                          </div>
                          
                          {classType.maxCapacity && (
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span data-testid={`text-class-type-capacity-${classType.id}`}>
                                Máx {classType.maxCapacity} alunos
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}