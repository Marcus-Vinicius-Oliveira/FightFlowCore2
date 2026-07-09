import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings2, Plus, Pencil, Trash2, MoreHorizontal, Award, CheckCircle2, X, Users, LayoutDashboard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BeltBar, isLightHex } from "@/components/BeltBadge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ─── Graduation Templates ─────────────────────────────────────────────────────

interface RankTemplate {
  name: string;
  displayOrder: number;
  colorClass: string;
}

interface GraduationTemplate {
  id: string;
  sport: string;
  keywords: string[];
  name: string;
  description: string;
  ranks: RankTemplate[];
}

const GRADUATION_TEMPLATES: GraduationTemplate[] = [
  {
    id: 'muay-thai-brasil',
    sport: 'Muay Thai',
    keywords: ['muay thai', 'muaythai', 'thai'],
    name: 'Sistema Brasileiro (Corda / Prajied)',
    description: 'Cordões trançados no braço — padrão CMTB Brasil',
    ranks: [
      { name: 'Branco',                    displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Branco ponta Vermelha',      displayOrder: 1,  colorClass: '#f9fafb|#dc2626' },
      { name: 'Vermelho',                   displayOrder: 2,  colorClass: '#dc2626' },
      { name: 'Vermelho ponta Azul Clara',  displayOrder: 3,  colorClass: '#dc2626|#60a5fa' },
      { name: 'Azul Claro',                 displayOrder: 4,  colorClass: '#60a5fa' },
      { name: 'Azul Claro ponta Azul Esc.', displayOrder: 5,  colorClass: '#60a5fa|#1d4ed8' },
      { name: 'Azul Escura',               displayOrder: 6,  colorClass: '#1d4ed8' },
      { name: 'Azul Escura ponta Preta',   displayOrder: 7,  colorClass: '#1d4ed8|#111827' },
      { name: 'Preto',                      displayOrder: 8,  colorClass: '#111827' },
      { name: 'Preto ponta Branca',         displayOrder: 9,  colorClass: '#111827|#f9fafb' },
      { name: 'Preto, Branco e Vermelho',   displayOrder: 10, colorClass: '#111827|#dc2626' },
    ],
  },
  {
    id: 'muay-thai-tradicional',
    sport: 'Muay Thai',
    keywords: ['muay thai', 'muaythai', 'thai'],
    name: 'Sistema Tradicional (Khans / Cruang)',
    description: 'Reconhecido pela IFMA — 10 níveis Khan',
    ranks: [
      { name: 'Khan 1 — Branco',           displayOrder: 0, colorClass: '#f9fafb' },
      { name: 'Khan 2 — Amarelo',          displayOrder: 1, colorClass: '#facc15' },
      { name: 'Khan 3 — Amarelo e Branco', displayOrder: 2, colorClass: '#facc15|#f9fafb' },
      { name: 'Khan 4 — Verde',            displayOrder: 3, colorClass: '#15803d' },
      { name: 'Khan 5 — Verde e Branco',   displayOrder: 4, colorClass: '#15803d|#f9fafb' },
      { name: 'Khan 6 — Azul',             displayOrder: 5, colorClass: '#2563eb' },
      { name: 'Khan 7 — Azul e Branco',    displayOrder: 6, colorClass: '#2563eb|#f9fafb' },
      { name: 'Khan 8 — Marrom',           displayOrder: 7, colorClass: '#92400e' },
      { name: 'Khan 9 — Marrom e Branco',  displayOrder: 8, colorClass: '#92400e|#f9fafb' },
      { name: 'Khan 10 — Vermelho',        displayOrder: 9, colorClass: '#dc2626' },
    ],
  },
  {
    id: 'bjj',
    sport: 'Jiu-Jitsu Brasileiro',
    keywords: ['bjj', 'jiu-jitsu', 'jiu jitsu', 'jiujitsu', 'jj', 'brazilian jiu'],
    name: 'Sistema BJJ (CBJJ/IBJJF)',
    description: 'Todas as faixas — infanto-juvenil e adulto — padrão CBJJ/IBJJF',
    ranks: [
      { name: 'Branca',              displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Cinza e Branca',      displayOrder: 1,  colorClass: '#6b7280|#f9fafb' },
      { name: 'Cinza',               displayOrder: 2,  colorClass: '#6b7280' },
      { name: 'Cinza e Preta',       displayOrder: 3,  colorClass: '#6b7280|#111827' },
      { name: 'Amarela e Branca',    displayOrder: 4,  colorClass: '#facc15|#f9fafb' },
      { name: 'Amarela',             displayOrder: 5,  colorClass: '#facc15' },
      { name: 'Amarela e Preta',     displayOrder: 6,  colorClass: '#facc15|#111827' },
      { name: 'Laranja e Branca',    displayOrder: 7,  colorClass: '#f97316|#f9fafb' },
      { name: 'Laranja',             displayOrder: 8,  colorClass: '#f97316' },
      { name: 'Laranja e Preta',     displayOrder: 9,  colorClass: '#f97316|#111827' },
      { name: 'Verde e Branca',      displayOrder: 10, colorClass: '#15803d|#f9fafb' },
      { name: 'Verde',               displayOrder: 11, colorClass: '#15803d' },
      { name: 'Verde e Preta',       displayOrder: 12, colorClass: '#15803d|#111827' },
      { name: 'Azul',                displayOrder: 13, colorClass: '#2563eb' },
      { name: 'Roxa',                displayOrder: 14, colorClass: '#7c3aed' },
      { name: 'Marrom',              displayOrder: 15, colorClass: '#92400e' },
      { name: 'Preta',               displayOrder: 16, colorClass: '#111827' },
      { name: 'Coral',               displayOrder: 17, colorClass: '#dc2626|#111827' },
      { name: 'Vermelha',            displayOrder: 18, colorClass: '#dc2626' },
    ],
  },
  {
    id: 'judo',
    sport: 'Judô',
    keywords: ['judô', 'judo'],
    name: 'Sistema Judô (CBJ)',
    description: 'Graduação brasileira oficial — Branca a Vermelha (12 faixas)',
    ranks: [
      { name: 'Branca',     displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Cinza',      displayOrder: 1,  colorClass: '#6b7280' },
      { name: 'Azul Claro', displayOrder: 2,  colorClass: '#60a5fa' },
      { name: 'Azul Escuro',displayOrder: 3,  colorClass: '#1e40af' },
      { name: 'Amarela',    displayOrder: 4,  colorClass: '#facc15' },
      { name: 'Laranja',    displayOrder: 5,  colorClass: '#f97316' },
      { name: 'Verde',      displayOrder: 6,  colorClass: '#15803d' },
      { name: 'Roxa',       displayOrder: 7,  colorClass: '#7c3aed' },
      { name: 'Marrom',     displayOrder: 8,  colorClass: '#92400e' },
      { name: 'Preta',      displayOrder: 9,  colorClass: '#111827' },
      { name: 'Coral',      displayOrder: 10, colorClass: '#dc2626|#111827' },
      { name: 'Vermelha',   displayOrder: 11, colorClass: '#dc2626' },
    ],
  },
  {
    id: 'karate',
    sport: 'Karatê',
    keywords: ['karatê', 'karate', 'karatê'],
    name: 'Sistema Karatê (WKF)',
    description: 'Kyus e Dans — padrão WKF',
    ranks: [
      { name: '9º Kyu — Branca',   displayOrder: 0, colorClass: '#f9fafb' },
      { name: '8º Kyu — Amarela',  displayOrder: 1, colorClass: '#facc15' },
      { name: '7º Kyu — Laranja',  displayOrder: 2, colorClass: '#f97316' },
      { name: '6º Kyu — Verde',    displayOrder: 3, colorClass: '#15803d' },
      { name: '5º Kyu — Azul',     displayOrder: 4, colorClass: '#2563eb' },
      { name: '4º Kyu — Roxa',     displayOrder: 5, colorClass: '#7c3aed' },
      { name: '3º Kyu — Marrom',   displayOrder: 6, colorClass: '#92400e' },
      { name: '2º Kyu — Marrom',   displayOrder: 7, colorClass: '#92400e' },
      { name: '1º Kyu — Marrom',   displayOrder: 8, colorClass: '#92400e' },
      { name: '1º Dan — Preta',    displayOrder: 9, colorClass: '#111827' },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraduationRank {
  id: string;
  systemId: string;
  name: string;
  displayOrder: number;
  colorClass: string;
}

interface GraduationSystem {
  id: string;
  academyId: string;
  classTypeId: string | null;
  name: string;
  ranks: GraduationRank[];
  classType?: { id: string; name: string } | null;
}

interface ClassType {
  id: string;
  name: string;
  duration: number;
  maxCapacity: number | null;
  active: boolean;
}

// ─── Colour presets ───────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: 'Branca',   hex: '#f9fafb' },
  { label: 'Cinza',    hex: '#6b7280' },
  { label: 'Amarela',  hex: '#facc15' },
  { label: 'Laranja',  hex: '#f97316' },
  { label: 'Verde',    hex: '#15803d' },
  { label: 'Azul',     hex: '#2563eb' },
  { label: 'Roxa',     hex: '#7c3aed' },
  { label: 'Marrom',   hex: '#92400e' },
  { label: 'Preta',    hex: '#111827' },
  { label: 'Vermelha', hex: '#dc2626' },
  { label: 'Coral',    hex: '#f43f5e' },
];

// ─── RankBadge ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: Pick<GraduationRank, 'name' | 'colorClass'> }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <BeltBar color={rank.colorClass} name={rank.name} width={44} height={12} />
      <span className="text-xs font-medium truncate">{rank.name}</span>
    </span>
  );
}

// ─── Rank Form (inside system panel) ─────────────────────────────────────────

interface RankFormProps {
  systemId: string;
  rank?: GraduationRank;
  nextOrder: number;
  onClose: () => void;
}

function RankForm({ systemId, rank, nextOrder, onClose }: RankFormProps) {
  const [name, setName] = useState(rank?.name ?? '');
  const [displayOrder, setDisplayOrder] = useState(rank?.displayOrder ?? nextOrder);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse existing colorClass (may be "hex1" or "hex1|hex2")
  const existingParts = rank?.colorClass?.split('|') ?? [];
  const [color1, setColor1] = useState(existingParts[0] ?? COLOR_PRESETS[5].hex); // default azul
  const [color2, setColor2] = useState(existingParts[1] ?? '');
  const [bicolor, setBicolor] = useState(!!existingParts[1]);

  const colorClass = bicolor && color2 ? `${color1}|${color2}` : color1;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name, colorClass, displayOrder };
      const res = rank
        ? await apiRequest('PATCH', `/api/graduation/ranks/${rank.id}`, payload)
        : await apiRequest('POST', `/api/graduation/systems/${systemId}/ranks`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/systems'] });
      toast({ title: rank ? 'Graduação atualizada' : 'Graduação criada' });
      onClose();
    },
    onError: () => toast({ title: 'Erro ao salvar graduação', variant: 'destructive' }),
  });

  function ColorPicker({ selected, onSelect }: { selected: string; onSelect: (hex: string) => void }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map(p => (
          <button
            key={p.hex}
            type="button"
            title={p.label}
            onClick={() => onSelect(p.hex)}
            style={{
              backgroundColor: p.hex,
              width: 28,
              height: 18,
              border: selected === p.hex
                ? '2px solid hsl(var(--primary))'
                : isLightHex(p.hex) ? '1px solid #d1d5db' : '2px solid transparent',
              boxShadow: selected === p.hex ? '0 0 0 2px hsl(var(--primary) / 0.3)' : undefined,
            }}
            className="rounded-sm transition-all hover:scale-110"
          />
        ))}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveMutation.mutate(); }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Nome da graduação</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Faixa Branca, 1º Grau..." />
      </div>

      <div className="space-y-2">
        <Label>Ordem de exibição</Label>
        <Input type="number" min={0} value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Cor{bicolor ? ' primária' : ''}</Label>
          <button
            type="button"
            onClick={() => { setBicolor(b => !b); if (bicolor) setColor2(''); }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors ${bicolor ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/80' : 'border-border text-muted-foreground hover:border-muted-foreground'}`}
          >
            {bicolor ? '× Somente 1 cor' : '+ Bicolor'}
          </button>
        </div>
        <ColorPicker selected={color1} onSelect={setColor1} />

        {bicolor && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cor secundária</Label>
            <ColorPicker selected={color2} onSelect={setColor2} />
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Prévia:
          <BeltBar color={colorClass} name={name || 'Exemplo'} width={52} height={14} />
          <span className="italic">{name || 'Exemplo'}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={!name.trim() || saveMutation.isPending}>
          {saveMutation.isPending ? 'Salvando...' : rank ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}

// ─── System Panel ─────────────────────────────────────────────────────────────

interface SystemPanelProps {
  system: GraduationSystem;
  classTypeName: string;
  onDeleteSystem: (sys: GraduationSystem) => void;
}

function SystemPanel({ system, classTypeName, onDeleteSystem }: SystemPanelProps) {
  const [rankDialog, setRankDialog] = useState<{ open: boolean; rank?: GraduationRank }>({ open: false });
  const [deleteRank, setDeleteRank] = useState<GraduationRank | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteRankMutation = useMutation({
    mutationFn: (rankId: string) => apiRequest('DELETE', `/api/graduation/ranks/${rankId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/systems'] });
      toast({ title: 'Graduação removida' });
      setDeleteRank(undefined);
    },
    onError: () => toast({ title: 'Erro ao remover graduação', variant: 'destructive' }),
  });

  const nextOrder = system.ranks.length > 0
    ? Math.max(...system.ranks.map(r => r.displayOrder)) + 1
    : 0;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-yellow-500" />
            {system.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRankDialog({ open: true })}>
            <Plus className="h-3 w-3 mr-1" />
            Graduação
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDeleteSystem(system)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {system.ranks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhuma graduação cadastrada. Clique em "+ Graduação" para adicionar.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {[...system.ranks].sort((a, b) => a.displayOrder - b.displayOrder).map(rank => (
            <div key={rank.id} className="group flex items-center gap-1">
              <RankBadge rank={rank} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" title="Opções" className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm">
                  <DropdownMenuItem onClick={() => setRankDialog({ open: true, rank })}>
                    <Pencil className="h-3 w-3 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteRank(rank)}>
                    <Trash2 className="h-3 w-3 mr-2" />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Rank Create/Edit Dialog */}
      <Dialog open={rankDialog.open} onOpenChange={open => !open && setRankDialog({ open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{rankDialog.rank ? 'Editar Graduação' : 'Nova Graduação'}</DialogTitle>
            <DialogDescription>Sistema: {system.name}</DialogDescription>
          </DialogHeader>
          <RankForm
            systemId={system.id}
            rank={rankDialog.rank}
            nextOrder={nextOrder}
            onClose={() => setRankDialog({ open: false })}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Rank Confirmation */}
      <AlertDialog open={!!deleteRank} onOpenChange={open => !open && setDeleteRank(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Graduação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a graduação <strong>{deleteRank?.name}</strong>?
              Alunos com essa graduação não serão afetados retroativamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRank && deleteRankMutation.mutate(deleteRank.id)}
              disabled={deleteRankMutation.isPending}
            >
              {deleteRankMutation.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Common sports for quick-add ─────────────────────────────────────────────

const COMMON_SPORTS = [
  'Muay Thai', 'BJJ', 'Judô', 'Karatê', 'Boxe',
  'Kickboxing', 'MMA', 'Taekwondo', 'Luta Olímpica',
];

// ─── Modalidades Tab ──────────────────────────────────────────────────────────

function ModalidadesTab() {
  const [addModalityDialog, setAddModalityDialog] = useState(false);
  const [customModalityName, setCustomModalityName] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemClassTypeId, setNewSystemClassTypeId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<GraduationTemplate | null>(null);
  const [deleteSystem, setDeleteSystem] = useState<GraduationSystem | undefined>();
  const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<{ system: GraduationSystem; count: number; message: string } | undefined>();
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types'],
  });

  const { data: systems = [], isLoading } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
  });

  function closeCreateDialog() {
    setCreateDialog(false);
    setNewSystemName('');
    setNewSystemClassTypeId('');
    setSelectedTemplate(null);
    setSubmitAttempted(false);
  }

  const selectedClassType = classTypes.find(ct => ct.id === newSystemClassTypeId);

  const matchingTemplates = selectedClassType
    ? GRADUATION_TEMPLATES.filter(t => {
        const ctName = selectedClassType.name.toLowerCase().trim();
        const sport = t.sport.toLowerCase();
        const keywords = t.keywords.map(k => k.toLowerCase());
        return ctName === sport ||
               ctName.includes(sport.split(' ')[0]) ||
               sport.includes(ctName.split(' ')[0]) ||
               keywords.some(k => ctName === k || ctName.includes(k) || k.includes(ctName));
      })
    : [];


  // Auto-select the first template when exactly one matches, and fill system name
  useEffect(() => {
    if (matchingTemplates.length === 1 && !selectedTemplate) {
      setSelectedTemplate(matchingTemplates[0]);
      setNewSystemName(matchingTemplates[0].name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingTemplates.length, newSystemClassTypeId]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/graduation/systems', {
        name: newSystemName,
        classTypeId: newSystemClassTypeId || null,
      }).then(r => r.json()),
    onSuccess: async (createdSystem) => {
      if (selectedTemplate) {
        try {
          await Promise.all(
            selectedTemplate.ranks.map(rank =>
              apiRequest('POST', `/api/graduation/systems/${createdSystem.id}/ranks`, rank).then(r => r.json())
            )
          );
        } catch {
          toast({ title: 'Sistema criado, mas houve erro ao importar graduações.', variant: 'destructive' });
          queryClient.invalidateQueries({ queryKey: ['/api/graduation/systems'] });
          closeCreateDialog();
          return;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/systems'] });
      toast({
        title: selectedTemplate
          ? `Sistema criado com ${selectedTemplate.ranks.length} graduações!`
          : 'Sistema de graduação criado!',
      });
      closeCreateDialog();
      setTimeout(() => {
        const el = document.getElementById(`system-${createdSystem.id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow 0.4s';
        el.style.boxShadow = '0 0 0 2px hsl(var(--primary))';
        setTimeout(() => {
          el.style.boxShadow = '';
          setTimeout(() => { el.style.transition = ''; }, 400);
        }, 2000);
      }, 300);
    },
    onError: (err: any) => toast({ title: err.message || 'Erro ao criar sistema', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (system: GraduationSystem) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/graduation/systems/${system.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = Object.assign(new Error(body.message || 'Erro ao remover sistema'), { status: res.status, body });
        throw err;
      }
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/graduation/systems'] });
      toast({ title: 'Sistema removido com sucesso' });
      setDeleteSystem(undefined);
    },
    onError: (err: any, system: GraduationSystem) => {
      setDeleteSystem(undefined);
      // Auth / not found → toast genérico
      if (err.status === 401 || err.status === 403 || err.status === 404) {
        toast({ title: err.message || 'Erro ao remover sistema', variant: 'destructive' });
        return;
      }
      // 409 (alunos vinculados) ou 500 (FK constraint = mesma causa) → diálogo informativo
      const count: number = err.body?.count ?? 0;
      const message: string = err.body?.message ||
        'Este sistema possui alunos com graduações ativas e não pode ser removido. Transfira ou cancele as graduações antes de excluir.';
      setDeleteBlockedInfo({ system, count, message });
    },
  });

  const createClassTypeMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest('POST', '/api/classes/class-types', { name, duration: 60, active: true }).then(r => r.json()),
    onSuccess: (ct) => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes/class-types'] });
      toast({ title: `Modalidade "${ct.name}" adicionada!` });
    },
    onError: () => toast({ title: 'Erro ao adicionar modalidade', variant: 'destructive' }),
  });

  const removeModalityMutation = useMutation({
    mutationFn: (ct: ClassType) =>
      apiRequest('PATCH', `/api/classes/class-types/${ct.id}`, { active: false }).then(r => r.json()),
    onSuccess: (_data, ct) => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes/class-types'] });
      toast({ title: `Modalidade "${ct.name}" removida.` });
    },
    onError: () => toast({ title: 'Erro ao remover modalidade', variant: 'destructive' }),
  });

  function submitCustomModality(e: React.FormEvent) {
    e.preventDefault();
    const name = customModalityName.trim();
    if (!name) return;
    createClassTypeMutation.mutate(name);
    setCustomModalityName('');
    setAddModalityDialog(false);
  }

  // Map: classTypeId → array of system names already created for that modality
  const systemNamesByClassType: Record<string, string[]> = {};
  for (const sys of systems) {
    if (sys.classTypeId) {
      if (!systemNamesByClassType[sys.classTypeId]) systemNamesByClassType[sys.classTypeId] = [];
      systemNamesByClassType[sys.classTypeId].push(sys.name);
    }
  }

  // Legacy single-system lookup (used in "Modalidades sem sistema" section)
  const systemByClassType: Record<string, GraduationSystem> = {};
  for (const sys of systems) {
    if (sys.classTypeId && !systemByClassType[sys.classTypeId]) systemByClassType[sys.classTypeId] = sys;
  }

  const activeClassTypes = classTypes.filter(ct => ct.active);
  const missingSports = COMMON_SPORTS.filter(
    s => !activeClassTypes.some(ct => ct.name.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* ── Modalidades da Academia ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Modalidades da Academia</h2>
            <p className="text-sm text-muted-foreground">
              Esportes praticados — vinculados aos sistemas de graduação.
            </p>
          </div>
          {activeClassTypes.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setAddModalityDialog(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Personalizada
            </Button>
          )}
        </div>

        {activeClassTypes.length === 0 ? (
          <Card>
            <CardContent className="py-6 space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma modalidade cadastrada. Clique para adicionar:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {COMMON_SPORTS.map(sport => (
                  <button
                    key={sport}
                    type="button"
                    disabled={createClassTypeMutation.isPending}
                    onClick={() => createClassTypeMutation.mutate(sport)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    {sport}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Ou{' '}
                <button
                  type="button"
                  className="underline text-primary"
                  onClick={() => setAddModalityDialog(true)}
                >
                  adicione uma modalidade personalizada
                </button>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {activeClassTypes.map(ct => (
              <Badge key={ct.id} variant="secondary" className="text-sm py-1 pl-3 pr-1.5 flex items-center gap-1.5">
                {ct.name}
                <button
                  type="button"
                  title={`Remover ${ct.name}`}
                  onClick={() => removeModalityMutation.mutate(ct)}
                  disabled={removeModalityMutation.isPending}
                  className="rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {missingSports.map(sport => (
              <button
                key={sport}
                type="button"
                disabled={createClassTypeMutation.isPending}
                onClick={() => createClassTypeMutation.mutate(sport)}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-dashed rounded-full hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                {sport}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t" />

      {/* ── Sistemas de Graduação ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sistemas de Graduação por Modalidade</h2>
          <p className="text-sm text-muted-foreground">
            Defina as faixas/graus de cada modalidade ensinada na academia.
          </p>
        </div>
        <Button onClick={() => setCreateDialog(true)} disabled={activeClassTypes.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Sistema
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      )}

      {!isLoading && systems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Award className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Nenhum sistema de graduação ainda</p>
            <p className="text-sm text-muted-foreground">
              {activeClassTypes.length === 0
                ? 'Adicione pelo menos uma modalidade acima para começar.'
                : 'Crie um sistema para cada modalidade da sua academia (ex: BJJ, Muay Thai, Judô).'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {systems.map(sys => (
          <div key={sys.id} id={`system-${sys.id}`} className="rounded-lg">
            <SystemPanel
              system={sys}
              classTypeName={sys.classType?.name ?? classTypes.find(c => c.id === sys.classTypeId)?.name ?? (sys.classTypeId ? '' : 'Geral')}
              onDeleteSystem={setDeleteSystem}
            />
          </div>
        ))}
      </div>

      {/* Modalidades without systems */}
      {classTypes.filter(ct => !systemByClassType[ct.id] && ct.active).length > 0 && (
        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground mb-3">
            Modalidades sem sistema de graduação:
          </p>
          <div className="flex flex-wrap gap-2">
            {classTypes
              .filter(ct => !systemByClassType[ct.id] && ct.active)
              .map(ct => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => {
                    setNewSystemClassTypeId(ct.id);
                    setNewSystemName(`Sistema ${ct.name}`);
                    setCreateDialog(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1 text-sm border rounded-full hover:bg-muted transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  {ct.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Add Custom Modality Dialog */}
      <Dialog open={addModalityDialog} onOpenChange={open => { setAddModalityDialog(open); if (!open) setCustomModalityName(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Modalidade</DialogTitle>
            <DialogDescription>Insira o nome do esporte ou arte marcial praticada.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCustomModality} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-modality-name">Nome da modalidade</Label>
              <Input
                id="custom-modality-name"
                value={customModalityName}
                onChange={e => setCustomModalityName(e.target.value)}
                placeholder="Ex: Capoeira, Kung Fu, Hapkido..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setAddModalityDialog(false); setCustomModalityName(''); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!customModalityName.trim() || createClassTypeMutation.isPending}>
                {createClassTypeMutation.isPending ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create System Dialog */}
      <Dialog open={createDialog} onOpenChange={open => !open && closeCreateDialog()}>
        <DialogContent className="max-w-lg flex flex-col max-h-[85vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Novo Sistema de Graduação</DialogTitle>
            <DialogDescription>Configure as faixas/graus de uma modalidade.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); setSubmitAttempted(true); if (newSystemName.trim()) createMutation.mutate(); }}
            className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0 pr-1"
          >
            <div className="space-y-2">
              <Label htmlFor="new-sys-modality">Vincular a uma Modalidade</Label>
              <Select
                value={newSystemClassTypeId || '__geral__'}
                onValueChange={val => {
                  setNewSystemClassTypeId(val === '__geral__' ? '' : val);
                  setSelectedTemplate(null);
                }}
              >
                <SelectTrigger id="new-sys-modality" aria-label="Modalidade do sistema de graduação">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__geral__">— Geral (sem modalidade) —</SelectItem>
                  {classTypes.filter(ct => ct.active).map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Info when selected modality already has systems */}
              {newSystemClassTypeId && (systemNamesByClassType[newSystemClassTypeId]?.length ?? 0) > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                  Esta modalidade já tem {systemNamesByClassType[newSystemClassTypeId].length} sistema(s).
                  Escolha um template diferente dos já adicionados para criar um segundo sistema.
                </div>
              )}
            </div>

            {/* Template cards — only shown when matching templates exist */}
            {matchingTemplates.length > 0 && (
              <div className="space-y-2">
                <Label>Template de graduação (opcional)</Label>
                <div className="space-y-2">
                  {matchingTemplates.map(tmpl => {
                    const alreadyUsed = newSystemClassTypeId
                      ? (systemNamesByClassType[newSystemClassTypeId] ?? []).includes(tmpl.name)
                      : false;
                    return (
                    <button
                      key={tmpl.id}
                      type="button"
                      disabled={alreadyUsed}
                      onClick={() => {
                        if (alreadyUsed) return;
                        if (selectedTemplate?.id === tmpl.id) {
                          setSelectedTemplate(null);
                        } else {
                          setSelectedTemplate(tmpl);
                          setNewSystemName(tmpl.name);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        alreadyUsed
                          ? 'border-border opacity-50 cursor-not-allowed bg-muted/40'
                          : selectedTemplate?.id === tmpl.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{tmpl.name}</p>
                          <p className="text-xs text-muted-foreground">{tmpl.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary">{tmpl.ranks.length} graus</Badge>
                          {alreadyUsed
                            ? <Badge variant="outline" className="text-xs">já adicionado</Badge>
                            : selectedTemplate?.id === tmpl.id && <CheckCircle2 className="h-4 w-4 text-primary" />
                          }
                        </div>
                      </div>
                      {selectedTemplate?.id === tmpl.id && !alreadyUsed && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {tmpl.ranks.map(r => (
                            <BeltBar key={r.name} color={r.colorClass} name={r.name} width={44} height={12} />
                          ))}
                        </div>
                      )}
                    </button>
                  );})}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-sys-name">Nome do sistema</Label>
              <Input
                id="new-sys-name"
                value={newSystemName}
                onChange={e => setNewSystemName(e.target.value)}
                placeholder="Ex: Faixas BJJ, Graduações de Judô..."
              />
            </div>

            {submitAttempted && newSystemClassTypeId && (systemNamesByClassType[newSystemClassTypeId] ?? []).includes(newSystemName.trim()) && (
              <p className="text-xs text-destructive -mt-2">
                Já existe um sistema com este nome nesta modalidade.
              </p>
            )}

            <div className="flex justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={closeCreateDialog}>Cancelar</Button>
              <Button type="submit" disabled={
                !newSystemName.trim() ||
                createMutation.isPending ||
                !!(newSystemClassTypeId && (systemNamesByClassType[newSystemClassTypeId] ?? []).includes(newSystemName.trim()))
              }>
                {createMutation.isPending ? 'Criando...' : 'Criar Sistema'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete System Confirmation */}
      <AlertDialog open={!!deleteSystem} onOpenChange={open => !open && setDeleteSystem(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Sistema de Graduação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o sistema <strong>{deleteSystem?.name}</strong>?
              Todas as graduações (faixas/graus) deste sistema também serão removidas.
              As graduações já atribuídas aos alunos serão mantidas no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSystem && deleteMutation.mutate(deleteSystem)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete System Blocked — students enrolled */}
      <AlertDialog open={!!deleteBlockedInfo} onOpenChange={open => !open && setDeleteBlockedInfo(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Users className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-left">Não é possível remover este sistema</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left space-y-2">
              {(deleteBlockedInfo?.count ?? 0) > 0 ? (
                <span className="block">
                  O sistema <strong>{deleteBlockedInfo?.system.name}</strong> possui{' '}
                  <strong>{deleteBlockedInfo?.count} aluno{(deleteBlockedInfo?.count ?? 0) > 1 ? 's' : ''}</strong>{' '}
                  com graduação ativa vinculada a ele.
                </span>
              ) : (
                <span className="block">
                  O sistema <strong>{deleteBlockedInfo?.system.name}</strong> não pode ser removido porque há alunos com graduações ativas vinculadas a ele.
                </span>
              )}
              <span className="block text-muted-foreground text-sm">
                Para remover este sistema, primeiro transfira ou cancele as graduações dos alunos matriculados nesta modalidade.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDeleteBlockedInfo(undefined)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Painel Tab ───────────────────────────────────────────────────────────────

/** Preferências de exibição do Dashboard. O painel de retenção é opt-in:
 *  em academias com muitos alunos a lista pode poluir o painel. */
function PainelTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  interface DashboardPrefs {
    showRetention: boolean;
    showGraduationSuggestions: boolean;
    showAttendanceRate: boolean;
  }

  const { data, isLoading } = useQuery<DashboardPrefs>({
    queryKey: ['/api/dashboard/preferences'],
  });

  const PREF_NAMES: Record<keyof DashboardPrefs, string> = {
    showRetention: 'retenção',
    showGraduationSuggestions: 'sugestões de graduação',
    showAttendanceRate: 'taxa de presença',
  };

  const updateMutation = useMutation({
    mutationFn: (prefs: Partial<DashboardPrefs>) =>
      apiRequest('PATCH', '/api/dashboard/preferences', prefs).then(r => r.json() as Promise<DashboardPrefs>),
    onSuccess: (updated, sent) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/retention'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/graduation-suggestions'] });
      const key = (Object.keys(sent) as (keyof DashboardPrefs)[]).find(k => sent[k] !== undefined)!;
      const on = updated[key];
      const nome = PREF_NAMES[key];
      toast({
        title: on ? `Painel de ${nome} ativado` : `Painel de ${nome} oculto`,
        description: on
          ? 'O Dashboard passa a exibir o painel.'
          : 'O painel deixa de aparecer no Dashboard.',
      });
    },
    onError: () => toast({ title: 'Erro ao salvar preferência', variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Painel</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o que aparece no Dashboard da academia.
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="switch-retention" className="text-sm font-medium">
                Retenção — presença em queda
              </Label>
              <p className="text-xs text-muted-foreground max-w-prose">
                Lista alunos ativos sem treinar há 14+ dias (atenção) ou 30+ (risco),
                com atalho para a ficha. Em academias com muitos alunos a lista pode
                ficar longa — por isso vem desligado por padrão.
              </p>
            </div>
            <Switch
              id="switch-retention"
              checked={data?.showRetention ?? false}
              disabled={isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ showRetention: checked })}
              data-testid="switch-show-retention"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="switch-graduation" className="text-sm font-medium">
                Sugestões de graduação
              </Label>
              <p className="text-xs text-muted-foreground max-w-prose">
                Sugere candidatos a promoção por modalidade (20+ presenças desde a
                última graduação e 90+ dias na faixa atual), com atalho para a ficha.
              </p>
            </div>
            <Switch
              id="switch-graduation"
              checked={data?.showGraduationSuggestions ?? false}
              disabled={isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ showGraduationSuggestions: checked })}
              data-testid="switch-show-graduation"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="switch-attendance-rate" className="text-sm font-medium">
                Taxa de presença
              </Label>
              <p className="text-xs text-muted-foreground max-w-prose">
                Card com a taxa de presença dos últimos 30 dias e a tendência
                vs. o período anterior, com atalho para a página de Presença.
                Vem ligado por padrão.
              </p>
            </div>
            <Switch
              id="switch-attendance-rate"
              checked={data?.showAttendanceRate ?? true}
              disabled={isLoading || updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ showAttendanceRate: checked })}
              data-testid="switch-show-attendance-rate"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm">Gerencie as configurações da sua academia</p>
        </div>
      </div>

      <Tabs defaultValue="modalidades">
        <TabsList>
          <TabsTrigger value="modalidades">
            <Award className="h-4 w-4 mr-2" />
            Modalidades & Graduações
          </TabsTrigger>
          <TabsTrigger value="painel" data-testid="tab-painel">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Painel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modalidades" className="mt-6">
          <ModalidadesTab />
        </TabsContent>

        <TabsContent value="painel" className="mt-6">
          <PainelTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
