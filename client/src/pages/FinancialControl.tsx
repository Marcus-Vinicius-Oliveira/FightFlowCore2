import { Fragment, useState } from "react";
import { formatDateOnly, formatMonthYear, monthKeyOf, monthLabelOf, monthLabelCapOf } from "@/lib/dates";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  Filter,
  Save,
  X,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Search,
  Undo2,
  FileText,
  FileDown,
  Printer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, type Payment, type MembershipPlan, type Student } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface PaymentRecord {
  id: string;
  studentId: string;
  aluno: string;
  plano: string;
  vencimento: string;
  /** Timestamp do vencimento — ordenação sem reparsear a data formatada */
  vencimentoMs: number;
  status: 'pago' | 'atrasado' | 'proximo' | 'pendente';
  dataPagamento: string;
  meioPagamento: string;
  valor: number;
  /** Total de mensalidades em atraso do aluno (dívida acumulada, não só esta linha) */
  atrasosDoAluno: number;
}

type FilterType = 'todos' | 'pagos' | 'atrasados' | 'proximos';

/** Visão agrupada do filtro Atrasados: um devedor por linha, mensalidades ao expandir */
interface DebtorGroup {
  studentId: string;
  aluno: string;
  /** Mensalidades atrasadas do aluno, mais antiga primeiro */
  payments: PaymentRecord[];
  totalCents: number;
  oldestMs: number;
}

/** Busca sem acento/caixa (ex.: "patricia" acha "Patrícia") */
function normalizeSearch(s: string): string {
  // NFD separa os diacríticos; \p{M} (marcas combinantes) os remove
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const STATUS_LABELS: Record<PaymentRecord['status'], string> = {
  pago: 'Pago',
  atrasado: 'Atrasado',
  proximo: 'Próximo',
  pendente: 'Pendente',
};

/**
 * Mesma convenção do servidor (server/lib/payments.ts): a mensalidade que
 * vence hoje só é "atrasada" depois que o dia termina.
 */
function isOverdue(dueDate: string): boolean {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  return new Date(dueDate) < cutoff;
}

function computeStatus(p: Payment): PaymentRecord['status'] {
  if (p.status === 'paid') return 'pago';
  if (p.status === 'overdue') return 'atrasado';
  const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  if (new Date(p.dueDate) <= fiveDaysFromNow) return 'proximo';
  return 'pendente';
}

export default function FinancialControl() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  // 'todos' ou chave "YYYY-MM" — os meses ofertados vêm dos vencimentos existentes
  const [periodFilter, setPeriodFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDueDayDialogOpen, setIsDueDayDialogOpen] = useState(false);
  const [dueDayInput, setDueDayInput] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [isUndoConfirmOpen, setIsUndoConfirmOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    valorPago: '',
    dataPagamento: '',
    meioPagamento: '',
    observacoes: ''
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // queryKeys no padrão do app (['/api/...'] + queryFn default) para a
  // invalidação funcionar entre páginas (ex.: chip "Inadimplentes" da lista de alunos)
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const { data: studentsData } = useQuery<Student[]>({
    queryKey: ['/api/students'],
  });

  const { data: plansData } = useQuery<MembershipPlan[]>({
    queryKey: ['/api/membership-plans'],
  });

  const { data: billingSettings } = useQuery<{ paymentDueDay: number }>({
    queryKey: ['/api/academy/billing-settings'],
  });

  const updateDueDayMutation = useMutation({
    mutationFn: (paymentDueDay: number) =>
      apiRequest('PATCH', '/api/academy/billing-settings', { paymentDueDay }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/academy/billing-settings'] });
      toast({
        title: 'Dia de vencimento atualizado!',
        description: 'As próximas mensalidades geradas automaticamente usarão o novo dia.',
      });
      setIsDueDayDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  const handleSaveDueDay = () => {
    const day = parseInt(dueDayInput, 10);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      toast({
        title: 'Dia inválido',
        description: 'Informe um dia entre 1 e 28 (para existir em todos os meses).',
        variant: 'destructive',
      });
      return;
    }
    updateDueDayMutation.mutate(day);
  };

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updatePayment>[1] }) =>
      apiClient.updatePayment(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });

      // Dívida acumulada: quitar a mensalidade do mês não quita as anteriores —
      // sem o aviso o gestor assume que o aluno saiu da inadimplência.
      const paid = paymentsData?.find(p => p.id === id);
      const outrasAtrasadas = paid
        ? (paymentsData ?? []).filter(
            p => p.studentId === paid.studentId && p.status === 'overdue' && p.id !== id
          )
        : [];

      if (outrasAtrasadas.length > 0) {
        const student = studentsData?.find(s => s.id === paid!.studentId);
        const meses = outrasAtrasadas
          .map(p => formatMonthYear(p.dueDate))
          .join(', ');
        toast({
          title: 'Pagamento registrado!',
          description: `Atenção: ${student?.name ?? 'o aluno'} ainda tem ${outrasAtrasadas.length} mensalidade${outrasAtrasadas.length > 1 ? 's' : ''} em atraso (${meses}).`,
        });
      } else {
        toast({ title: 'Pagamento registrado!', description: 'O pagamento foi registrado com sucesso.' });
      }

      setIsPaymentModalOpen(false);
      setSelectedPaymentId(null);
      setPaymentForm({ valorPago: '', dataPagamento: '', meioPagamento: '', observacoes: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    },
  });

  // Corrige clique errado em "Marcar como Pago": volta a mensalidade para
  // pendente/atrasada (conforme o vencimento) e o servidor limpa data e meio
  // de pagamento. Sem isso o gestor só conseguiria corrigir direto no banco.
  const undoPaymentMutation = useMutation({
    mutationFn: (payment: Payment) =>
      apiClient.updatePayment(payment.id, {
        status: isOverdue(payment.dueDate) ? 'overdue' : 'pending',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      toast({
        title: 'Pagamento desfeito',
        description: 'A mensalidade voltou para a lista de cobranças e saiu da receita do mês.',
      });
      setIsUndoConfirmOpen(false);
      setDetailPayment(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao desfazer pagamento', description: error.message, variant: 'destructive' });
    },
  });

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(priceInCents / 100);
  };

  // Dívida acumulada por aluno — contagem para o badge, meses + valor total
  // para o tooltip (a pergunta do gestor na cobrança é "quanto", não só "quantas")
  const overdueCountByStudent = new Map<string, number>();
  const overdueTooltipByStudent = new Map<string, string>();
  {
    const acc = new Map<string, { totalCents: number; dates: Date[] }>();
    for (const p of paymentsData ?? []) {
      if (p.status !== 'overdue') continue;
      const entry = acc.get(p.studentId) ?? { totalCents: 0, dates: [] };
      entry.totalCents += p.amount;
      entry.dates.push(new Date(p.dueDate));
      acc.set(p.studentId, entry);
    }
    for (const [studentId, entry] of acc) {
      overdueCountByStudent.set(studentId, entry.dates.length);
      const meses = entry.dates
        .sort((a, b) => a.getTime() - b.getTime())
        .map(d => formatMonthYear(d))
        .join(', ');
      overdueTooltipByStudent.set(studentId, `${meses} — ${formatPrice(entry.totalCents)} no total`);
    }
  }

  const payments: PaymentRecord[] = (paymentsData ?? []).map(p => {
    const student = studentsData?.find(s => s.id === p.studentId);
    const plan = plansData?.find(pl => pl.id === p.membershipPlanId);
    return {
      id: p.id,
      studentId: p.studentId,
      aluno: student?.name ?? 'Aluno',
      plano: plan?.name ?? 'Plano',
      vencimento: formatDateOnly(p.dueDate),
      vencimentoMs: new Date(p.dueDate).getTime(),
      status: computeStatus(p),
      dataPagamento: p.paidDate ? formatDateOnly(p.paidDate) : '-',
      meioPagamento: p.paymentMethod ?? '',
      valor: p.amount,
      atrasosDoAluno: overdueCountByStudent.get(p.studentId) ?? 0,
    };
  });

  // Meses ofertados no filtro de período — só os que existem nos vencimentos,
  // mais recente primeiro (ir a "março" é 1 clique, não rolagem)
  const availableMonths = [...new Set(payments.map(p => monthKeyOf(p.vencimentoMs)))]
    .sort()
    .reverse();

  // Período não se aplica em Atrasados: inadimplência é dívida acumulada —
  // filtrar por mês esconderia a mensalidade antiga que originou o débito
  const periodApplied = periodFilter !== 'todos' && activeFilter !== 'atrasados';

  // KPIs acompanham o período selecionado (a tela conta uma história só):
  // sem período = comportamento clássico (caixa do mês corrente + a receber
  // total); com período = competência (mensalidades daquele mês)
  const now = new Date();
  const receitaMesCorrente = (paymentsData ?? [])
    .filter(p => {
      if (p.status !== 'paid' || !p.paidDate) return false;
      const paid = new Date(p.paidDate);
      return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const periodPaymentsAll = periodFilter !== 'todos'
    ? payments.filter(p => monthKeyOf(p.vencimentoMs) === periodFilter)
    : payments;

  const receita = periodFilter === 'todos'
    ? receitaMesCorrente
    : periodPaymentsAll.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.valor, 0);

  const aReceber = periodPaymentsAll
    .filter(p => p.status !== 'pago')
    .reduce((sum, p) => sum + p.valor, 0);

  const periodLabel = periodFilter !== 'todos' ? monthLabelOf(periodFilter) : null;

  // Alunos distintos — um aluno pode ter mais de uma mensalidade em atraso,
  // e o card promete "Nº de alunos" (alinha com o chip da lista de Alunos)
  const inadimplentes = new Set(
    (paymentsData ?? []).filter(p => p.status === 'overdue').map(p => p.studentId)
  ).size;

  const searchNorm = normalizeSearch(searchTerm.trim());
  const searchedPayments = searchNorm
    ? payments.filter(p => normalizeSearch(p.aluno).includes(searchNorm))
    : payments;

  const periodFilteredPayments = periodApplied
    ? searchedPayments.filter(p => monthKeyOf(p.vencimentoMs) === periodFilter)
    : searchedPayments;

  const filteredPayments = periodFilteredPayments.filter(payment => {
    switch (activeFilter) {
      case 'pagos': return payment.status === 'pago';
      case 'atrasados': return payment.status === 'atrasado';
      case 'proximos': return payment.status === 'proximo';
      default: return true;
    }
  });

  // Atrasados: visão agrupada por devedor (um aluno por linha, mensalidades ao
  // expandir) — com dezenas de inadimplentes a tabela plana intercala os meses
  // de alunos diferentes. Ordena pela dívida mais antiga; dentro do aluno,
  // mais antiga primeiro, para quitar na ordem certa.
  const debtorGroups: DebtorGroup[] = [];
  if (activeFilter === 'atrasados') {
    const byStudent = new Map<string, DebtorGroup>();
    for (const p of filteredPayments) {
      let group = byStudent.get(p.studentId);
      if (!group) {
        group = { studentId: p.studentId, aluno: p.aluno, payments: [], totalCents: 0, oldestMs: Infinity };
        byStudent.set(p.studentId, group);
        debtorGroups.push(group);
      }
      group.payments.push(p);
      group.totalCents += p.valor;
      group.oldestMs = Math.min(group.oldestMs, p.vencimentoMs);
    }
    for (const group of debtorGroups) group.payments.sort((a, b) => a.vencimentoMs - b.vencimentoMs);
    debtorGroups.sort((a, b) => a.oldestMs - b.oldestMs);
  }

  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  };

  // ── Relatórios: sempre sobre o que está na tela (período + status + busca) ──

  // Em Atrasados, segue a ordem da visão agrupada (devedor mais antigo primeiro)
  const reportRows = activeFilter === 'atrasados'
    ? debtorGroups.flatMap(g => g.payments)
    : filteredPayments;

  const reportTotalCents = reportRows.reduce((sum, r) => sum + r.valor, 0);

  const FILTER_LABELS: Record<FilterType, string> = {
    todos: 'Todos os status',
    pagos: 'Pagos',
    atrasados: 'Atrasados (dívida acumulada)',
    proximos: 'Próximos ao Vencimento',
  };

  const reportPeriodLabel = periodApplied
    ? monthLabelCapOf(periodFilter)
    : 'Todos os meses';

  // Fechamento por meio de pagamento (só pagos do recorte) — dado que o
  // gestor não vê em nenhum outro lugar do app
  const paidByMethod = new Map<string, { count: number; totalCents: number }>();
  for (const r of reportRows) {
    if (r.status !== 'pago') continue;
    const key = r.meioPagamento || 'Não informado';
    const entry = paidByMethod.get(key) ?? { count: 0, totalCents: 0 };
    entry.count += 1;
    entry.totalCents += r.valor;
    paidByMethod.set(key, entry);
  }

  const handleExportCsv = () => {
    if (reportRows.length === 0) {
      toast({ title: 'Nada para exportar', description: 'Nenhuma mensalidade no filtro atual.', variant: 'destructive' });
      return;
    }
    // Excel pt-BR: BOM para acentuação + ";" como separador (vírgula é decimal)
    const BOM = '\u{FEFF}';
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Aluno', 'Plano', 'Vencimento', 'Status', 'Data do Pagamento', 'Meio de Pagamento', 'Valor (R$)'];
    const lines = reportRows.map(r => [
      r.aluno,
      r.plano,
      r.vencimento,
      STATUS_LABELS[r.status],
      r.dataPagamento === '-' ? '' : r.dataPagamento,
      r.meioPagamento,
      (r.valor / 100).toFixed(2).replace('.', ','),
    ]);
    const csv = BOM + [header, ...lines].map(row => row.map(esc).join(';')).join('\r\n');

    const period = periodApplied ? periodFilter : 'todos-os-meses';
    const suffix = activeFilter !== 'todos' ? `-${activeFilter}` : '';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${period}${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: `${reportRows.length} mensalidade${reportRows.length > 1 ? 's' : ''} — abra no Excel.` });
  };

  const handlePrintReport = () => {
    if (reportRows.length === 0) {
      toast({ title: 'Nada para imprimir', description: 'Nenhuma mensalidade no filtro atual.', variant: 'destructive' });
      return;
    }
    // Deixa o dropdown fechar antes de congelar a página no diálogo de impressão
    setTimeout(() => window.print(), 150);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pago: { label: 'Pago', className: 'status-pago bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      atrasado: { label: 'Atrasado', className: 'status-atrasado bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      proximo: { label: 'Próximo', className: 'status-proximo bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      pendente: { label: 'Pendente', className: 'status-pendente bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant="secondary" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleMarcarPago = (id: string) => {
    const rawPayment = paymentsData?.find(p => p.id === id);
    if (rawPayment) {
      setSelectedPaymentId(id);
      setPaymentForm({
        valorPago: (rawPayment.amount / 100).toFixed(2),
        dataPagamento: new Date().toISOString().split('T')[0],
        meioPagamento: '',
        observacoes: ''
      });
      setIsPaymentModalOpen(true);
    }
  };

  const handleSavePayment = () => {
    if (!paymentForm.valorPago || !paymentForm.dataPagamento || !paymentForm.meioPagamento) {
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    const amountCents = Math.round(parseFloat(paymentForm.valorPago.replace(',', '.')) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast({
        title: "Erro de validação",
        description: "Informe um valor pago válido.",
        variant: "destructive",
      });
      return;
    }
    updatePaymentMutation.mutate({
      id: selectedPaymentId!,
      data: {
        status: 'paid',
        paidDate: paymentForm.dataPagamento,
        paymentMethod: paymentForm.meioPagamento,
        amount: amountCents,
        notes: paymentForm.observacoes || undefined,
      },
    });
  };

  const handleCancelPayment = () => {
    setIsPaymentModalOpen(false);
    setSelectedPaymentId(null);
    setPaymentForm({
      valorPago: '',
      dataPagamento: '',
      meioPagamento: '',
      observacoes: ''
    });
  };

  return (
    <div className="max-w-none w-full space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Controle Financeiro</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie pagamentos, mensalidades e acompanhe a saúde financeira da academia
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDueDayInput(String(billingSettings?.paymentDueDay ?? 5));
            setIsDueDayDialogOpen(true);
          }}
          data-testid="button-due-day-settings"
        >
          <CalendarClock className="h-4 w-4 mr-2" />
          Vencimento padrão: dia {billingSettings?.paymentDueDay ?? 5}
        </Button>
      </div>

      {/* Dialog: dia de vencimento das mensalidades */}
      <Dialog open={isDueDayDialogOpen} onOpenChange={setIsDueDayDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Dia de vencimento padrão das mensalidades</DialogTitle>
            <DialogDescription>
              Vale para os alunos que não têm um dia de vencimento próprio escolhido no
              cadastro — quem escolheu um dia individual não é afetado. Use um dia entre
              1 e 28 para que exista em todos os meses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="due-day">Dia do mês</Label>
            <Input
              id="due-day"
              type="number"
              min={1}
              max={28}
              value={dueDayInput}
              onChange={e => setDueDayInput(e.target.value)}
              data-testid="input-due-day"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDueDayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDueDay} disabled={updateDueDayMutation.isPending} data-testid="button-save-due-day">
              {updateDueDayMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="kpi-receita-titulo">
              {periodLabel ? `Receita de ${periodLabel}` : 'Receita do Mês (Pago)'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="kpi-receita-valor">
              {formatPrice(receita)}
            </div>
            <p className="text-xs text-muted-foreground">
              {periodLabel ? 'Mensalidades do período pagas' : 'Pagamentos confirmados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="kpi-areceber-titulo">
              {periodLabel ? `A Receber de ${periodLabel}` : 'A Receber (Pendente + Atrasado)'}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="kpi-areceber-valor">
              {formatPrice(aReceber)}
            </div>
            <p className="text-xs text-muted-foreground">
              {periodLabel ? 'Mensalidades do período em aberto' : 'Aguardando pagamento'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inadimplentes (Nº de alunos)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {inadimplentes}
            </div>
            <p className="text-xs text-muted-foreground">
              Alunos com atraso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 mr-4">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>

        <Button
          variant={activeFilter === 'todos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('todos')}
          data-testid="filter-todos"
        >
          Todos
        </Button>

        <Button
          variant={activeFilter === 'pagos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('pagos')}
          data-testid="filter-pagos"
        >
          🟢 Pagos
        </Button>

        <Button
          variant={activeFilter === 'atrasados' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('atrasados')}
          data-testid="filter-atrasados"
        >
          🔴 Atrasados
        </Button>

        <Button
          variant={activeFilter === 'proximos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveFilter('proximos')}
          data-testid="filter-proximos"
        >
          🟡 Próximos ao Vencimento
        </Button>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger
            className={cn("w-[180px] h-9", periodFilter !== 'todos' && "border-primary")}
            data-testid="select-periodo"
          >
            <span className={cn("truncate text-sm", periodFilter === 'todos' && "text-muted-foreground")}>
              {periodFilter === 'todos' ? 'Período: todos' : monthLabelCapOf(periodFilter)}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {availableMonths.map(key => (
              <SelectItem key={key} value={key}>
                {monthLabelCapOf(key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar aluno..."
            className="pl-8 h-9"
            data-testid="input-search-financeiro"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-relatorio">
              <FileText className="h-4 w-4 mr-2" />
              Relatório
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCsv} data-testid="menu-export-csv">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar CSV (Excel)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrintReport} data-testid="menu-print-pdf">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / Salvar PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Período selecionado + filtro Atrasados: avisa que a dívida acumulada ignora o mês */}
      {activeFilter === 'atrasados' && periodFilter !== 'todos' && (
        <p className="text-xs text-muted-foreground -mt-4" data-testid="aviso-periodo-atrasados">
          O filtro de período não se aplica em Atrasados — a visão de inadimplência considera a dívida acumulada de todos os meses.
        </p>
      )}

      {/* Financial Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Controle de Pagamentos
          </CardTitle>
          <CardDescription>
            Acompanhe o status dos pagamentos de todos os alunos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            Mobile: lista de cards empilhados — em tela estreita a tabela larga
            forçava scroll horizontal escondendo Status, Valor e o botão de ação.
            Cada linha vira um card com hierarquia visual (quem/estado → contexto
            → valor → ação em largura total, alvo de toque adequado).
          */}
          <div className="md:hidden space-y-3">
            {isLoadingPayments ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <div className="text-sm text-muted-foreground">Carregando pagamentos...</div>
              </div>
            ) : activeFilter === 'atrasados' ? (
              debtorGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground text-center">
                    {searchNorm
                      ? 'Nenhum aluno inadimplente encontrado para a busca'
                      : 'Nenhuma mensalidade em atraso — todos em dia! 🎉'}
                  </div>
                </div>
              ) : (
                debtorGroups.map(group => {
                  const expanded = expandedStudents.has(group.studentId);
                  return (
                    <div
                      key={group.studentId}
                      className="rounded-lg border bg-card overflow-hidden"
                      data-testid={`card-debtor-${group.studentId}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleStudent(group.studentId)}
                        aria-expanded={expanded ? 'true' : 'false'}
                        className="w-full p-3 text-left space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-medium min-w-0">
                            {expanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />}
                            <span className="truncate">{group.aluno}</span>
                          </span>
                          <Badge
                            variant="outline"
                            className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-400 whitespace-nowrap gap-1 shrink-0"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {group.payments.length} em atraso
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2 pl-[22px]">
                          <span className="font-mono font-semibold text-red-700 dark:text-red-400">
                            {formatPrice(group.totalCents)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            desde {formatDateOnly(group.oldestMs)}
                          </span>
                        </div>
                      </button>
                      {expanded && (
                        <div className="border-t divide-y bg-muted/40">
                          {group.payments.map(payment => (
                            <div key={payment.id} className="p-3 space-y-2" data-testid={`card-payment-${payment.id}`}>
                              <div className="flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate">
                                  <span className="font-medium">{payment.vencimento}</span>
                                  <span className="text-muted-foreground"> · {payment.plano}</span>
                                </span>
                                <span className="font-mono shrink-0">{formatPrice(payment.valor)}</span>
                              </div>
                              <Button
                                variant="default"
                                className="w-full btn-marcar-pago"
                                onClick={() => handleMarcarPago(payment.id)}
                                data-testid={`button-card-mark-paid-${payment.id}`}
                              >
                                Marcar como Pago
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm text-muted-foreground text-center">
                  Nenhum registro encontrado para o filtro selecionado
                </div>
              </div>
            ) : (
              filteredPayments.map(payment => (
                <div
                  key={payment.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                  data-testid={`card-payment-${payment.id}`}
                >
                  {/* Quem + estado — a decisão de relance */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium min-w-0 flex-wrap">
                      <span className="truncate">{payment.aluno}</span>
                      {/* Nunca numa linha paga: "Pago" + "em atraso" se contradizem.
                          A dívida do aluno aparece nas linhas em aberto e em Atrasados. */}
                      {payment.status !== 'pago' &&
                        (payment.atrasosDoAluno >= 2 ||
                          (payment.atrasosDoAluno >= 1 && payment.status !== 'atrasado')) && (
                        <Badge
                          variant="outline"
                          className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-400 whitespace-nowrap gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          {payment.atrasosDoAluno} em atraso
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0">{getStatusBadge(payment.status)}</span>
                  </div>

                  {/* Contexto secundário */}
                  <div className="text-sm text-muted-foreground truncate">
                    {payment.plano} · vence {payment.vencimento}
                  </div>

                  {/* O número que importa + quando foi pago */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{formatPrice(payment.valor)}</span>
                    {payment.dataPagamento !== '-' && (
                      <span className="text-xs text-muted-foreground">
                        pago em {payment.dataPagamento}
                      </span>
                    )}
                  </div>

                  {/* Ação em largura total — alvo de toque adequado */}
                  {payment.status === 'pago' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setDetailPayment(paymentsData?.find(p => p.id === payment.id) ?? null)}
                      data-testid={`button-card-details-${payment.id}`}
                    >
                      Ver Detalhes
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      className="w-full btn-marcar-pago"
                      onClick={() => handleMarcarPago(payment.id)}
                      data-testid={`button-card-mark-paid-${payment.id}`}
                    >
                      Marcar como Pago
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop: tabelas originais (intactas) */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[640px]">
          {activeFilter === 'atrasados' ? (
          /*
            Visão agrupada por devedor: com dezenas de inadimplentes, a tabela
            plana intercala os meses de alunos diferentes. Uma linha por aluno
            (total + idade da dívida); expandir lista as mensalidades, mais
            antiga primeiro, cada uma com seu "Marcar como Pago".
          */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Total devido</TableHead>
                <TableHead>Em atraso desde</TableHead>
                <TableHead className="text-right">Mensalidades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtorGroups.map(group => {
                const expanded = expandedStudents.has(group.studentId);
                return (
                  <Fragment key={group.studentId}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggleStudent(group.studentId)}
                      aria-expanded={expanded}
                      data-testid={`row-debtor-${group.studentId}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {expanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />}
                          <span>{group.aluno}</span>
                          <Badge
                            variant="outline"
                            className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-400 whitespace-nowrap gap-1"
                            data-testid={`badge-debtor-${group.studentId}`}
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {group.payments.length} em atraso
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-red-700 dark:text-red-400">
                        {formatPrice(group.totalCents)}
                      </TableCell>
                      <TableCell>{formatDateOnly(group.oldestMs)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {expanded ? 'Recolher' : `Ver ${group.payments.length} mensalidade${group.payments.length > 1 ? 's' : ''}`}
                      </TableCell>
                    </TableRow>
                    {expanded && group.payments.map(payment => (
                      <TableRow key={payment.id} className="bg-muted/40" data-testid={`row-payment-${payment.id}`}>
                        <TableCell className="pl-11">
                          <span className="font-medium">{payment.vencimento}</span>
                          <span className="text-muted-foreground"> · {payment.plano}</span>
                        </TableCell>
                        <TableCell className="font-mono">{formatPrice(payment.valor)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            className="btn-marcar-pago"
                            onClick={() => handleMarcarPago(payment.id)}
                            data-testid={`button-mark-paid-${payment.id}`}
                          >
                            Marcar como Pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
              {!isLoadingPayments && debtorGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        {searchNorm
                          ? 'Nenhum aluno inadimplente encontrado para a busca'
                          : 'Nenhuma mensalidade em atraso — todos em dia! 🎉'}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {isLoadingPayments && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <div className="text-sm text-muted-foreground">Carregando pagamentos...</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data do Pagamento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{payment.aluno}</span>
                      {/*
                        Dívida acumulada: só quando acrescenta informação além da
                        própria linha — 2+ atrasos, ou 1 atraso visto de uma linha
                        que não é a atrasada (na única linha atrasada do aluno, a
                        coluna Status já comunica). Nunca numa linha paga: "Pago" +
                        "em atraso" se contradizem (a dívida do aluno segue visível
                        nas linhas em aberto e na visão de Atrasados). Outline (não
                        sólido) para não competir com o chip de Status; tooltip
                        responde "quanto".
                      */}
                      {payment.status !== 'pago' &&
                        (payment.atrasosDoAluno >= 2 ||
                          (payment.atrasosDoAluno >= 1 && payment.status !== 'atrasado')) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="border-red-300 text-red-700 dark:border-red-800 dark:text-red-400 whitespace-nowrap gap-1 cursor-default"
                              data-testid={`badge-atrasos-${payment.id}`}
                            >
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                              {payment.atrasosDoAluno} em atraso
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {overdueTooltipByStudent.get(payment.studentId)}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{payment.plano}</TableCell>
                  <TableCell>{payment.vencimento}</TableCell>
                  <TableCell>
                    {getStatusBadge(payment.status)}
                  </TableCell>
                  <TableCell>
                    {payment.dataPagamento === '-' ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      payment.dataPagamento
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatPrice(payment.valor)}
                  </TableCell>
                  <TableCell className="text-right">
                    {payment.status === 'pago' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailPayment(paymentsData?.find(p => p.id === payment.id) ?? null)}
                        data-testid={`button-details-${payment.id}`}
                      >
                        Ver Detalhes
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="btn-marcar-pago"
                        onClick={() => handleMarcarPago(payment.id)}
                        data-testid={`button-mark-paid-${payment.id}`}
                      >
                        Marcar como Pago
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoadingPayments && filteredPayments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                      <div className="text-sm text-muted-foreground">
                        Nenhum registro encontrado para o filtro selecionado
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {isLoadingPayments && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      <div className="text-sm text-muted-foreground">Carregando pagamentos...</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Registration Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="modal-content max-w-md">
          <DialogHeader>
            <DialogTitle>
              <h2>Registrar Pagamento</h2>
            </DialogTitle>
            <DialogDescription>
              Registre o pagamento do aluno selecionado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Valor Pago */}
            <div className="grid gap-2">
              <Label htmlFor="valorPago">Valor Pago (R$) *</Label>
              <Input
                id="valorPago"
                type="number"
                step="0.01"
                value={paymentForm.valorPago}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, valorPago: e.target.value }))}
                placeholder="0.00"
                data-testid="input-payment-amount"
              />
            </div>

            {/* Data do Pagamento */}
            <div className="grid gap-2">
              <Label htmlFor="dataPagamento">Data do Pagamento *</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={paymentForm.dataPagamento}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, dataPagamento: e.target.value }))}
                data-testid="input-payment-date"
              />
            </div>

            {/* Meio de Pagamento */}
            <div className="grid gap-2">
              <Label htmlFor="meioPagamento">Meio de Pagamento *</Label>
              <Select
                value={paymentForm.meioPagamento}
                onValueChange={(value) => setPaymentForm(prev => ({ ...prev, meioPagamento: value }))}
              >
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="Selecione o meio de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={paymentForm.observacoes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações adicionais sobre o pagamento..."
                className="min-h-[80px]"
                data-testid="textarea-payment-notes"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancelPayment}
              data-testid="button-cancel-payment"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSavePayment}
              disabled={updatePaymentMutation.isPending}
              data-testid="button-save-payment"
            >
              <Save className="h-4 w-4 mr-2" />
              {updatePaymentMutation.isPending ? 'Salvando...' : 'Salvar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Modal */}
      <Dialog open={!!detailPayment} onOpenChange={(open) => !open && setDetailPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
            <DialogDescription>Informações do pagamento registrado</DialogDescription>
          </DialogHeader>
          {detailPayment && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Aluno</span>
                <span className="font-medium text-right">
                  {studentsData?.find(s => s.id === detailPayment.studentId)?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium text-right">
                  {plansData?.find(pl => pl.id === detailPayment.membershipPlanId)?.name ?? '—'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-mono font-medium">{formatPrice(detailPayment.amount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Vencimento</span>
                <span>{formatDateOnly(detailPayment.dueDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Data do pagamento</span>
                <span>{detailPayment.paidDate ? formatDateOnly(detailPayment.paidDate) : '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Meio de pagamento</span>
                <span>{detailPayment.paymentMethod ?? '—'}</span>
              </div>
              {detailPayment.notes && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Observações</span>
                  <p className="rounded-md bg-muted p-2">{detailPayment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {detailPayment?.status === 'paid' && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsUndoConfirmOpen(true)}
                data-testid="button-undo-payment"
              >
                <Undo2 className="h-4 w-4 mr-2" />
                Desfazer pagamento
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailPayment(null)} data-testid="button-close-details">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação do desfazer — mexe na receita do mês, não pode ser um clique só */}
      <AlertDialog open={isUndoConfirmOpen} onOpenChange={setIsUndoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer este pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensalidade de{' '}
              <strong>
                {studentsData?.find(s => s.id === detailPayment?.studentId)?.name ?? 'aluno'}
              </strong>{' '}
              ({detailPayment ? formatPrice(detailPayment.amount) : ''}) voltará a constar como{' '}
              {detailPayment && isOverdue(detailPayment.dueDate) ? 'atrasada' : 'pendente'}.
              A data e o meio de pagamento registrados serão apagados e o valor sairá da receita do mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-undo">Manter como pago</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={undoPaymentMutation.isPending}
              onClick={(e) => {
                // Radix fecha o AlertDialog no clique; segura aberto até a API
                // responder para o erro não passar despercebido
                e.preventDefault();
                if (detailPayment) undoPaymentMutation.mutate(detailPayment);
              }}
              data-testid="button-confirm-undo"
            >
              {undoPaymentMutation.isPending ? 'Desfazendo...' : 'Desfazer pagamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        Relatório imprimível — portal direto no <body> para escapar dos
        contêineres com overflow do layout (que cortam a impressão na 1ª página).
        Invisível na tela; o CSS de @media print em index.css esconde o app e
        exibe só este bloco. "Salvar como PDF" do navegador gera o arquivo.
      */}
      {createPortal(
        <div id="print-financeiro" aria-hidden="true">
          <h1>Relatório Financeiro</h1>
          <p className="print-sub">
            {user?.academy?.name ? `${user.academy.name} — ` : ''}
            {reportPeriodLabel}
            {activeFilter !== 'todos' ? ` · ${FILTER_LABELS[activeFilter]}` : ''}
            {searchTerm.trim() ? ` · busca: "${searchTerm.trim()}"` : ''}
          </p>
          <p className="print-sub">
            Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <div className="print-kpis">
            <div>
              <span className="print-kpi-label">
                {periodLabel ? `Receita de ${periodLabel}` : 'Receita do mês corrente'}
              </span>
              <span className="print-kpi-value">{formatPrice(receita)}</span>
            </div>
            <div>
              <span className="print-kpi-label">
                {periodLabel ? `A receber de ${periodLabel}` : 'A receber (total)'}
              </span>
              <span className="print-kpi-value">{formatPrice(aReceber)}</span>
            </div>
            <div>
              <span className="print-kpi-label">Alunos inadimplentes</span>
              <span className="print-kpi-value">{inadimplentes}</span>
            </div>
          </div>

          {paidByMethod.size > 0 && (
            <>
              <h2>Fechamento por meio de pagamento</h2>
              <table>
                <thead>
                  <tr><th>Meio</th><th>Mensalidades</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {[...paidByMethod.entries()].sort((a, b) => b[1].totalCents - a[1].totalCents).map(([meio, e]) => (
                    <tr key={meio}>
                      <td>{meio}</td>
                      <td>{e.count}</td>
                      <td>{formatPrice(e.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h2>Mensalidades ({reportRows.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Aluno</th><th>Plano</th><th>Vencimento</th><th>Status</th>
                <th>Pagamento</th><th>Meio</th><th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map(r => (
                <tr key={r.id}>
                  <td>{r.aluno}</td>
                  <td>{r.plano}</td>
                  <td>{r.vencimento}</td>
                  <td>{STATUS_LABELS[r.status]}</td>
                  <td>{r.dataPagamento === '-' ? '—' : r.dataPagamento}</td>
                  <td>{r.meioPagamento || '—'}</td>
                  <td>{formatPrice(r.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>Total do recorte</td>
                <td>{formatPrice(reportTotalCents)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="print-footer">Fight Club App — Controle Financeiro</p>
        </div>,
        document.body
      )}
    </div>
  );
}
