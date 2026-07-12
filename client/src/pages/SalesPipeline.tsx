import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Calendar,
  Edit,
  Archive,
  Plus,
  UserPlus,
  MessageCircle,
  Clock,
  AlertTriangle,
  Target,
  PartyPopper,
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getModalityColor } from "@/lib/modality-colors";
import { positionAtIndex } from "@/lib/kanban";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColumnId =
  | "lead-inicial"
  | "aula-agendada"
  | "aula-realizada"
  | "negociacao"
  | "ganho"
  | "perdido";

/** Lead como vem da API (datas em ISO string) */
interface ApiLead {
  id: string;
  name: string;
  phone: string | null;
  classTypeId: string | null;
  stage: ColumnId;
  position: number;
  nextInteractionAt: string | null;
  stageChangedAt: string;
  lostReason: string | null;
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  classTypeId: string | null;
  columnId: ColumnId;
  position: number;
  nextInteraction: Date | null;
  movedAt: Date;
}

interface ClassType {
  id: string;
  name: string;
}

// ─── Column Config ─────────────────────────────────────────────────────────────

interface ColumnConfig {
  id: ColumnId;
  title: string;
  dotColor: string;
  emptyLabel: string;
  isTerminal?: boolean;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "lead-inicial",
    title: "Lead Inicial",
    dotColor: "bg-blue-500",
    emptyLabel: "Nenhum lead novo",
  },
  {
    id: "aula-agendada",
    title: "Aula Agendada",
    dotColor: "bg-violet-500",
    emptyLabel: "Nenhuma aula agendada",
  },
  {
    id: "aula-realizada",
    title: "Aula Realizada",
    dotColor: "bg-indigo-500",
    emptyLabel: "Nenhuma aula realizada",
  },
  {
    id: "negociacao",
    title: "Negociação",
    dotColor: "bg-amber-500",
    emptyLabel: "Nenhuma em negociação",
  },
  {
    id: "ganho",
    title: "Ganho ✓",
    dotColor: "bg-green-500",
    emptyLabel: "Nenhum ganho ainda",
    isTerminal: true,
  },
  {
    id: "perdido",
    title: "Perdido",
    dotColor: "bg-gray-400",
    emptyLabel: "Nenhum lead perdido",
    isTerminal: true,
  },
];

const LOST_REASONS = [
  "Preço",
  "Distância",
  "Horários incompatíveis",
  "Parou de responder",
  "Escolheu outra academia",
  "Outro",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLead(api: ApiLead): Lead {
  return {
    id: api.id,
    name: api.name,
    phone: api.phone,
    classTypeId: api.classTypeId,
    columnId: api.stage,
    position: api.position,
    nextInteraction: api.nextInteractionAt ? new Date(api.nextInteractionAt) : null,
    movedAt: new Date(api.stageChangedAt),
  };
}

function getStagnationLevel(movedAt: Date, isTerminal = false): 0 | 1 | 2 {
  if (isTerminal) return 0;
  const days = differenceInDays(new Date(), movedAt);
  if (days >= 7) return 2;
  if (days >= 3) return 1;
  return 0;
}

function formatInteractionLabel(date: Date): string {
  if (isPast(date)) {
    return `Atrasado — ${format(date, "dd/MM", { locale: ptBR })}`;
  }
  const days = differenceInDays(date, new Date());
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return format(date, "dd 'de' MMM", { locale: ptBR });
}

const tomorrowStr = () => format(new Date(Date.now() + 86_400_000), "yyyy-MM-dd");

// ─── Lead form dialog (add + edit compartilham o corpo) ───────────────────────

interface LeadFormValues {
  name: string;
  phone: string;
  classTypeId: string; // '' = Outra
  nextInteraction: string; // '' = sem data
}

function LeadFormFields({
  values,
  onChange,
  classTypes,
  onEnter,
}: {
  values: LeadFormValues;
  onChange: (v: LeadFormValues) => void;
  classTypes: ClassType[];
  onEnter?: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="lead-name">Nome *</Label>
        <Input
          id="lead-name"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          placeholder="Nome do lead"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-phone">WhatsApp</Label>
        <Input
          id="lead-phone"
          value={values.phone}
          onChange={(e) => onChange({ ...values, phone: e.target.value })}
          placeholder="(11) 99999-9999"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Modalidade de Interesse</Label>
        <Select
          value={values.classTypeId || "outra"}
          onValueChange={(v) => onChange({ ...values, classTypeId: v === "outra" ? "" : v })}
        >
          <SelectTrigger data-testid="lead-modality-select">
            {values.classTypeId
              ? classTypes.find(ct => ct.id === values.classTypeId)?.name ?? "Outra"
              : "Outra / não sabe ainda"}
          </SelectTrigger>
          <SelectContent>
            {classTypes.map((ct) => (
              <SelectItem key={ct.id} value={ct.id}>
                {ct.name}
              </SelectItem>
            ))}
            <SelectItem value="outra">Outra / não sabe ainda</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-date">Próxima Interação</Label>
        <Input
          id="lead-date"
          type="date"
          value={values.nextInteraction}
          onChange={(e) => onChange({ ...values, nextInteraction: e.target.value })}
        />
      </div>
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  lead: Lead;
  modalityName: string;
  isTerminal?: boolean;
  isDragOverlay?: boolean;
  onEdit: (lead: Lead) => void;
  onArchive: (id: string) => void;
}

function KanbanCard({
  lead,
  modalityName,
  isTerminal = false,
  isDragOverlay = false,
  onEdit,
  onArchive,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stagnation = getStagnationLevel(lead.movedAt, isTerminal);
  const interactionPast = !!lead.nextInteraction && isPast(lead.nextInteraction) && !isTerminal;
  const daysStuck = differenceInDays(new Date(), lead.movedAt);
  const modalityColor = getModalityColor(lead.classTypeId ?? "outra", modalityName);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`kanban-card-${lead.id}`}
      className={cn(
        "group relative bg-background rounded-lg border shadow-sm p-3",
        "touch-none select-none",
        "cursor-grab active:cursor-grabbing",
        "transition-shadow duration-150 hover:shadow-md",
        // consistent left border width to avoid layout shift
        "border-l-4",
        isDragging && "opacity-25 shadow-none",
        isDragOverlay && "shadow-2xl rotate-[1.5deg] cursor-grabbing scale-105",
        stagnation === 0 && "border-l-transparent",
        stagnation === 1 && "border-l-amber-400",
        stagnation === 2 && "border-l-destructive",
      )}
    >
      {/* Name + Dropdown */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="font-semibold text-sm leading-snug line-clamp-2 flex-1 pt-0.5">
          {lead.name}
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 shrink-0 -mt-0.5 -mr-1.5 transition-opacity",
                isDragOverlay
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-100 focus:opacity-100",
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              data-testid={`kanban-actions-${lead.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {lead.phone && (
              <DropdownMenuItem
                onClick={() =>
                  window.open(`https://wa.me/${lead.phone!.replace(/\D/g, "")}`, "_blank")
                }
              >
                <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                Chamar no WhatsApp
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(lead)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onArchive(lead.id)}
            >
              <Archive className="h-4 w-4 mr-2" />
              Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modality badge — cor da modalidade compartilhada com o resto do app */}
      <div className="mb-2">
        <Badge variant="outline" className="text-xs font-medium gap-1.5 px-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: modalityColor }}
            aria-hidden="true"
          />
          {modalityName}
        </Badge>
      </div>

      {/* Next interaction */}
      {lead.nextInteraction && (
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs",
            interactionPast
              ? "text-destructive font-medium"
              : "text-muted-foreground",
          )}
        >
          {interactionPast ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Calendar className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{formatInteractionLabel(lead.nextInteraction)}</span>
        </div>
      )}

      {/* Stagnation pill */}
      {stagnation > 0 && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            stagnation === 1
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
              : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
          )}
        >
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {daysStuck}d nesta etapa
            {stagnation === 2 ? " — Urgente!" : " — Esfriando"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: ColumnConfig;
  leads: Lead[];
  modalityNameOf: (lead: Lead) => string;
  onEdit: (lead: Lead) => void;
  onArchive: (id: string) => void;
}

function KanbanColumn({
  column,
  leads,
  modalityNameOf,
  onEdit,
  onArchive,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const leadIds = useMemo(() => leads.map((l) => l.id), [leads]);

  return (
    <div className="flex-shrink-0 w-72 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn("w-2 h-2 rounded-full shrink-0", column.dotColor)}
          />
          <h3 className="font-semibold text-sm tracking-tight">
            {column.title}
          </h3>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5 min-w-[24px] text-center tabular-nums">
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl p-3 min-h-[540px] flex flex-col gap-2",
          "transition-colors duration-200",
          isOver ? "bg-primary/8 ring-2 ring-primary/25" : "bg-muted/50",
        )}
        data-testid={`kanban-column-${column.id}`}
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              modalityName={modalityNameOf(lead)}
              isTerminal={column.isTerminal}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex-1 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground/60 text-center select-none">
              {column.emptyLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM: LeadFormValues = {
  name: "",
  phone: "",
  classTypeId: "",
  nextInteraction: "",
};

export default function SalesPipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  // ── Server state ────────────────────────────────────────────────────────────
  const { data: apiLeads, isLoading } = useQuery<ApiLead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ["/api/classes/class-types"],
  });

  const classTypeNameById = useMemo(
    () => new Map(classTypes.map((ct) => [ct.id, ct.name])),
    [classTypes],
  );
  const modalityNameOf = useCallback(
    (lead: Lead) =>
      lead.classTypeId
        ? classTypeNameById.get(lead.classTypeId) ?? "Outra"
        : "Outra",
    [classTypeNameById],
  );

  // ── Board local (espelho do servidor; o drag mexe aqui e persiste no fim) ──
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOriginColumn, setDragOriginColumn] = useState<ColumnId | null>(null);
  // Movimentos em voo: enquanto > 0, o cache do servidor está desatualizado em
  // relação ao board otimista — sincronizar reverteria o card para a coluna
  // antiga por um instante (flicker). O contador só zera depois do refetch.
  const [pendingMoves, setPendingMoves] = useState(0);

  useEffect(() => {
    // Não sobrescrever o board no meio de um arrasto nem com cache defasado
    if (activeId === null && pendingMoves === 0 && apiLeads) {
      setLeads(apiLeads.map(parseLead));
    }
  }, [apiLeads, activeId, pendingMoves]);

  // ── Dialogs ─────────────────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<LeadFormValues>({ ...EMPTY_FORM, nextInteraction: tomorrowStr() });
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<LeadFormValues>(EMPTY_FORM);
  const [wonLead, setWonLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState(LOST_REASONS[0]);

  useEffect(() => {
    if (editingLead) {
      setEditForm({
        name: editingLead.name,
        phone: editingLead.phone ?? "",
        classTypeId: editingLead.classTypeId ?? "",
        nextInteraction: editingLead.nextInteraction
          ? format(editingLead.nextInteraction, "yyyy-MM-dd")
          : "",
      });
    }
  }, [editingLead]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const invalidateLeads = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/leads"] });

  const formToPayload = (v: LeadFormValues) => ({
    name: v.name.trim(),
    phone: v.phone.trim() || null,
    classTypeId: v.classTypeId || null,
    nextInteractionAt: v.nextInteraction || null,
  });

  const createMutation = useMutation({
    mutationFn: (v: LeadFormValues) => {
      const p = formToPayload(v);
      return apiRequest("POST", "/api/leads", {
        name: p.name,
        phone: p.phone ?? undefined,
        classTypeId: p.classTypeId,
        nextInteractionAt: p.nextInteractionAt ?? undefined,
      }).then((r) => r.json());
    },
    onSuccess: (_, v) => {
      invalidateLeads();
      setIsAddOpen(false);
      setAddForm({ ...EMPTY_FORM, nextInteraction: tomorrowStr() });
      toast({ title: "Lead adicionado!", description: `${v.name.trim()} entrou no pipeline.` });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao adicionar lead", description: e.message }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, v }: { id: string; v: LeadFormValues }) =>
      apiRequest("PATCH", `/api/leads/${id}`, formToPayload(v)).then((r) => r.json()),
    onSuccess: () => {
      invalidateLeads();
      setEditingLead(null);
      toast({ title: "Lead atualizado com sucesso!" });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/leads/${id}`, { archived: true }).then((r) => r.json()),
    onSuccess: (_, id) => {
      const lead = leads.find((l) => l.id === id);
      invalidateLeads();
      toast({
        title: "Lead arquivado",
        description: `${lead?.name ?? "Lead"} saiu do pipeline.`,
      });
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Erro ao arquivar", description: e.message }),
  });

  // Drag é otimista: o board local já mudou; falha do servidor reverte via
  // refetch. O contador pendingMoves segura a ressincronização até o refetch
  // trazer dados frescos (await no invalidate → resolve após o refetch).
  const moveMutation = useMutation({
    mutationFn: ({ id, stage, position }: { id: string; stage: ColumnId; position: number }) =>
      apiRequest("PATCH", `/api/leads/${id}/move`, { stage, position }).then((r) => r.json()),
    // O incremento de pendingMoves acontece no handleDragEnd, NÃO em onMutate:
    // onMutate roda num microtask após o commit do React, e nesse frame o
    // efeito de sincronização reverteria o board com o cache velho.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    },
    onError: async (e: Error) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ variant: "destructive", title: "Não foi possível mover o lead", description: e.message });
    },
    onSettled: () => setPendingMoves((n) => n - 1),
  });

  const lostReasonMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("PATCH", `/api/leads/${id}`, { lostReason: reason }).then((r) => r.json()),
    onSuccess: () => invalidateLeads(),
  });

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeLead = useMemo(
    () => leads.find((l) => l.id === activeId) ?? null,
    [leads, activeId],
  );

  const leadsByColumn = useMemo(() => {
    const map: Record<ColumnId, Lead[]> = {
      "lead-inicial": [],
      "aula-agendada": [],
      "aula-realizada": [],
      negociacao: [],
      ganho: [],
      perdido: [],
    };
    for (const lead of leads) map[lead.columnId].push(lead);
    return map;
  }, [leads]);

  // ── DnD handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const id = active.id as string;
    setActiveId(id);
    setDragOriginColumn(leads.find((l) => l.id === id)?.columnId ?? null);
  }, [leads]);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeCardId = active.id as string;
    const overId = over.id as string;
    if (activeCardId === overId) return;

    setLeads((prev) => {
      const activeCard = prev.find((l) => l.id === activeCardId);
      if (!activeCard) return prev;

      const isOverColumn = COLUMNS.some((c) => c.id === overId);
      const targetColumnId = isOverColumn
        ? (overId as ColumnId)
        : prev.find((l) => l.id === overId)?.columnId;

      if (!targetColumnId || targetColumnId === activeCard.columnId) return prev;

      return prev.map((l) =>
        l.id === activeCardId
          ? { ...l, columnId: targetColumnId, movedAt: new Date() }
          : l,
      );
    });
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      const originColumn = dragOriginColumn;
      setDragOriginColumn(null);

      const activeCardId = active.id as string;
      const overId = over?.id as string | undefined;

      // Computa fora do setState: efeitos colaterais (mutação, dialogs) não
      // podem viver dentro de um updater — StrictMode os dispararia em dobro.
      const prev = leads;
      const activeCard = prev.find((l) => l.id === activeCardId);
      if (!activeCard) return;

      // Ordem final da coluna de destino (com reordenação se soltou sobre um card)
      let next = prev;
      const overCard = overId ? prev.find((l) => l.id === overId) : undefined;
      if (overCard && overCard.id !== activeCardId && overCard.columnId === activeCard.columnId) {
        const col = activeCard.columnId;
        const colLeads = prev.filter((l) => l.columnId === col);
        const rest = prev.filter((l) => l.columnId !== col);
        const oldIdx = colLeads.findIndex((l) => l.id === activeCardId);
        const newIdx = colLeads.findIndex((l) => l.id === overId);
        next = [...rest, ...arrayMove(colLeads, oldIdx, newIdx)];
      }

      // Persistir: posição = vizinhos na ordem final da coluna
      const finalCard = next.find((l) => l.id === activeCardId)!;
      const columnCards = next.filter((l) => l.columnId === finalCard.columnId);
      const idx = columnCards.findIndex((l) => l.id === activeCardId);
      const position = positionAtIndex(columnCards.map((l) => l.position), idx);
      const stageChanged = originColumn !== null && finalCard.columnId !== originColumn;

      setLeads(next.map((l) => (l.id === activeCardId ? { ...l, position } : l)));

      if (stageChanged || overCard) {
        // Síncrono e no mesmo batch do setLeads: o commit que aplica o board
        // otimista já sai com pendingMoves > 0, sem janela para o revert
        setPendingMoves((n) => n + 1);
        moveMutation.mutate({ id: activeCardId, stage: finalCard.columnId, position });
      }

      // Fecho de ciclo: ganho oferece cadastro; perdido pergunta o motivo
      if (stageChanged && finalCard.columnId === "ganho") setWonLead(finalCard);
      if (stageChanged && finalCard.columnId === "perdido") {
        setLostReason(LOST_REASONS[0]);
        setLostLead(finalCard);
      }
    },
    [leads, dragOriginColumn, moveMutation],
  );

  // ── Ganho → aluno ───────────────────────────────────────────────────────────
  const handleConvertToStudent = useCallback(() => {
    if (!wonLead) return;
    const params = new URLSearchParams({ novoAluno: "1", nome: wonLead.name });
    if (wonLead.phone) params.set("telefone", wonLead.phone);
    if (wonLead.classTypeId) params.set("leadModalidade", wonLead.classTypeId);
    setWonLead(null);
    navigate(`/dashboard/alunos?${params.toString()}`);
  }, [wonLead, navigate]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalLeads = leads.length;
  const wonLeads = leadsByColumn["ganho"].length;
  const stalledLeads = leads.filter(
    (l) => !COLUMNS.find((c) => c.id === l.columnId)?.isTerminal &&
      differenceInDays(new Date(), l.movedAt) >= 3,
  ).length;
  const conversionRate =
    totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start sm:items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Target className="h-7 w-7 text-primary hidden sm:block" />
            Pipeline de Vendas
          </h1>
          <p className="text-muted-foreground text-sm mt-1 hidden sm:block">
            Arraste os cards para mover leads entre as etapas do funil
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground tabular-nums">{totalLeads}</strong>{" "}
              leads
            </span>
            <span>
              <strong className="text-green-600 tabular-nums">{wonLeads}</strong>{" "}
              ganhos
            </span>
            <span>
              <strong className="text-foreground tabular-nums">
                {conversionRate}%
              </strong>{" "}
              conversão
            </span>
            {stalledLeads > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="h-3.5 w-3.5" />
                {stalledLeads} esfriando
              </span>
            )}
          </div>

          <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-lead">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-l-4 border-l-amber-400 bg-muted" />
          +3 dias na etapa
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-l-4 border-l-destructive bg-muted" />
          +7 dias — urgente
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          Interação atrasada
        </div>
      </div>

      {/* Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {COLUMNS.map((c) => (
            <div key={c.id} className="flex-shrink-0 w-72 h-[540px] rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto -mx-4 px-4 md:-mx-8 md:px-8 pb-6 flex-1">
            <div className="flex gap-4 min-w-max h-full">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  leads={leadsByColumn[column.id]}
                  modalityNameOf={modalityNameOf}
                  onEdit={setEditingLead}
                  onArchive={(id) => archiveMutation.mutate(id)}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead ? (
              <KanbanCard
                lead={activeLead}
                modalityName={modalityNameOf(activeLead)}
                isTerminal={
                  COLUMNS.find((c) => c.id === activeLead.columnId)?.isTerminal
                }
                isDragOverlay
                onEdit={() => {}}
                onArchive={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Novo lead ── */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(o) => {
          setIsAddOpen(o);
          if (!o) setAddForm({ ...EMPTY_FORM, nextInteraction: tomorrowStr() });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <LeadFormFields
            values={addForm}
            onChange={setAddForm}
            classTypes={classTypes}
            onEnter={() => addForm.name.trim() && createMutation.mutate(addForm)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(addForm)}
              disabled={!addForm.name.trim() || createMutation.isPending}
              data-testid="button-save-lead"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Editar lead ── */}
      <Dialog open={!!editingLead} onOpenChange={(o) => !o && setEditingLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          <LeadFormFields
            values={editForm}
            onChange={setEditForm}
            classTypes={classTypes}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLead(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => editingLead && editMutation.mutate({ id: editingLead.id, v: editForm })}
              disabled={!editForm.name.trim() || editMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ganho → cadastrar como aluno ── */}
      <Dialog open={!!wonLead} onOpenChange={(o) => !o && setWonLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-green-600" />
              Lead ganho!
            </DialogTitle>
            <DialogDescription>
              {wonLead?.name} fechou com a academia. Quer já cadastrar como aluno?
              O cadastro abre preenchido com nome, telefone e modalidade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWonLead(null)}>
              Agora não
            </Button>
            <Button onClick={handleConvertToStudent} data-testid="button-convert-lead">
              <UserPlus className="h-4 w-4 mr-2" />
              Cadastrar como Aluno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Perdido → motivo ── */}
      <Dialog open={!!lostLead} onOpenChange={(o) => !o && setLostLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Por que perdemos {lostLead?.name}?</DialogTitle>
            <DialogDescription>
              O motivo alimenta as estatísticas do funil — leva um clique e ajuda
              a descobrir onde os leads escapam.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={lostReason} onValueChange={setLostReason}>
              <SelectTrigger data-testid="lost-reason-select">{lostReason}</SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostLead(null)}>
              Pular
            </Button>
            <Button
              onClick={() => {
                if (lostLead) lostReasonMutation.mutate({ id: lostLead.id, reason: lostReason });
                setLostLead(null);
              }}
              data-testid="button-save-lost-reason"
            >
              Salvar motivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

