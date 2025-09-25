import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GraduationCap } from "lucide-react";
import logoIcon from "@assets/Design sem nome (15)_1758779065313.png";
import { useLocation } from "wouter";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";

export default function PortalLogin() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn, user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Handle authentication state changes
  useEffect(() => {
    if (isAuthenticated && user?.role === 'ALUNO') {
      // Check if user needs to change password on first access
      if (user.firstAccess) {
        setShowChangePasswordModal(true);
      } else {
        setLocation("/portal/dashboard");
      }
    } else if (isAuthenticated && user?.role !== 'ALUNO') {
      setError("Esta página é apenas para alunos. Redirecionando...");
      setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
    }
  }, [isAuthenticated, user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!formData.email || !formData.password) {
      setError("Por favor, preencha todos os campos");
      return;
    }

    try {
      login(formData);
    } catch (err: any) {
      setError(err.message || "Erro durante o login");
    }
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

  const handlePasswordChangeSuccess = () => {
    setShowChangePasswordModal(false);
    setLocation("/portal/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Portal do Aluno</h1>
          <p className="text-muted-foreground">
            Entre com suas credenciais para acessar seu portal
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Entrar</CardTitle>
            <CardDescription className="text-center">
              Acesse suas aulas, presenças e pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoggingIn}
                  data-testid="input-email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoggingIn}
                  data-testid="input-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn || !formData.email || !formData.password}
                data-testid="button-login"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <img src={logoIcon} alt="Fight Club App" className="mr-2 h-4 w-4" />
                    Entrar no Portal
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Esqueceu sua senha? Entre em contato com a academia.
          </p>
          <p className="text-xs text-muted-foreground">
            Primeiro acesso? Use o e-mail e senha fornecidos pela academia.
          </p>
        </div>
      </div>

      {/* Change Password Modal for First Access */}
      <ChangePasswordModal 
        isOpen={showChangePasswordModal}
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  );
}