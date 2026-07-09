import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, QrCode, RefreshCw, Printer, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QrTokenResponse {
  token: string;
  expiresInSeconds: number;
}

interface QrStaticResponse {
  token: string;
}

function checkinUrl(token: string) {
  return `${window.location.origin}/portal/checkin?t=${token}`;
}

/**
 * Tela do QR de check-in, em dois modos:
 *
 * - Fixo (padrão): token versionado por academia — imprime e cola na entrada.
 *   "Gerar novo código" incrementa a versão no servidor e invalida os
 *   cartazes antigos.
 * - Dinâmico: token rotativo (slots de 60s) para deixar aberto num
 *   tablet/TV — uma foto do código expira em ~2min, garantindo presença
 *   física. Para academias que precisam do dado de presença mais confiável.
 */
export default function CheckinQR() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const staticQuery = useQuery<QrStaticResponse>({
    queryKey: ['/api/checkin/qr-static'],
    queryFn: () => apiRequest('GET', '/api/checkin/qr-static').then(r => r.json()),
  });

  const dynamicQuery = useQuery<QrTokenResponse>({
    queryKey: ['/api/checkin/qr-token'],
    queryFn: () => apiRequest('GET', '/api/checkin/qr-token').then(r => r.json()),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const regenerate = useMutation<QrStaticResponse, Error>({
    mutationFn: () => apiRequest('POST', '/api/checkin/qr-static/regenerate').then(r => r.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/checkin/qr-static'], data);
      toast({
        title: "Novo código gerado!",
        description: "Os QR Codes impressos anteriormente deixaram de funcionar. Imprima o novo.",
      });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Erro ao gerar novo código", description: err.message });
    },
  });

  // Impressão: abre uma janela só com o cartaz (nome da academia + QR +
  // instrução) — evita depender de CSS @media print no app inteiro.
  function handlePrint() {
    const svg = printRef.current?.querySelector('svg')?.outerHTML;
    if (!svg) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`<!doctype html>
<html><head><title>QR de Check-in</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; flex-direction: column;
         align-items: center; justify-content: center; min-height: 95vh; margin: 0; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  p.sub { color: #555; margin: 0 0 32px; font-size: 16px; }
  .qr svg { width: 380px; height: 380px; }
  p.hint { font-size: 20px; font-weight: 600; margin: 32px 0 4px; }
  p.hint2 { color: #555; font-size: 15px; margin: 0; }
</style></head>
<body>
  <h1>${user?.academy?.name ?? 'Check-in'}</h1>
  <p class="sub">Registro de presença</p>
  <div class="qr">${svg}</div>
  <p class="hint">Aponte a câmera do celular para o código</p>
  <p class="hint2">Confirme sua presença no Portal do Aluno antes da aula.</p>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/aulas')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <QrCode className="h-7 w-7" /> Check-in por QR Code
          </h1>
          <p className="text-muted-foreground mt-1">
            Alunos registram a própria presença escaneando o código
          </p>
        </div>
      </div>

      <Tabs defaultValue="fixo">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fixo" data-testid="tab-qr-fixo">
            <Printer className="h-4 w-4 mr-2" /> QR fixo (imprimir)
          </TabsTrigger>
          <TabsTrigger value="dinamico" data-testid="tab-qr-dinamico">
            <MonitorSmartphone className="h-4 w-4 mr-2" /> QR dinâmico (tela)
          </TabsTrigger>
        </TabsList>

        {/* ── QR fixo: imprime uma vez, cola na entrada ─────────────────────── */}
        <TabsContent value="fixo">
          <Card>
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
              {user?.academy?.name && (
                <p className="text-lg font-semibold">{user.academy.name}</p>
              )}

              {staticQuery.isLoading && (
                <div className="h-[288px] w-[288px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}

              {staticQuery.isError && (
                <div className="h-[288px] w-[288px] flex items-center justify-center text-center">
                  <p className="text-sm text-destructive">
                    Não foi possível carregar o QR Code. Verifique a conexão.
                  </p>
                </div>
              )}

              {staticQuery.data && (
                <div ref={printRef} className="rounded-xl border bg-white p-4" data-testid="checkin-qr-static">
                  {/* Fundo branco fixo: QR precisa de contraste mesmo no dark mode */}
                  <QRCodeSVG value={checkinUrl(staticQuery.data.token)} size={256} marginSize={0} />
                </div>
              )}

              <div className="text-center space-y-1">
                <p className="font-medium">Imprima e deixe na entrada da academia</p>
                <p className="text-sm text-muted-foreground">
                  O código não muda — só é substituído se você gerar um novo abaixo.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={handlePrint} disabled={!staticQuery.data} data-testid="button-print-qr">
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={regenerate.isPending}
                      data-testid="button-regenerate-qr"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" /> Gerar novo código
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Gerar um novo QR Code?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todos os QR Codes já impressos deixarão de funcionar imediatamente.
                        Use se o código vazou ou se você quer trocar por segurança —
                        depois, imprima e substitua o cartaz da entrada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => regenerate.mutate()}>
                        Gerar novo código
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── QR dinâmico: tela ligada na recepção, renova a cada minuto ───── */}
        <TabsContent value="dinamico">
          <Card>
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
              {user?.academy?.name && (
                <p className="text-lg font-semibold">{user.academy.name}</p>
              )}

              {dynamicQuery.isLoading && (
                <div className="h-[288px] w-[288px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}

              {dynamicQuery.isError && (
                <div className="h-[288px] w-[288px] flex items-center justify-center text-center">
                  <p className="text-sm text-destructive">
                    Não foi possível gerar o QR Code. Verifique a conexão.
                  </p>
                </div>
              )}

              {dynamicQuery.data && (
                <div className="rounded-xl border bg-white p-4" data-testid="checkin-qr">
                  <QRCodeSVG value={checkinUrl(dynamicQuery.data.token)} size={256} marginSize={0} />
                </div>
              )}

              <div className="text-center space-y-1">
                <p className="font-medium">Deixe esta tela aberta num tablet ou TV na recepção</p>
                <p className="text-sm text-muted-foreground">
                  Mais seguro que o QR impresso: uma foto do código expira em ~2 minutos,
                  então só quem está na academia consegue fazer check-in.
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-2">
                  <RefreshCw className="h-3 w-3" />
                  O código renova automaticamente a cada minuto — não serve para imprimir
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
