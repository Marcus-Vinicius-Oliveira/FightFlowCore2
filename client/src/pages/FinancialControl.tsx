import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  DollarSign, 
  Clock,
  AlertTriangle,
  TrendingUp,
  Filter,
  Save,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentRecord {
  id: string;
  aluno: string;
  plano: string;
  vencimento: string;
  status: 'pago' | 'atrasado' | 'proximo' | 'pendente';
  dataPagamento: string;
  valor: number;
}

type FilterType = 'todos' | 'pagos' | 'atrasados' | 'proximos';

export default function FinancialControl() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    valorPago: '',
    dataPagamento: '',
    meioPagamento: '',
    observacoes: ''
  });
  const { toast } = useToast();

  // Sample financial data
  const payments: PaymentRecord[] = [
    {
      id: "1",
      aluno: "João Silva",
      plano: "Faixa Preta",
      vencimento: "20/09/2025",
      status: "atrasado",
      dataPagamento: "-",
      valor: 14900 // R$ 149,00 in cents
    },
    {
      id: "2", 
      aluno: "Maria Oliveira",
      plano: "Faixa Branca",
      vencimento: "30/09/2025",
      status: "proximo",
      dataPagamento: "-",
      valor: 7900 // R$ 79,00 in cents
    },
    {
      id: "3",
      aluno: "Carlos Souza", 
      plano: "Faixa Azul",
      vencimento: "10/10/2025",
      status: "pendente",
      dataPagamento: "-",
      valor: 25000 // R$ 250,00 in cents
    },
    {
      id: "4",
      aluno: "Ana Pereira",
      plano: "Faixa Preta", 
      vencimento: "05/09/2025",
      status: "pago",
      dataPagamento: "04/09/2025",
      valor: 14900 // R$ 149,00 in cents
    }
  ];

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(priceInCents / 100);
  };

  // Calculate KPIs
  const receitaMes = payments
    .filter(p => p.status === 'pago')
    .reduce((sum, p) => sum + p.valor, 0);

  const aReceber = payments
    .filter(p => p.status !== 'pago')
    .reduce((sum, p) => sum + p.valor, 0);

  const inadimplentes = payments.filter(p => p.status === 'atrasado').length;

  // Filter payments based on active filter
  const filteredPayments = payments.filter(payment => {
    switch (activeFilter) {
      case 'pagos': return payment.status === 'pago';
      case 'atrasados': return payment.status === 'atrasado';
      case 'proximos': return payment.status === 'proximo';
      default: return true;
    }
  });

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
    const payment = payments.find(p => p.id === id);
    if (payment) {
      setSelectedPaymentId(id);
      setPaymentForm({
        valorPago: (payment.valor / 100).toFixed(2),
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

    // TODO: Implement actual payment saving logic
    console.log('Saving payment:', {
      id: selectedPaymentId,
      ...paymentForm
    });

    toast({
      title: "Pagamento registrado!",
      description: "O pagamento foi registrado com sucesso.",
    });

    setIsPaymentModalOpen(false);
    setSelectedPaymentId(null);
    setPaymentForm({
      valorPago: '',
      dataPagamento: '',
      meioPagamento: '',
      observacoes: ''
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
      <div>
        <h1 className="text-3xl font-bold">Controle Financeiro</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie pagamentos, mensalidades e acompanhe a saúde financeira da academia
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Mês (Pago)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(receitaMes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamentos confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber (Pendente + Atrasado)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatPrice(aReceber)}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando pagamento
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
      </div>

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
                  <TableCell className="font-medium">{payment.aluno}</TableCell>
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
              {filteredPayments.length === 0 && (
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
            </TableBody>
          </Table>
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
              data-testid="button-save-payment"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}