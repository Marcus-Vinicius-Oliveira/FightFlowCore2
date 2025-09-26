import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStudentDialog({ open, onOpenChange }: AddStudentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<StudentCreateFormData>({
    resolver: zodResolver(studentCreateFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      dateOfBirth: "",
      belt: "",
    },
  });

  const createStudentMutation = useMutation({
    mutationFn: (data: StudentCreateFormData) => apiRequest('POST', '/api/students', data),
    onSuccess: () => {
      // Invalidate all relevant caches using centralized helper
      invalidateAfterStudentChange(queryClient);
      
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
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Adicionar Novo Aluno
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Crie uma nova conta de aluno para sua academia de artes marciais.
          </p>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
              type="date"
              {...form.register("dateOfBirth")}
              data-testid="input-student-birthdate"
            />
            {form.formState.errors.dateOfBirth && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dateOfBirth.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-belt">Graduação/Faixa (Opcional)</Label>
            <Input
              id="student-belt"
              {...form.register("belt")}
              placeholder="Faixa Branca, 1º Kyu, etc."
              data-testid="input-student-belt"
            />
            {form.formState.errors.belt && (
              <p className="text-sm text-destructive">
                {form.formState.errors.belt.message}
              </p>
            )}
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

          <DialogFooter className="mt-6 space-x-2">
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}