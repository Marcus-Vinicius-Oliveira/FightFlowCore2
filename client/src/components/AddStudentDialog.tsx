import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentCreateFormSchema, type StudentCreateFormData } from "../../../shared/schema";
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

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClassTypeIds, setSelectedClassTypeIds] = useState<string[]>([]);

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
    },
  });

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
    createStudentMutation.mutate(data);
  };

  const handleCancel = () => {
    setSelectedClassTypeIds([]);
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

            {/*
              Input nativo type="date" sem wrapper Shadcn para garantir que
              o seletor nativo do smartphone seja acionado corretamente.
            */}
            <div className="space-y-2">
              <Label htmlFor="student-birthdate">Data de Nascimento (Opcional)</Label>
              <input
                id="student-birthdate"
                type="date"
                {...form.register("dateOfBirth")}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                data-testid="input-student-birthdate"
              />
              {form.formState.errors.dateOfBirth && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dateOfBirth.message}
                </p>
              )}
            </div>

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
