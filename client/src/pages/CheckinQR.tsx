import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface QrTokenResponse {
  token: string;
  expiresInSeconds: number;
}

/**
 * Tela de QR Code para a recepção — pensada para ficar aberta num tablet/TV.
 * O token renova sozinho (refetch a cada 30s, slots de 60s no servidor), então
 * uma foto do código expira em ~2 minutos e não vale como check-in remoto.
 */
export default function CheckinQR() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<QrTokenResponse>({
    queryKey: ['/api/checkin/qr-token'],
    queryFn: () => apiRequest('GET', '/api/checkin/qr-token').then(r => r.json()),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const checkinUrl = data
    ? `${window.location.origin}/portal/checkin?t=${data.token}`
    : null;

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
            Deixe esta tela aberta na recepção para os alunos registrarem presença
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
          {user?.academy?.name && (
            <p className="text-lg font-semibold">{user.academy.name}</p>
          )}

          {isLoading && (
            <div className="h-[288px] w-[288px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {isError && (
            <div className="h-[288px] w-[288px] flex items-center justify-center text-center">
              <p className="text-sm text-destructive">
                Não foi possível gerar o QR Code. Verifique a conexão.
              </p>
            </div>
          )}

          {checkinUrl && (
            <div className="rounded-xl border bg-white p-4" data-testid="checkin-qr">
              {/* Fundo branco fixo: QR precisa de contraste mesmo no dark mode */}
              <QRCodeSVG value={checkinUrl} size={256} marginSize={0} />
            </div>
          )}

          <div className="text-center space-y-1">
            <p className="font-medium">Aponte a câmera do celular para o código</p>
            <p className="text-sm text-muted-foreground">
              O aluno confirma a presença no Portal do Aluno — sem fila, sem papel.
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-2">
              <RefreshCw className="h-3 w-3" />
              O código renova automaticamente a cada minuto
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
