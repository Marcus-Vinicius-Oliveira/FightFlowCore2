import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function ChangePasswordModal({ isOpen, onSuccess }: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [error, setError] = useState("");
  const { toast } = useToast();
  const { user: authUser, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const changePasswordMutation = useMutation({
    mutationFn: (passwordData: typeof formData) => apiClient.changePassword(passwordData),
    onSuccess: async () => {
      toast({
        title: "Senha Alterada!",
        description: "Sua senha foi alterada com sucesso. Agora você pode acessar o portal.",
      });
      
      // Clear form
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setError("");
      
      // Update firstAccess flag in user state and localStorage
      updateUser({ firstAccess: false });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      
      onSuccess();
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Erro ao Alterar Senha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("A nova senha deve ser diferente da senha atual");
      return;
    }

    changePasswordMutation.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError("");
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Primeiro Acesso
          </DialogTitle>
          <DialogDescription className="text-center">
            Por segurança, você precisa alterar sua senha no primeiro acesso.
            Escolha uma senha segura e fácil de lembrar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha Atual</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showPasswords.current ? "text" : "password"}
                placeholder="Digite sua senha atual"
                value={formData.currentPassword}
                onChange={handleInputChange}
                disabled={changePasswordMutation.isPending}
                data-testid="input-current-password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => togglePasswordVisibility('current')}
                disabled={changePasswordMutation.isPending}
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? "text" : "password"}
                placeholder="Digite sua nova senha (min. 6 caracteres)"
                value={formData.newPassword}
                onChange={handleInputChange}
                disabled={changePasswordMutation.isPending}
                data-testid="input-new-password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => togglePasswordVisibility('new')}
                disabled={changePasswordMutation.isPending}
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                placeholder="Digite novamente sua nova senha"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={changePasswordMutation.isPending}
                data-testid="input-confirm-password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => togglePasswordVisibility('confirm')}
                disabled={changePasswordMutation.isPending}
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-muted/30 p-3 rounded-lg">
            <p className="text-sm font-medium mb-2">Requisitos da senha:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Mínimo de 6 caracteres</li>
              <li>• Diferente da senha atual</li>
              <li>• Use uma combinação de letras e números</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              changePasswordMutation.isPending || 
              !formData.currentPassword || 
              !formData.newPassword || 
              !formData.confirmPassword
            }
            data-testid="button-change-password"
          >
            {changePasswordMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Alterando Senha...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Alterar Senha
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Esta alteração é obrigatória por questões de segurança.
            Entre em contato com a academia se tiver problemas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}