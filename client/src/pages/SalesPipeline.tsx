import { useState, useMemo, useCallback, useEffect } from "react";
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
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColumnId =
  | "lead-inicial"
  | "aula-agendada"
  | "aula-realizada"
  | "negociacao"
  | "ganho"
  | "perdido";

interface Lead {
  id: string;
  name: string;
  modality: string;
  phone: string;
  nextInteraction: Date;
  columnId: ColumnId;
  movedAt: Date;
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

const MODALITIES = [
  "BJJ",
  "Muay Thai",
  "Boxe",
  "Judo",
  "MMA",
  "Karatê",
  "Wrestling",
  "Outra",
];

const MODALITY_BADGE_STYLE: Record<string, string> = {
  BJJ: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "Muay Thai": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Boxe: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  Judo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  MMA: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Karatê: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Wrestling: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  Outra: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
const from = (days: number) => new Date(Date.now() + days * 86_400_000);

const INITIAL_LEADS: Lead[] = [
  {
    id: "1",
    name: "Pedro Alves",
    modality: "BJJ",
    phone: "5511991234567",
    nextInteraction: from(2),
    columnId: "lead-inicial",
    movedAt: ago(5),
  },
  {
    id: "2",
    name: "Ana Carolina Silva",
    modality: "Muay Thai",
    phone: "5511992345678",
    nextInteraction: from(1),
    columnId: "lead-inicial",
    movedAt: ago(1),
  },
  {
    id: "3",
    name: "Lucas Mendes",
    modality: "MMA",
    phone: "5511993456789",
    nextInteraction: from(3),
    columnId: "aula-agendada",
    movedAt: ago(2),
  },
  {
    id: "4",
    name: "Beatriz Costa",
    modality: "Boxe",
    phone: "5511994567890",
    nextInteraction: ago(1),
    columnId: "aula-agendada",
    movedAt: ago(4),
  },
  {
    id: "5",
    name: "Rafael Gomes",
    modality: "BJJ",
    phone: "5511995678901",
    nextInteraction: from(1),
    columnId: "aula-realizada",
    movedAt: ago(1),
  },
  {
    id: "6",
    name: "Camila Ferreira",
    modality: "Muay Thai",
    phone: "5511996789012",
    nextInteraction: from(1),
    columnId: "negociacao",
    movedAt: ago(7),
  },
  {
    id: "7",
    name: "Thiago Oliveira",
    modality: "Judo",
    phone: "5511997890123",
    nextInteraction: from(5),
    columnId: "negociacao",
    movedAt: ago(2),
  },
  {
    id: "8",
    name: "Mariana Souza",
    modality: "BJJ",
    phone: "5511998901234",
    nextInteraction: from(30),
    columnId: "ganho",
    movedAt: ago(1),
  },
  {
    id: "9",
    name: "Fernando Lima",
    modality: "Boxe",
    phone: "5511999012345",
    nextInteraction: ago(5),
    columnId: "perdido",
    movedAt: ago(10),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Add Lead Dialog ──────────────────────────────────────────────────────────

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: Omit<Lead, "id" | "columnId" | "movedAt">) => void;
}

function AddLeadDialog({ open, onOpenChange, onAdd }: AddLeadDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [modality, setModality] = useState("BJJ");
  const [nextInteraction, setNextInteraction] = useState(
    format(from(1), "yyyy-MM-dd"),
  );

  const reset = () => {
    setName("");
    setPhone("");
    setModality("BJJ");
    setNextInteraction(format(from(1), "yyyy-MM-dd"));
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      phone: phone.trim(),
      modality,
      nextInteraction: new Date(`${nextInteraction}T12:00:00`),
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Nome *</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do lead"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-phone">WhatsApp</Label>
            <Input
              id="add-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Modalidade de Interesse</Label>
            <Select value={modality} onValueChange={setModality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALITIES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-date">Próxima Interação</Label>
            <Input
              id="add-date"
              type="date"
              value={nextInteraction}
              onChange={(e) => setNextInteraction(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Lead Dialog ─────────────────────────────────────────────────────────

interface EditLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Lead>) => void;
}

function EditLeadDialog({
  lead,
  open,
  onOpenChange,
  onSave,
}: EditLeadDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [modality, setModality] = useState("BJJ");
  const [nextInteraction, setNextInteraction] = useState("");

  useEffect(() => {
    if (lead && open) {
      setName(lead.name);
      setPhone(lead.phone);
      setModality(lead.modality);
      setNextInteraction(format(lead.nextInteraction, "yyyy-MM-dd"));
    }
  }, [lead, open]);

  const handleSave = () => {
    if (!lead || !name.trim()) return;
    onSave(lead.id, {
      name: name.trim(),
      phone: phone.trim(),
      modality,
      nextInteraction: new Date(`${nextInteraction}T12:00:00`),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nome *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do lead"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">WhatsApp</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Modalidade de Interesse</Label>
            <Select value={modality} onValueChange={setModality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALITIES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Próxima Interação</Label>
            <Input
              id="edit-date"
              type="date"
              value={nextInteraction}
              onChange={(e) => setNextInteraction(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  lead: Lead;
  isTerminal?: boolean;
  isDragOverlay?: boolean;
  onEdit: (lead: Lead) => void;
  onArchive: (id: string) => void;
}

function KanbanCard({
  lead,
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
  const interactionPast = isPast(lead.nextInteraction);
  const interactionLabel = formatInteractionLabel(lead.nextInteraction);
  const daysStuck = differenceInDays(new Date(), lead.movedAt);
  const badgeStyle =
    MODALITY_BADGE_STYLE[lead.modality] ?? MODALITY_BADGE_STYLE["Outra"];

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
            <DropdownMenuItem
              onClick={() =>
                window.open(`https://wa.me/${lead.phone}`, "_blank")
              }
            >
              <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
              Chamar no WhatsApp
            </DropdownMenuItem>
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

      {/* Modality badge */}
      <div className="mb-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            badgeStyle,
          )}
        >
          {lead.modality}
        </span>
      </div>

      {/* Next interaction */}
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
        <span>{interactionLabel}</span>
      </div>

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
  onEdit: (lead: Lead) => void;
  onArchive: (id: string) => void;
}

function KanbanColumn({
  column,
  leads,
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

export default function SalesPipeline() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

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
    setActiveId(active.id as string);
  }, []);

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
      if (!over || active.id === over.id) return;

      const activeCardId = active.id as string;
      const overId = over.id as string;

      setLeads((prev) => {
        const activeCard = prev.find((l) => l.id === activeCardId);
        const overCard = prev.find((l) => l.id === overId);

        // Reorder within same column
        if (
          activeCard &&
          overCard &&
          activeCard.columnId === overCard.columnId
        ) {
          const col = activeCard.columnId;
          const colLeads = prev.filter((l) => l.columnId === col);
          const rest = prev.filter((l) => l.columnId !== col);
          const oldIdx = colLeads.findIndex((l) => l.id === activeCardId);
          const newIdx = colLeads.findIndex((l) => l.id === overId);
          return [...rest, ...arrayMove(colLeads, oldIdx, newIdx)];
        }

        return prev;
      });
    },
    [],
  );

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const handleAddLead = useCallback(
    (data: Omit<Lead, "id" | "columnId" | "movedAt">) => {
      const newLead: Lead = {
        ...data,
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        columnId: "lead-inicial",
        movedAt: new Date(),
      };
      setLeads((prev) => [newLead, ...prev]);
      toast({
        title: "Lead adicionado!",
        description: `${data.name} entrou no pipeline.`,
      });
    },
    [toast],
  );

  const handleSaveEdit = useCallback(
    (id: string, updates: Partial<Lead>) => {
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      );
      toast({ title: "Lead atualizado com sucesso!" });
    },
    [toast],
  );

  const handleArchive = useCallback(
    (id: string) => {
      const lead = leads.find((l) => l.id === id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast({
        title: "Lead arquivado",
        description: `${lead?.name ?? "Lead"} foi removido do pipeline.`,
      });
    },
    [leads, toast],
  );

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

          <Button onClick={() => setIsAddOpen(true)}>
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
                onEdit={setEditingLead}
                onArchive={handleArchive}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <KanbanCard
              lead={activeLead}
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

      {/* Dialogs */}
      <AddLeadDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAdd={handleAddLead}
      />
      <EditLeadDialog
        lead={editingLead}
        open={!!editingLead}
        onOpenChange={(open) => !open && setEditingLead(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
