import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, MoreHorizontal, Trash2, Eye, Clock, Calendar, FileDown, ChevronDown, X, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { ClassEnrollmentsDialog } from "@/components/ClassEnrollmentsDialog";
import { occupancy } from "@/lib/enrollments";

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
  ids: string[];
  dayRecords: { id: string; dayOfWeek: number }[];
  classTypeId: string;
  instructorId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  active: boolean;
  enrolledCount: number;
  classType?: ClassType;
  instructor?: Instructor;
  createdAt?: string;
}

const classFormSchema = z.object({
  classTypeId: z.string().min(1, "Tipo de aula é obrigatório"),
  instructorId: z.string().min(1, "Professor é obrigatório"),
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1, "Selecione pelo menos um dia"),
  startTime: z.string().min(1, "Horário de início é obrigatório"),
  endTime: z.string().min(1, "Horário de fim é obrigatório"),
}).refine(data => data.startTime < data.endTime, {
  message: "Horário de início deve ser anterior ao horário de fim",
  path: ["endTime"],
});

type ClassFormData = z.infer<typeof classFormSchema>;

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo",      short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira",  short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira",  short: "Sex" },
  { value: 6, label: "Sábado",       short: "Sáb" },
];

interface ClassFormProps {
  classData?: ClassData;
  onClose: () => void;
}

function ClassForm({ classData, onClose }: ClassFormProps) {
  const isEdit = !!classData;
  const [formData, setFormData] = useState<ClassFormData>({
    classTypeId: classData?.classTypeId || "",
    instructorId: classData?.instructorId || "",
    daysOfWeek: classData?.daysOfWeek ?? [],
    startTime: classData?.startTime || "",
    endTime: classData?.endTime || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types']
  });

  const { data: instructors = [] } = useQuery<Instructor[]>({
    queryKey: ['/api/instructors']
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      await Promise.all(
        data.daysOfWeek.map(day =>
          apiRequest('POST', '/api/classes', {
            classTypeId: data.classTypeId,
            instructorId: data.instructorId,
            dayOfWeek: day,
            startTime: data.startTime,
            endTime: data.endTime,
          })
        )
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      const n = variables.daysOfWeek.length;
      toast({
        title: n > 1 ? `${n} aulas criadas com sucesso!` : "Aula criada com sucesso!",
        description: "As aulas foram adicionadas à grade horária.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar aula", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ClassFormData) => {
      const oldRecords = classData!.dayRecords;
      const newDays = data.daysOfWeek;

      const toRemove = oldRecords.filter(r => !newDays.includes(r.dayOfWeek));
      const toUpdate = oldRecords.filter(r => newDays.includes(r.dayOfWeek));
      const toAdd = newDays.filter(d => !oldRecords.some(r => r.dayOfWeek === d));

      await Promise.all([
        // Dias removidos → desativa o registro individual
        ...toRemove.map(r => apiRequest('DELETE', `/api/classes/${r.id}`)),
        // Dias mantidos → atualiza campos (tipo, professor, horário)
        ...toUpdate.map(r => apiRequest('PATCH', `/api/classes/${r.id}`, {
          classTypeId: data.classTypeId,
          instructorId: data.instructorId,
          startTime: data.startTime,
          endTime: data.endTime,
        })),
        // Dias adicionados → cria novo registro
        ...toAdd.map(day => apiRequest('POST', '/api/classes', {
          classTypeId: data.classTypeId,
          instructorId: data.instructorId,
          dayOfWeek: day,
          startTime: data.startTime,
          endTime: data.endTime,
        })),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      toast({ title: "Aula atualizada com sucesso!", description: "Os dados da aula foram atualizados." });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar aula", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const validatedData = classFormSchema.parse(formData);
      if (isEdit) {
        updateMutation.mutate(validatedData);
      } else {
        createMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path) errorMap[err.path[0] as string] = err.message;
        });
        setErrors(errorMap);
      }
    }
  };

  const handleChange = (field: keyof Omit<ClassFormData, 'daysOfWeek'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const toggleDay = (day: number) => {
    setFormData(prev => {
      const next = prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day];
      return { ...prev, daysOfWeek: next };
    });
    if (errors.daysOfWeek) setErrors(prev => ({ ...prev, daysOfWeek: "" }));
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
        <Label>Dias da Semana</Label>
        <div className="flex gap-1.5">
          {DAYS_OF_WEEK.map((day) => {
            const selected = formData.daysOfWeek.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                title={day.label}
                className={cn(
                  "flex-1 h-9 rounded-md text-xs font-semibold border transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {day.short}
              </button>
            );
          })}
        </div>
        {errors.daysOfWeek && (
          <p className="text-sm text-destructive">{errors.daysOfWeek}</p>
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
          {isLoading
            ? "Salvando..."
            : isEdit
              ? "Atualizar"
              : formData.daysOfWeek.length > 1
                ? `Criar ${formData.daysOfWeek.length} aulas`
                : "Criar"}
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

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-muted-foreground">Dias da Semana</Label>
        <div className="flex flex-wrap gap-1.5">
          {classData.daysOfWeek.map(day => (
            <Badge key={day} variant="secondary" className="text-xs">
              {DAYS_OF_WEEK.find(d => d.value === day)?.label ?? day}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Horário</Label>
          <p className="text-sm">{classData.startTime} - {classData.endTime}</p>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Duração</Label>
          <p className="text-sm">{classData.classType?.duration || "N/A"} minutos</p>
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
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={onClose} data-testid="button-close">
          Fechar
        </Button>
      </div>
    </div>
  );
}

interface FilterState {
  classTypeId: string;
  instructorId: string;
  daysOfWeek: number[];
  startTime: string;
}

const EMPTY_FILTERS: FilterState = { classTypeId: "", instructorId: "", daysOfWeek: [], startTime: "" };

export default function ClassManagement() {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showEnrollments, setShowEnrollments] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const hasActiveFilters =
    !!filters.classTypeId || !!filters.instructorId || filters.daysOfWeek.length > 0 || !!filters.startTime;

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const toggleFilterDay = (day: number) => {
    setFilters(prev => {
      const days = prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day];
      return { ...prev, daysOfWeek: days };
    });
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/classes/export/pdf', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Erro ao gerar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grade_horaria.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: 'Erro ao exportar PDF', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const { data: filterClassTypes = [] } = useQuery<ClassType[]>({ queryKey: ['/api/classes/class-types'] });
  const { data: filterInstructors = [] } = useQuery<Instructor[]>({ queryKey: ['/api/instructors'] });

  const { data: classes = [], isLoading, error } = useQuery<ClassData[]>({
    queryKey: ['/api/classes', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.classTypeId)  params.set('classTypeId', filters.classTypeId);
      if (filters.instructorId) params.set('instructorId', filters.instructorId);
      if (filters.startTime)    params.set('startTime', filters.startTime);
      filters.daysOfWeek.forEach(d => params.append('days', String(d)));
      const qs = params.toString();
      const res = await apiRequest('GET', `/api/classes${qs ? '?' + qs : ''}`);
      return res.json();
    },
  });

  // Query sem startTime para popular o Select de horários (cascading: respeita outros filtros)
  const { data: classesForTimeOptions = [] } = useQuery<ClassData[]>({
    queryKey: ['/api/classes', { ...filters, startTime: '' }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.classTypeId)  params.set('classTypeId', filters.classTypeId);
      if (filters.instructorId) params.set('instructorId', filters.instructorId);
      filters.daysOfWeek.forEach(d => params.append('days', String(d)));
      const qs = params.toString();
      const res = await apiRequest('GET', `/api/classes${qs ? '?' + qs : ''}`);
      return res.json();
    },
  });

  const timeSlotOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { startTime: string; label: string }[] = [];
    for (const cls of classesForTimeOptions) {
      if (!seen.has(cls.startTime)) {
        seen.add(cls.startTime);
        opts.push({ startTime: cls.startTime, label: `${cls.startTime} – ${cls.endTime}` });
      }
    }
    return opts.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classesForTimeOptions]);

  const deleteMutation = useMutation({
    mutationFn: (classData: ClassData) =>
      Promise.all(classData.ids.map(id => apiRequest('DELETE', `/api/classes/${id}`))),
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

  const handleEnrollments = (classData: ClassData) => {
    setSelectedClass(classData);
    setShowEnrollments(true);
  };

  const handleDelete = (classData: ClassData) => {
    setClassToDelete(classData);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (classToDelete) {
      deleteMutation.mutate(classToDelete);
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

  // Filtragem acontece no servidor — classes já chegam filtradas
  const filteredClasses = classes;

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? 'Gerando PDF…' : 'Exportar PDF'}
          </Button>
          <Button
            onClick={() => setShowForm(true)}
            data-testid="button-add-class"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Aula
          </Button>
        </div>
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
          {/* ── Toolbar de Filtros Avançados ── */}
          <div className="flex flex-wrap items-center gap-2 mb-4">

            {/* Modalidade */}
            <Select
              value={filters.classTypeId || "_all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, classTypeId: v === "_all" ? "" : v }))}
            >
              <SelectTrigger
                className={cn("w-[150px]", filters.classTypeId && "border-primary")}
                data-testid="select-filter-classtype"
              >
                <span className={cn("truncate text-sm", !filters.classTypeId && "text-muted-foreground")}>
                  {filters.classTypeId
                    ? filterClassTypes.find(ct => ct.id === filters.classTypeId)?.name ?? "Modalidade"
                    : "Modalidade"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as modalidades</SelectItem>
                {filterClassTypes.map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Professor */}
            <Select
              value={filters.instructorId || "_all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, instructorId: v === "_all" ? "" : v }))}
            >
              <SelectTrigger
                className={cn("w-[150px]", filters.instructorId && "border-primary")}
                data-testid="select-filter-instructor"
              >
                <span className={cn("truncate text-sm", !filters.instructorId && "text-muted-foreground")}>
                  {filters.instructorId
                    ? filterInstructors.find(i => i.id === filters.instructorId)?.name ?? "Professor"
                    : "Professor"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os professores</SelectItem>
                {filterInstructors.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Dias da Semana — Popover com checkboxes */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[150px] justify-between font-normal text-sm",
                    filters.daysOfWeek.length > 0 ? "border-primary" : "text-muted-foreground"
                  )}
                  data-testid="popover-filter-days"
                >
                  <span className="truncate">
                    {filters.daysOfWeek.length === 0
                      ? "Dia da semana"
                      : filters.daysOfWeek.length <= 2
                        ? filters.daysOfWeek
                            .map(d => DAYS_OF_WEEK.find(x => x.value === d)?.short)
                            .join(", ")
                        : `${filters.daysOfWeek.length} dias`}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-2" align="start">
                {DAYS_OF_WEEK.map(day => (
                  <div
                    key={day.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer select-none"
                    onClick={() => toggleFilterDay(day.value)}
                  >
                    <Checkbox
                      checked={filters.daysOfWeek.includes(day.value)}
                      onCheckedChange={() => toggleFilterDay(day.value)}
                    />
                    <span className="text-sm">{day.label}</span>
                  </div>
                ))}
              </PopoverContent>
            </Popover>

            {/* Horário */}
            <Select
              value={filters.startTime || "_all"}
              onValueChange={(v) => setFilters(prev => ({ ...prev, startTime: v === "_all" ? "" : v }))}
            >
              <SelectTrigger
                className={cn("w-[150px]", filters.startTime && "border-primary")}
                data-testid="select-filter-time"
              >
                <span className={cn("truncate text-sm", !filters.startTime && "text-muted-foreground")}>
                  {filters.startTime
                    ? timeSlotOptions.find(o => o.startTime === filters.startTime)?.label ?? filters.startTime
                    : "Horário"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os horários</SelectItem>
                {timeSlotOptions.map(opt => (
                  <SelectItem key={opt.startTime} value={opt.startTime}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground h-9 px-2 hover:text-foreground"
                data-testid="button-clear-filters"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar filtros
              </Button>
            )}
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
                {hasActiveFilters ? "Nenhuma aula corresponde aos filtros." : "Comece criando sua primeira aula."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Aula</TableHead>
                  <TableHead>Professor</TableHead>
                  <TableHead className="min-w-[160px]">Dia da Semana</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Ocupação</TableHead>
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
                      <div className="flex flex-wrap gap-1">
                        {classData.daysOfWeek.map(day => (
                          <Badge key={day} variant="secondary" className="text-xs font-medium px-1.5 py-0">
                            {DAYS_OF_WEEK.find(d => d.value === day)?.short ?? day}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {classData.startTime} - {classData.endTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const occ = occupancy(classData.enrolledCount, classData.classType?.maxCapacity);
                        return (
                          <button
                            type="button"
                            onClick={() => handleEnrollments(classData)}
                            title="Ver matrículas da turma"
                            className="inline-flex"
                            data-testid={`button-occupancy-${classData.id}`}
                          >
                            <Badge
                              variant={occ.isFull ? "destructive" : "secondary"}
                              className="cursor-pointer hover:opacity-80"
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {occ.hasLimit ? `${occ.label} vagas` : occ.label}
                            </Badge>
                          </button>
                        );
                      })()}
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
                            onClick={() => handleEnrollments(classData)}
                            data-testid={`button-enrollments-${classData.id}`}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Matrículas
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

      {/* Enrollments Dialog */}
      <ClassEnrollmentsDialog
        classData={selectedClass}
        open={showEnrollments}
        onOpenChange={(open) => {
          setShowEnrollments(open);
          if (!open) setSelectedClass(null);
        }}
      />

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