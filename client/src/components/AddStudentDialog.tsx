import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  studentCreateFormSchema,
  isMinor,
  GUARDIAN_RELATIONSHIPS,
  type StudentCreateFormData,
} from "../../../shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAfterStudentChange } from "@/lib/cache-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ─── Date mask helpers ────────────────────────────────────────────────────────

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);

  const d1 = digits.slice(0, 2);
  const d2 = digits.slice(2, 4);
  const d3 = digits.slice(4, 8);

  // Clamp day and month to valid ranges when the segment is complete
  const dd = d1.length === 2
    ? String(Math.max(1, Math.min(parseInt(d1, 10), 31))).padStart(2, '0')
    : d1;
  const mm = d2.length === 2
    ? String(Math.max(1, Math.min(parseInt(d2, 10), 12))).padStart(2, '0')
    : d2;

  if (digits.length === 0) return '';
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${d3}`;
}

function displayDateToISO(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pré-preenchimento — usado na conversão de lead ganho do Pipeline */
  initialValues?: {
    name?: string;
    phone?: string;
    classTypeIds?: string[];
  };
}

export function AddStudentDialog({ open, onOpenChange, initialValues }: AddStudentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClassTypeIds, setSelectedClassTypeIds] = useState<string[]>([]);
  const [birthDateDisplay, setBirthDateDisplay] = useState('');

  const { data: classTypes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/classes/class-types'],
    enabled: open,
  });

  const form = useForm<StudentCreateFormData>({
    resolver: zodResolver(studentCreateFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      dateOfBirth: "",
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
    },
  });

  // Pré-preenche na abertura quando vem de uma conversão de lead
  useEffect(() => {
    if (open && initialValues) {
      if (initialValues.name) form.setValue("name", initialValues.name);
      if (initialValues.phone) form.setValue("phone", initialValues.phone);
      if (initialValues.classTypeIds?.length) setSelectedClassTypeIds(initialValues.classTypeIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  // Menor de idade? Reage à digitação da data e controla a seção de responsável.
  const minor = isMinor(form.watch("dateOfBirth") || undefined);

  const createStudentMutation = useMutation({
    mutationFn: async (data: StudentCreateFormData) => {
      const res = await apiRequest('POST', '/api/students', data);
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: async (student) => {
      if (selectedClassTypeIds.length > 0) {
        await Promise.all(
          selectedClassTypeIds.map(classTypeId =>
            apiRequest('POST', `/api/students/${student.id}/modality-enrollments`, { classTypeId }).catch(() => null)
          )
        );
      }
      invalidateAfterStudentChange(queryClient);
      queryClient.invalidateQueries({ queryKey: ['/api/students/academy-modality-enrollments'] });
      setSelectedClassTypeIds([]);
      setBirthDateDisplay('');
      form.reset();
      onOpenChange(false);
      toast({
        title: "Aluno Adicionado",
        description: "Novo aluno foi adicionado com sucesso à sua academia.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao Adicionar Aluno",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    },
  });

  const handleSubmit = (data: StudentCreateFormData) => {
    // Responsável só é persistido para menor de idade; strings vazias viram undefined
    const clean = (s?: string | null) => (s?.trim() ? s.trim() : undefined);
    const minorNow = isMinor(data.dateOfBirth || undefined);
    createStudentMutation.mutate({
      ...data,
      guardianName: minorNow ? clean(data.guardianName) : undefined,
      guardianPhone: minorNow ? clean(data.guardianPhone) : undefined,
      guardianRelationship: minorNow ? clean(data.guardianRelationship) : undefined,
    });
  };

  const handleCancel = () => {
    setSelectedClassTypeIds([]);
    setBirthDateDisplay('');
    form.reset();
    onOpenChange(false);
  };

  const toggleClassType = (id: string, checked: boolean) => {
    setSelectedClassTypeIds(prev =>
      checked ? [...prev, id] : prev.filter(x => x !== id)
    );
  };

  // Garante que o estado reflita o array atual sem leituras de undefined
  const isSelected = (id: string) => selectedClassTypeIds.includes(id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        flex flex-col + max-h-[90dvh] permitem o footer sticky funcionar
        mesmo quando o teclado virtual reduz o viewport no mobile.
        p-0 + gap-0 sobrescreve o padding/gap padrão do grid do Shadcn.
      */}
      <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90dvh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="text-xl font-semibold">
            Adicionar Novo Aluno
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Crie uma nova conta de aluno para sua academia de artes marciais.
          </p>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Área de campos — rolável quando o teclado abre */}
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-name">Nome Completo</Label>
              <Input
                id="student-name"
                {...form.register("name")}
                placeholder="Nome completo do aluno"
                required
                data-testid="input-student-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-email">Email</Label>
              <Input
                id="student-email"
                type="email"
                {...form.register("email")}
                placeholder="aluno@email.com"
                required
                data-testid="input-student-email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-phone">Telefone (Opcional)</Label>
              <Input
                id="student-phone"
                {...form.register("phone")}
                placeholder="(11) 99999-9999"
                data-testid="input-student-phone"
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-birthdate">Data de Nascimento (Opcional)</Label>
              <Input
                id="student-birthdate"
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
                value={birthDateDisplay}
                onChange={e => {
                  const masked = maskDate(e.target.value);
                  setBirthDateDisplay(masked);
                  form.setValue("dateOfBirth", displayDateToISO(masked));
                }}
                data-testid="input-student-birthdate"
              />
              {form.formState.errors.dateOfBirth && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dateOfBirth.message}
                </p>
              )}
            </div>

            {minor && (
              <div className="space-y-4 rounded-md border border-primary/40 bg-primary/5 p-3">
                <p className="text-sm font-medium">
                  Responsável Legal{' '}
                  <span className="font-normal text-muted-foreground">
                    — obrigatório para menor de idade
                  </span>
                </p>

                <div className="space-y-2">
                  <Label htmlFor="guardian-name">Nome do Responsável</Label>
                  <Input
                    id="guardian-name"
                    {...form.register("guardianName")}
                    placeholder="Nome completo do responsável"
                    data-testid="input-guardian-name"
                  />
                  {form.formState.errors.guardianName && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.guardianName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guardian-phone">Telefone do Responsável</Label>
                  <Input
                    id="guardian-phone"
                    {...form.register("guardianPhone")}
                    placeholder="(11) 99999-9999"
                    data-testid="input-guardian-phone"
                  />
                  {form.formState.errors.guardianPhone && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.guardianPhone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guardian-relationship">Parentesco (Opcional)</Label>
                  {/* Select nativo — mesmo racional dos checkboxes acima (robusto em toque no mobile) */}
                  <select
                    id="guardian-relationship"
                    {...form.register("guardianRelationship")}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                    data-testid="select-guardian-relationship"
                  >
                    <option value="">Selecione…</option>
                    {GUARDIAN_RELATIONSHIPS.map(rel => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {classTypes.length > 0 && (
              <div className="space-y-2">
                <Label>Modalidades (Opcional)</Label>
                <div className="grid grid-cols-2 gap-1">
                  {classTypes.map(ct => (
                    /*
                      Checkbox NATIVO — elimina completamente o @radix-ui/react-checkbox
                      que lança "unknown runtime error" em eventos de toque no mobile
                      ao tentar acessar APIs de DOM de forma síncrona durante o toque.
                      accent-primary aplica a cor primária do tema no estado checked.
                    */
                    <label
                      key={ct.id}
                      htmlFor={`ct-${ct.id}`}
                      className="flex items-center gap-2.5 min-h-[44px] px-2 rounded-md cursor-pointer select-none hover:bg-muted/50 transition-colors"
                    >
                      <input
                        id={`ct-${ct.id}`}
                        type="checkbox"
                        checked={isSelected(ct.id)}
                        onChange={(e) => toggleClassType(ct.id, e.target.checked)}
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-sm leading-tight">{ct.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="student-due-day">Vencimento da Mensalidade</Label>
              {/* Select nativo — mesmo racional dos demais (robusto em toque no mobile).
                  setValueAs converte para número; vazio = padrão da academia. */}
              <select
                id="student-due-day"
                {...form.register("paymentDueDay", { setValueAs: v => (v === '' || v == null) ? null : Number(v) })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                data-testid="select-student-due-day"
              >
                <option value="">Padrão da academia</option>
                <option value="5">Dia 5 (início do mês)</option>
                <option value="15">Dia 15 (meados do mês)</option>
                <option value="25">Dia 25 (fim do mês)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="student-password">Senha Temporária</Label>
              <Input
                id="student-password"
                type="password"
                {...form.register("password")}
                placeholder="Aluno alterará no primeiro login"
                required
                data-testid="input-student-password"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* Footer fixo — nunca some quando o teclado virtual abre */}
          <div className="shrink-0 border-t bg-background px-6 py-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createStudentMutation.isPending}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createStudentMutation.isPending}
              data-testid="button-submit-student"
            >
              {createStudentMutation.isPending ? "Adicionando..." : "Adicionar Aluno"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
