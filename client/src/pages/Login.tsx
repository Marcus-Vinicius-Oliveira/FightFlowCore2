import { useEffect } from "react";
import { useLocation } from "wouter";
import { LoginForm } from "@/components/AuthForms";
import { useAuth } from "@/hooks/useAuth";
import logoIcon from "@assets/Design sem nome (15)_1758779065313.png";

export default function Login() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect based on user role
      if (user.role === 'SUPER_ADMIN') {
        setLocation("/superadmin/dashboard");
      } else if (user.role === 'ALUNO') {
        setLocation("/portal/dashboard");
      } else if (user.role === 'ADMIN_ACADEMIA' || user.role === 'PROFESSOR') {
        setLocation("/dashboard");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [isAuthenticated, user, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 dark:from-blue-950 dark:to-orange-950 p-4">
      <div className="w-full max-w-md">
        <button 
          onClick={() => setLocation('/')}
          className="text-center mb-8 w-full hover:opacity-80 transition-opacity"
          data-testid="button-logo-home"
        >
          <div className="flex justify-center mb-4">
            <img src={logoIcon} alt="Fight Club App" className="h-16 w-16" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Fight Club App
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Entre na sua conta de gerenciamento
          </p>
        </button>
        
        <LoginForm 
          onSuccess={() => {
            // Get user data from localStorage to determine redirect
            const userData = localStorage.getItem('user');
            if (userData) {
              const user = JSON.parse(userData);
              
              // Redirect based on user role
              if (user.role === 'SUPER_ADMIN') {
                setLocation("/superadmin/dashboard");
              } else if (user.role === 'ALUNO') {
                setLocation("/portal/dashboard");
              } else if (user.role === 'ADMIN_ACADEMIA' || user.role === 'PROFESSOR') {
                setLocation("/dashboard");
              } else {
                // Fallback to default dashboard
                setLocation("/dashboard");
              }
            } else {
              // Fallback if no user data found
              setLocation("/dashboard");
            }
          }} 
        />
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Não tem uma conta?{" "}
            <button 
              onClick={() => setLocation("/cadastro")}
              className="text-primary hover:underline font-medium"
              data-testid="link-to-cadastro"
            >
              Cadastre-se aqui
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}