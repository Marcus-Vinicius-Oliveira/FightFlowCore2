import { useEffect } from "react";
import { useLocation } from "wouter";
import { LoginForm } from "@/components/AuthForms";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 dark:from-blue-950 dark:to-orange-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Centro de Lutas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Entre na sua conta de gerenciamento
          </p>
        </div>
        
        <LoginForm 
          onSuccess={() => {
            // Redirect to dashboard after successful login
            setLocation("/dashboard");
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