import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft, Edit2, Save, X, Plus, Trash2,
  Mail, Phone, Calendar, User, Users, Banknote, ShieldCheck, ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { invalidateAfterStudentChange } from "@/lib/cache-helpers";
import { BeltBar, isLightHex } from "@/components/BeltBadge";
import { isMinor } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  belt?: string;
  /** Responsável legal — obrigatório quando o aluno é menor de idade */
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
  /** Desconto individual em centavos (bolsa/família); null/undefined = valor do plano */
  customMonthlyAmount?: number | null;
  /** Dia de vencimento escolhido pelo aluno (5/15/25); null = padrão da academia */
  paymentDueDay?: number | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODALITY_COLOR_PALETTE = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#14b8a6', '#a855f7',
];

const KNOWN_MODALITY_COLORS: Record<string, string> = {
  'bjj': '#3b82f6', 'jiu-jitsu': '#3b82f6', 'jiu jitsu': '#3b82f6',
  'muay thai': '#ef4444', 'muay-thai': '#ef4444', 'muaythai': '#ef4444',
  'judô': '#f97316', 'judo': '#f97316', 'judô brasileiro': '#f97316',
};

function hashModalityColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return MODALITY_COLOR_PALETTE[Math.abs(h) % MODALITY_COLOR_PALETTE.length];
}

function getModalityColor(classTypeId: string, name: string): string {
  return KNOWN_MODALITY_COLORS[name.toLowerCase().trim()] ?? hashModalityColor(classTypeId);
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function formatPhone(phone?: string) {
  if (!phone) return '—';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function genKey() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium break-all">{value}</p>
      </div>
    </div>
  );
}

function ModalityCard({
  name, rankName, rankColor, modalityColor,
}: {
  name: string; rankName?: string; rankColor?: string; modalityColor: string;
}) {
  const c1 = rankColor?.split('|')[0];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card">
      <svg width="6" height="32" viewBox="0 0 6 32" className="shrink-0" aria-hidden="true">
        <rect width="6" height="32" rx="3" fill={modalityColor} />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{name}</p>
        {c1 ? (
          <div className="flex items-center gap-1.5 mt-1">
            <BeltBar color={rankColor!} name={rankName!} width={28} height={8} />
            <span className="text-xs text-muted-foreground">{rankName}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">Sem graduação</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentDetail() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── Server state ──────────────────────────────────────────────────────────
  const { data: student, isLoading: loadingStudent } = useQuery<Student>({
    queryKey: ['/api/students', studentId],
    queryFn: () => apiRequest('GET', `/api/students/${studentId}`).then(r => r.json()),
    enabled: !!studentId,
  });

  const { data: classTypes = [] } = useQuery<ClassType[]>({
    queryKey: ['/api/classes/class-types'],
    queryFn: () => apiRequest('GET', '/api/classes/class-types').then(r => r.json()),
  });

  const { data: graduationSystems = [] } = useQuery<GraduationSystem[]>({
    queryKey: ['/api/graduation/systems'],
    queryFn: () => apiRequest('GET', '/api/graduation/systems').then(r => r.json()),
  });

  const { data: modalityRanks = [], isSuccess: ranksLoaded } = useQuery<{ classTypeId: string; rankId: string }[]>({
    queryKey: ['/api/students', studentId, 'modality-ranks'],
    queryFn: () => apiRequest('GET', `/api/students/${studentId}/modality-ranks`).then(r => r.json()),
    enabled: !!studentId,
  });

  const { data: enrollments = [], isSuccess: enrollmentsLoaded } = useQuery<{ classTypeId: string; active: boolean }[]>({
    queryKey: ['/api/students', studentId, 'modality-enrollments'],
    queryFn: () => apiRequest('GET', `/api/students/${studentId}/modality-enrollments`).then(r => r.json()),
    enabled: !!studentId,
  });

  // ── Local edit state ──────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', phone: '', dateOfBirth: '', active: true,
  });
  const [modalidadesForm, setModalidadesForm] = useState<ModalidadeFormRow[]>([]);

  // Sincroniza o form com os dados do servidor sempre que NÃO estiver editando
  // e as três queries estiverem prontas. Isso garante que:
  // - Na carga inicial: espera enrollments + ranks antes de popular o form
  // - Após um save: atualiza automaticamente quando o refetch completa
  // - Sem o padrão hasInitialized, que falha quando student chega do cache
  //   antes de enrollments terminar → form vazio → reconciliação deleta tudo
  useEffect(() => {
    if (isEditing || !student || !enrollmentsLoaded || !ranksLoaded) return;
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.split('T')[0] : '',
      active: student.active,
    });
    const rankByClassType = new Map(modalityRanks.map(r => [r.classTypeId, r.rankId]));
    setModalidadesForm(
      enrollments
        .filter(e => e.active)
        .map(e => ({
          _key: genKey(),
          classTypeId: e.classTypeId,
          rankId: rankByClassType.get(e.classTypeId) ?? '',
        }))
    );
  }, [isEditing, student, enrollments, enrollmentsLoaded, modalityRanks, ranksLoaded]);

  // ── Derived display data ──────────────────────────────────────────────────
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
    return enrollments
      .filter(e => e.active)
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

  // Primary rank color for avatar ring (first modality with a rank)
  const primaryRankColor = viewModalities.find(m => m.rankColor)?.rankColor?.split('|')[0];

  // ── Helpers for repeater ──────────────────────────────────────────────────
  const usedClassTypeIds = new Set(modalidadesForm.map(r => r.classTypeId).filter(Boolean));

  function getRanksForClassType(classTypeId: string) {
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
    setModalidadesForm(prev => prev.map(r => {
      if (r._key !== key) return r;
      if (field === 'classTypeId') return { ...r, classTypeId: value, rankId: '' };
      return { ...r, [field]: value };
    }));
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
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
      enrollments
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
      // 1. Update base fields
      await apiRequest('PATCH', `/api/students/${studentId}`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        active: formData.active,
      });

      // 2. Reconcile modalities
      const validRows = modalidadesForm.filter(r => {
        if (!r.classTypeId) return false;
        const ranks = getRanksForClassType(r.classTypeId);
        return ranks.length === 0 || !!r.rankId;
      });
      const formIds = validRows.map(r => r.classTypeId);
      const enrolledIds = enrollments.filter(e => e.active).map(e => e.classTypeId);
      const toRemove = enrolledIds.filter(id => !formIds.includes(id));
      const rankByClassType = new Map(modalityRanks.map(r => [r.classTypeId, r.rankId]));
      const toUpsert = validRows.filter(row => {
        if (!enrolledIds.includes(row.classTypeId)) return true;
        const cur = rankByClassType.get(row.classTypeId);
        return row.rankId && cur !== row.rankId;
      });

      await Promise.all([
        ...toRemove.map(ctId =>
          apiRequest('DELETE', `/api/students/${studentId}/modality-enrollments/${ctId}`)
        ),
        ...toUpsert.map(row =>
          row.rankId
            ? apiRequest('POST', `/api/students/${studentId}/graduate-modality`, {
                classTypeId: row.classTypeId, rankId: row.rankId,
              })
            : apiRequest('POST', `/api/students/${studentId}/modality-enrollments`, {
                classTypeId: row.classTypeId,
              })
        ),
      ]);
    },
    onSuccess: () => {
      invalidateAfterStudentChange(globalQueryClient);
      globalQueryClient.invalidateQueries({ queryKey: ['/api/students', studentId] });
      globalQueryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'modality-ranks'] });
      globalQueryClient.invalidateQueries({ queryKey: ['/api/students', studentId, 'modality-enrollments'] });
      setIsEditing(false); // triggers useEffect to re-sync from fresh server data
      toast({ title: "Perfil atualizado!", description: `${formData.name} foi salvo com sucesso.` });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message ?? "Erro desconhecido" });
    },
  });

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loadingStudent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Aluno não encontrado.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/alunos')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a lista
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/alunos')}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Alunos
        </Button>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={saveMutation.isPending}
              >
                <X className="h-4 w-4 mr-1.5" /> Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-1.5" /> Editar Perfil
            </Button>
          )}
        </div>
      </div>

      {/* ── Profile header card ───────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Avatar with rank ring */}
        <Avatar
          className="h-16 w-16 shrink-0 text-lg"
          style={primaryRankColor ? {
            outline: `3px solid ${primaryRankColor}`,
            outlineOffset: '3px',
            boxShadow: isLightHex(primaryRankColor) ? '0 0 0 5px #d1d5db' : 'none',
          } : {}}
        >
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
            {getInitials(isEditing ? formData.name : student.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              className="text-xl font-bold h-9 mb-2 max-w-sm"
              placeholder="Nome completo"
            />
          ) : (
            <h1 className="text-xl font-bold leading-tight truncate">{student.name}</h1>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Switch
                  id="active-toggle"
                  checked={formData.active}
                  onCheckedChange={v => setFormData(p => ({ ...p, active: v }))}
                />
                <Label htmlFor="active-toggle" className="text-sm cursor-pointer">
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
              <Badge variant={student.active ? 'default' : 'secondary'}>
                {student.active ? 'Ativo' : 'Inativo'}
              </Badge>
            )}

            {isEditing ? (
              <Input
                value={formData.phone}
                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="h-8 w-44 text-sm"
              />
            ) : (
              student.phone && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {formatPhone(student.phone)}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Main content grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* ── Informações Cadastrais ──────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Informações Cadastrais
          </h2>
          <Separator />

          {/* Email */}
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
              <p className="text-sm font-medium break-all">{student.email}</p>
            )}
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Data de Nascimento
            </Label>
            {isEditing ? (
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))}
                title="Data de Nascimento"
                className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground h-8"
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {student.dateOfBirth ? formatDate(student.dateOfBirth) : '—'}
                </p>
                {isMinor(student.dateOfBirth) && (
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                    Menor de idade
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Responsável legal — obrigatório para menor de idade; edição fica
              na ficha do aluno (StudentDetailDialog) */}
          {(isMinor(student.dateOfBirth) || !!student.guardianName) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Responsável Legal
              </Label>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {student.guardianName ?? '—'}
                  {student.guardianRelationship ? (
                    <span className="font-normal text-muted-foreground"> ({student.guardianRelationship})</span>
                  ) : null}
                </p>
                {student.guardianPhone && (
                  <p className="text-sm text-muted-foreground">{formatPhone(student.guardianPhone)}</p>
                )}
                {isMinor(student.dateOfBirth) && !student.guardianName && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Menor de idade sem responsável cadastrado — complete pela ficha do aluno na lista.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Mensalidade — valor do plano ou desconto individual */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5" /> Mensalidade
            </Label>
            <p className="text-sm font-medium">
              {student.customMonthlyAmount != null
                ? `${formatBRL(student.customMonthlyAmount)} (desconto individual)`
                : 'Valor do plano'}
            </p>
          </div>

          {/* Vencimento da mensalidade — dia escolhido pelo aluno (5/15/25);
              edição fica na ficha do aluno (StudentDetailDialog) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Vencimento
            </Label>
            <p className="text-sm font-medium" data-testid="text-payment-due-day">
              {student.paymentDueDay != null ? `Dia ${student.paymentDueDay}` : 'Padrão da academia'}
            </p>
          </div>

          {/* Enrollment date (read-only always) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Data de Matrícula
            </Label>
            <p className="text-sm font-medium">{formatDate(student.createdAt)}</p>
          </div>
        </section>

        {/* ── Modalidades e Graduações ────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Modalidades e Graduações
          </h2>
          <Separator />

          {isEditing ? (
            /* ── Edit: repeater ──────────────────────────────────────────── */
            <div className="space-y-2">
              {modalidadesForm.map(row => {
                const ranks = getRanksForClassType(row.classTypeId);
                return (
                  <div key={row._key} className="flex items-center gap-2">
                    {/* Modality select */}
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

                    {/* Rank select */}
                    <Select
                      value={row.rankId}
                      onValueChange={v => updateModalidade(row._key, 'rankId', v)}
                      disabled={!row.classTypeId || ranks.length === 0}
                    >
                      <SelectTrigger className="flex-1 h-8 text-sm [&>span]:min-w-0 [&>span]:truncate">
                        <SelectValue
                          placeholder={ranks.length === 0 && row.classTypeId ? 'Sem graduação' : 'Faixa'}
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

                    {/* Remove */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeModalidade(row._key)}
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
                  className="w-full mt-1"
                  onClick={addModalidade}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Modalidade
                </Button>
              )}

              {classTypes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma modalidade cadastrada.
                </p>
              )}
            </div>
          ) : (
            /* ── View: modality cards ────────────────────────────────────── */
            <div className="space-y-2">
              {viewModalities.length > 0 ? (
                viewModalities.map(m => (
                  <ModalityCard
                    key={m.classTypeId}
                    name={m.name}
                    rankName={m.rankName}
                    rankColor={m.rankColor}
                    modalityColor={m.modalityColor}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma modalidade vinculada.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
