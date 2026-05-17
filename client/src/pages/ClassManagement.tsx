import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Edit, MoreHorizontal, Trash2, Eye, Clock, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

interface ClassType {
  id: string;
  name: string;
  description?: string;
  duration: number;
  maxCapacity?: number;
  active: boolean;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface ClassData {
  id: string;
  classTypeId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
  classType?: ClassType;
  instructor?: Instructor;
  createdAt: string;
}

const classFormSchema = z.object({
  classTypeId: z.string().min(1, "Tipo de aula é obrigatório"),
  instructorId: z.string().min(1, "Professor é obrigatório"),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1, "Horário de início é obrigatório"),
  endTime: z.string().min(1, "Horário de fim é obrigatório"),
}).refine(data => data.startTime < data.endTime, {
  message: "Horário de início deve ser anterior ao horário de fim",
  path: ["endTime"],
});

type ClassFormData = z.infer<typeof classFormSchema>;

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

interface ClassFormProps {
  classData?: ClassData;
  onClose: () => void;
}

function ClassForm({ classData, onClose }: ClassFormProps) {
  const [formData, setFormData] = useState<ClassFormData>({
    classTypeId: classData?.classTypeId || "",
    instructorId: classData?.instructorId || "",
    dayOfWeek: classData?.dayOfWeek ?? 1,
    startTime: classData?.startTime || "",
    endTime: classData?.endTime || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Get class types
  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types']
  });

  // Get instructors (professors)  
  const { data: instructors = [] } = useQuery<Instructor[]>({
    queryKey: ['/api/instructors']
  });

  const createMutation = useMutation({
    mutationFn: (data: ClassFormData) => apiRequest('POST', '/api/classes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      toast({
        title: "Aula criada com sucesso!",
        description: "A nova aula foi adicionada à grade horária.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar aula",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ClassFormData) => apiRequest('PATCH', `/api/classes/${classData!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      toast({
        title: "Aula atualizada com sucesso!",
        description: "Os dados da aula foram atualizados.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar aula",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = classFormSchema.parse(formData);
      if (classData) {
        updateMutation.mutate(validatedData);
      } else {
        createMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path) {
            errorMap[err.path[0] as string] = err.message;
          }
        });
        setErrors(errorMap);
      }
    }
  };

  const handleChange = (field: keyof ClassFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="classTypeId">Tipo de Aula</Label>
          <Select
            value={formData.classTypeId}
            onValueChange={(value) => handleChange("classTypeId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de aula" />
            </SelectTrigger>
            <SelectContent>
              {classTypes.map((type: ClassType) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.classTypeId && (
            <p className="text-sm text-destructive">{errors.classTypeId}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructorId">Professor</Label>
          <Select
            value={formData.instructorId}
            onValueChange={(value) => handleChange("instructorId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o professor" />
            </SelectTrigger>
            <SelectContent>
              {instructors.map((instructor: Instructor) => (
                <SelectItem key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.instructorId && (
            <p className="text-sm text-destructive">{errors.instructorId}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dayOfWeek">Dia da Semana</Label>
        <Select
          value={formData.dayOfWeek.toString()}
          onValueChange={(value) => handleChange("dayOfWeek", parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o dia da semana" />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OF_WEEK.map((day) => (
              <SelectItem key={day.value} value={day.value.toString()}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.dayOfWeek && (
          <p className="text-sm text-destructive">{errors.dayOfWeek}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Horário de Início</Label>
          <Input
            id="startTime"
            type="time"
            value={formData.startTime}
            onChange={(e) => handleChange("startTime", e.target.value)}
            data-testid="input-start-time"
          />
          {errors.startTime && (
            <p className="text-sm text-destructive">{errors.startTime}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime">Horário de Fim</Label>
          <Input
            id="endTime"
            type="time"
            value={formData.endTime}
            onChange={(e) => handleChange("endTime", e.target.value)}
            data-testid="input-end-time"
          />
          {errors.endTime && (
            <p className="text-sm text-destructive">{errors.endTime}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          data-testid="button-cancel"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          data-testid="button-submit"
        >
          {isLoading ? "Salvando..." : classData ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}

interface ClassDetailsProps {
  classData: ClassData;
  onClose: () => void;
}

function ClassDetails({ classData, onClose }: ClassDetailsProps) {
  const dayName = DAYS_OF_WEEK.find(d => d.value === classData.dayOfWeek)?.label || "N/A";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Tipo de Aula</Label>
          <p className="text-sm">{classData.classType?.name || "N/A"}</p>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Professor</Label>
          <p className="text-sm">{classData.instructor?.name || "N/A"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Dia da Semana</Label>
          <p className="text-sm">{dayName}</p>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Horário</Label>
          <p className="text-sm">{classData.startTime} - {classData.endTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Status</Label>
          <p className="text-sm">
            <Badge variant={classData.active ? "default" : "secondary"}>
              {classData.active ? "Ativa" : "Inativa"}
            </Badge>
          </p>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Duração</Label>
          <p className="text-sm">{classData.classType?.duration || "N/A"} minutos</p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={onClose} data-testid="button-close">
          Fechar
        </Button>
      </div>
    </div>
  );
}

export default function ClassManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
  const { toast } = useToast();

  const { data: classes = [], isLoading, error } = useQuery<ClassData[]>({
    queryKey: ['/api/classes']
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      toast({
        title: "Aula removida com sucesso!",
        description: "A aula foi desativada da grade horária.",
      });
      setShowDeleteDialog(false);
      setClassToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover aula",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (classData: ClassData) => {
    setSelectedClass(classData);
    setShowForm(true);
  };

  const handleViewDetails = (classData: ClassData) => {
    setSelectedClass(classData);
    setShowDetails(true);
  };

  const handleDelete = (classData: ClassData) => {
    setClassToDelete(classData);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (classToDelete) {
      deleteMutation.mutate(classToDelete.id);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedClass(null);
  };

  const closeDetails = () => {
    setShowDetails(false);
    setSelectedClass(null);
  };

  const filteredClasses = classes.filter((classData: ClassData) =>
    classData.classType?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    classData.instructor?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    DAYS_OF_WEEK.find(d => d.value === classData.dayOfWeek)?.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Erro ao carregar aulas. Tente novamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Aulas</h1>
          <p className="text-muted-foreground">
            Gerencie a grade horária e organize as aulas da academia
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          data-testid="button-add-class"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Aula
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Aulas Cadastradas
          </CardTitle>
          <CardDescription>
            Lista de todas as aulas da grade horária
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tipo de aula, professor ou dia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando aulas...</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Nenhuma aula encontrada</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhuma aula corresponde aos filtros." : "Comece criando sua primeira aula."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Aula</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead>Dia da Semana</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((classData: ClassData) => (
                  <TableRow key={classData.id}>
                    <TableCell className="font-medium">
                      {classData.classType?.name || "N/A"}
                    </TableCell>
                    <TableCell>{classData.instructor?.name || "N/A"}</TableCell>
                    <TableCell>
                      {DAYS_OF_WEEK.find(d => d.value === classData.dayOfWeek)?.label || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {classData.startTime} - {classData.endTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={classData.active ? "default" : "secondary"}>
                        {classData.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            data-testid={`button-actions-${classData.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleViewDetails(classData)}
                            data-testid={`button-view-details-${classData.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleEdit(classData)}
                            data-testid={`button-edit-${classData.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(classData)}
                            className="text-destructive"
                            data-testid={`button-delete-${classData.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Desativar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedClass ? "Editar Aula" : "Nova Aula"}
            </DialogTitle>
            <DialogDescription>
              {selectedClass ? "Atualize os dados da aula." : "Crie uma nova aula na grade horária."}
            </DialogDescription>
          </DialogHeader>
          <ClassForm classData={selectedClass || undefined} onClose={closeForm} />
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Aula</DialogTitle>
            <DialogDescription>
              Informações completas da aula selecionada.
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <ClassDetails classData={selectedClass} onClose={closeDetails} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desativação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar a aula "{classToDelete?.classType?.name}"? 
              Esta ação irá remover a aula da grade horária ativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Desativando..." : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}