import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Edit2, Save, X, Plus, Trash2,
  Mail, Phone, Calendar, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { invalidateAfterStudentChange } from "@/lib/cache-helpers";
import { BeltBar, isLightHex } from "@/components/BeltBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DialogStudent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  active: boolean;
  createdAt: string;
}

interface GraduationRank {
  id: string;
  name: string;
  displayOrder: number;
  colorClass: string;
}

interface GraduationSystem {
  id: string;
  classTypeId: string | null;
  name: string;
  ranks: GraduationRank[];
}

interface ClassType {
  id: string;
  name: string;
}

interface ModalidadeFormRow {
  _key: string;
  classTypeId: string;
  rankId: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  active: boolean;
}

interface StudentDetailDialogProps {
  student: DialogStudent | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Color helpers (consistent with StudentManagement / StudentDetail) ────────

const MODALITY_COLOR_PALETTE = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#a855f7',
];

const KNOWN_MODALITY_COLORS: Record<string, string> = {
  bjj: '#3b82f6', 'jiu-jitsu': '#3b82f6', 'jiu jitsu': '#3b82f6',
  'muay thai': '#ef4444', 'muay-thai': '#ef4444', muaythai: '#ef4444',
  judô: '#f97316', judo: '#f97316', 'judô brasileiro': '#f97316',
};

function hashModalityColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return MODALITY_COLOR_PALETTE[Math.abs(h) % MODALITY_COLOR_PALETTE.length];
}

function getModalityColor(classTypeId: string, name: string): string {
  return KNOWN_MODALITY_COLORS[name.toLowerCase().trim()] ?? hashModalityColor(classTypeId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function formatPhone(phone?: string) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function genKey() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentDetailDialog({ student, open, onOpenChange }: StudentDetailDialogProps) {
  const { toast } = useToast();

  // ── Server queries ────────────────────────────────────────────────────────
  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types'],
    queryFn: () => apiRequest('GET', '/api/classes/class-types').then(r => r.json()),
    enabled: open,
  });

  const { data: graduationSystems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
    enabled: open,
  });

  const { data: modalityRanks = [], isSuccess: ranksLoaded } = useQuery<{ classTypeId: string; rankId: string }[]>({
    queryKey: ['/api/students', student?.id, 'modality-ranks'],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/modality-ranks`).then(r => r.json()),
    enabled: open && !!student?.id,
  });

  const { data: enrollments = [], isSuccess: enrollmentsLoaded } = useQuery<{ classTypeId: string; active: boolean }[]>({
    queryKey: ['/api/students', student?.id, 'modality-enrollments'],
    queryFn: () => apiRequest('GET', `/api/students/${student!.id}/modality-enrollments`).then(r => r.json()),
    enabled: open && !!student?.id,
  });

  // ── Local state ───────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', phone: '', dateOfBirth: '', active: true,
  });
  const [modalidadesForm, setModalidadesForm] = useState<ModalidadeFormRow[]>([]);

  // Reset to view mode whenever dialog closes
  useEffect(() => {
    if (!open) setIsEditing(false);
  }, [open]);

  // Sync form from server data — only while NOT editing, to avoid overwriting user input
  useEffect(() => {
    if (!open || isEditing || !student || !enrollmentsLoaded || !ranksLoaded) return;
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      active: student.active,
    });
    const rankByClassType = new Map(modalityRanks.map(r => [r.classTypeId, r.rankId]));
    setModalidadesForm(
      (enrollments ?? [])
        .filter(e => e.active)
        .map(e => ({
          _key: genKey(),
          classTypeId: e.classTypeId,
          rankId: rankByClassType.get(e.classTypeId) ?? '',
        }))
    );
  }, [open, isEditing, student, enrollments, enrollmentsLoaded, modalityRanks, ranksLoaded]);

  // ── Derived data (view mode) ──────────────────────────────────────────────
  const rankById = useMemo(() => {
    const m = new Map<string, GraduationRank>();
    for (const sys of graduationSystems) for (const r of sys.ranks) m.set(r.id, r);
    return m;
  }, [graduationSystems]);

  const classTypeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const ct of classTypes) m.set(ct.id, ct.name);
    return m;
  }, [classTypes]);

  const viewModalities = useMemo(() => {
    const rankByClassType = new Map(modalityRanks.map(r => [r.classTypeId, r.rankId]));
    return (enrollments ?? [])
      .filter(e => e?.active)
      .map(e => {
        const name = classTypeById.get(e.classTypeId) ?? '—';
        const rankId = rankByClassType.get(e.classTypeId);
        const rank = rankId ? rankById.get(rankId) : undefined;
        return {
          classTypeId: e.classTypeId,
          name,
          rankName: rank?.name,
          rankColor: rank?.colorClass,
          modalityColor: getModalityColor(e.classTypeId, name),
        };
      });
  }, [enrollments, modalityRanks, rankById, classTypeById]);

  const primaryRankColor = viewModalities.find(m => m.rankColor)?.rankColor?.split('|')[0];

  // ── Repeater helpers (edit mode) ──────────────────────────────────────────
  const usedClassTypeIds = new Set(modalidadesForm.map(r => r.classTypeId).filter(Boolean));

  function getRanksForClassType(classTypeId: string): GraduationRank[] {
    const sys = graduationSystems.find(s => s.classTypeId === classTypeId);
    return (sys?.ranks ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
  }

  function addModalidade() {
    setModalidadesForm(prev => [...prev, { _key: genKey(), classTypeId: '', rankId: '' }]);
  }

  function removeModalidade(key: string) {
    setModalidadesForm(prev => prev.filter(r => r._key !== key));
  }

  function updateModalidade(key: string, field: 'classTypeId' | 'rankId', value: string) {
    setModalidadesForm(prev =>
      prev.map(r => {
        if (r._key !== key) return r;
        if (field === 'classTypeId') return { ...r, classTypeId: value, rankId: '' };
        return { ...r, [field]: value };
      })
    );
  }

  function handleCancel() {
    if (!student) return;
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      active: student.active,
    });
    const rankByClassType = new Map(modalityRanks.map(r => [r.classTypeId, r.rankId]));
    setModalidadesForm(
      (enrollments ?? [])
        .filter(e => e.active)
        .map(e => ({
          _key: genKey(),
          classTypeId: e.classTypeId,
          rankId: rankByClassType.get(e.classTypeId) ?? '',
        }))
    );
    setIsEditing(false);
  }

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PATCH', `/api/students/${student!.id}`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        active: formData.active,
      });

      const validRows = modalidadesForm.filter(r => {
        if (!r.classTypeId) return false;
        const ranks = getRanksForClassType(r.classTypeId);
        return ranks.length === 0 || !!r.rankId;
      });
      const formIds = validRows.map(r => r.classTypeId);
      const enrolledIds = (enrollments ?? []).filter(e => e.active).map(e => e.classTypeId);
      const toRemove = enrolledIds.filter(id => !formIds.includes(id));
      const rankByClassType = new Map(modalityRanks.map(r => [r.classTypeId, r.rankId]));
      const toUpsert = validRows.filter(row => {
        if (!enrolledIds.includes(row.classTypeId)) return true;
        return row.rankId && rankByClassType.get(row.classTypeId) !== row.rankId;
      });

      await Promise.all([
        ...toRemove.map(ctId =>
          apiRequest('DELETE', `/api/students/${student!.id}/modality-enrollments/${ctId}`)
        ),
        ...toUpsert.map(row =>
          row.rankId
            ? apiRequest('POST', `/api/students/${student!.id}/graduate-modality`, {
                classTypeId: row.classTypeId, rankId: row.rankId,
              })
            : apiRequest('POST', `/api/students/${student!.id}/modality-enrollments`, {
                classTypeId: row.classTypeId,
              })
        ),
      ]);
    },
    onSuccess: () => {
      invalidateAfterStudentChange(globalQueryClient);
      globalQueryClient.invalidateQueries({ queryKey: ['/api/students', student?.id] });
      globalQueryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'modality-ranks'] });
      globalQueryClient.invalidateQueries({ queryKey: ['/api/students', student?.id, 'modality-enrollments'] });
      setIsEditing(false);
      toast({ title: 'Perfil atualizado!', description: `${formData.name} foi salvo com sucesso.` });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err.message ?? 'Erro desconhecido' });
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg flex flex-col max-h-[90vh] gap-0 p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base">Detalhes do Aluno</DialogTitle>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saveMutation.isPending}
                    className="h-8"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

          {/* ── Avatar + nome + status ───────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <Avatar
              className="h-14 w-14 shrink-0"
              style={primaryRankColor ? {
                outline: `3px solid ${primaryRankColor}`,
                outlineOffset: '3px',
                boxShadow: isLightHex(primaryRankColor) ? '0 0 0 5px #d1d5db' : 'none',
              } : {}}
            >
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {getInitials(isEditing ? formData.name : (student?.name ?? ''))}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="text-lg font-bold h-9 mb-1.5 max-w-xs"
                  placeholder="Nome completo"
                />
              ) : (
                <h2 className="text-lg font-bold leading-tight truncate">{student?.name}</h2>
              )}

              {isEditing ? (
                <div className="flex items-center gap-2 mt-1">
                  <Switch
                    id="detail-active"
                    checked={formData.active}
                    onCheckedChange={v => setFormData(p => ({ ...p, active: v }))}
                  />
                  <Label htmlFor="detail-active" className="text-sm cursor-pointer">
                    {formData.active ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <ShieldCheck className="h-3.5 w-3.5" /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ShieldOff className="h-3.5 w-3.5" /> Inativo
                      </span>
                    )}
                  </Label>
                </div>
              ) : (
                <Badge
                  variant={student?.active ? 'default' : 'secondary'}
                  className="mt-1"
                >
                  {student?.active ? 'Ativo' : 'Inativo'}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* ── Dados cadastrais ─────────────────────────────────────────── */}
          <div className="space-y-3">
            {/* E-mail */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> E-mail
              </Label>
              {isEditing ? (
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="h-8 text-sm"
                />
              ) : (
                <p className="text-sm font-medium break-all">{student?.email ?? '—'}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone
              </Label>
              {isEditing ? (
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="h-8 text-sm"
                />
              ) : (
                <p className="text-sm font-medium">{formatPhone(student?.phone) ?? '—'}</p>
              )}
            </div>

            {/* Data de nascimento */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Data de Nascimento
              </Label>
              {isEditing ? (
                <input
                  type="date"
                  title="Data de Nascimento"
                  value={formData.dateOfBirth}
                  onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))}
                  className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground h-8"
                />
              ) : (
                <p className="text-sm font-medium">
                  {formatDate(student?.dateOfBirth) ?? '—'}
                </p>
              )}
            </div>

            {/* Data de matrícula (sempre read-only) */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Data de Matrícula
              </Label>
              <p className="text-sm font-medium">{formatDate(student?.createdAt) ?? '—'}</p>
            </div>
          </div>

          <Separator />

          {/* ── Modalidades e Graduações ─────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Modalidades e Graduações
            </p>

            {isEditing ? (
              /* Repeater de edição */
              <div className="space-y-2">
                {modalidadesForm.map(row => {
                  const ranks = getRanksForClassType(row.classTypeId);
                  return (
                    <div key={row._key} className="flex items-center gap-2">
                      <Select
                        value={row.classTypeId}
                        onValueChange={v => updateModalidade(row._key, 'classTypeId', v)}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Modalidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {classTypes.map(ct => (
                            <SelectItem
                              key={ct.id}
                              value={ct.id}
                              disabled={usedClassTypeIds.has(ct.id) && ct.id !== row.classTypeId}
                            >
                              {ct.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={row.rankId}
                        onValueChange={v => updateModalidade(row._key, 'rankId', v)}
                        disabled={!row.classTypeId || ranks.length === 0}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue
                            placeholder={
                              ranks.length === 0 && row.classTypeId ? 'Sem graduação' : 'Faixa'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {ranks.map(rank => {
                            const c1 = rank.colorClass.split('|')[0];
                            return (
                              <SelectItem key={rank.id} value={rank.id}>
                                <span className="flex items-center gap-2">
                                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
                                    <circle cx="6" cy="6" r="6" fill={c1} />
                                    {isLightHex(c1) && (
                                      <circle cx="6" cy="6" r="5.5" fill="none" stroke="#d1d5db" strokeWidth="1" />
                                    )}
                                  </svg>
                                  {rank.name}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeModalidade(row._key)}
                        title="Remover modalidade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}

                {classTypes.length > usedClassTypeIds.size && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addModalidade}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Modalidade
                  </Button>
                )}

                {classTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma modalidade cadastrada.</p>
                )}
              </div>
            ) : (
              /* Cards de visualização */
              <div className="space-y-2">
                {viewModalities.length > 0 ? (
                  viewModalities.map(m => {
                    const c1 = m.rankColor?.split('|')[0];
                    return (
                      <div
                        key={m.classTypeId}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card"
                      >
                        <svg
                          width="5" height="28" viewBox="0 0 5 28"
                          className="shrink-0" aria-hidden="true"
                        >
                          <rect width="5" height="28" rx="2.5" fill={m.modalityColor} />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight">{m.name}</p>
                          {c1 ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <BeltBar color={m.rankColor!} name={m.rankName!} width={26} height={8} />
                              <span className="text-xs text-muted-foreground">{m.rankName}</span>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">Sem graduação</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma modalidade vinculada.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
