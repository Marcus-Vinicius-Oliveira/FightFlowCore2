import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, QrCode, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

interface CheckinOption {
  classId: string;
  name: string;
  startTime: string;
  endTime: string;
  instructor?: string;
}

interface CheckinResponse {
  checkedIn?: boolean;
  alreadyCheckedIn?: boolean;
  className?: string;
  startTime?: string;
  endTime?: string;
  requiresChoice?: boolean;
  options?: CheckinOption[];
}

/**
 * Destino do QR Code da recepção: /portal/checkin?t=<token>.
 * O aluno escaneia com a câmera nativa do celular; se já estiver logado no
 * portal, a presença é registrada automaticamente. Turma ambígua (duas aulas
 * no mesmo horário) vira uma escolha de um toque.
 */
export default function PortalCheckin() {
  const [, navigate] = useLocation();

  // Token vem da query string; lido uma única vez no mount
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get('t') ?? '',
    []
  );

  const checkin = useMutation<CheckinResponse, Error, { token: string; classId?: string }>({
    mutationFn: (body) => apiRequest('POST', '/api/checkin', body).then(r => r.json()),
  });

  useEffect(() => {
    if (token) checkin.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const data = checkin.data;

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card>
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">

          {/* Sem token: aluno abriu a página direto, sem escanear */}
          {!token && (
            <>
              <QrCode className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-semibold text-lg">Check-in de presença</p>
                <p className="text-sm text-muted-foreground">
                  Para registrar sua presença, escaneie o QR Code na recepção
                  da academia com a câmera do celular.
                </p>
              </div>
            </>
          )}

          {token && checkin.isPending && (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">Registrando presença...</p>
            </>
          )}

          {/* Duas aulas na mesma janela: aluno escolhe com um toque */}
          {data?.requiresChoice && data.options && (
            <>
              <Clock className="h-12 w-12 text-primary" />
              <p className="font-semibold text-lg">Qual aula você vai fazer?</p>
              <div className="w-full space-y-2">
                {data.options.map(opt => (
                  <Button
                    key={opt.classId}
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                    disabled={checkin.isPending}
                    onClick={() => checkin.mutate({ token, classId: opt.classId })}
                    data-testid={`button-checkin-${opt.classId}`}
                  >
                    <span className="font-medium">{opt.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.startTime}–{opt.endTime}
                    </span>
                  </Button>
                ))}
              </div>
            </>
          )}

          {data?.checkedIn && (
            <>
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <div className="space-y-1">
                <p className="font-semibold text-xl" data-testid="text-checkin-success">
                  {data.alreadyCheckedIn ? 'Presença já registrada!' : 'Presença registrada!'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.className} · {data.startTime}–{data.endTime}
                </p>
                {!data.alreadyCheckedIn && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
                    Boa aula! 🥋
                  </p>
                )}
              </div>
            </>
          )}

          {checkin.isError && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-lg">Não foi possível registrar</p>
                <p className="text-sm text-muted-foreground" data-testid="text-checkin-error">
                  {checkin.error.message}
                </p>
              </div>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => navigate('/portal/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao portal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
