import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type User } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface LoginData {
  email: string;
  password: string;
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO';
  academyName?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if user is logged in on mount and handle automatic logout
  useEffect(() => {
    const checkAuth = () => {
      if (apiClient.isAuthenticated()) {
        const userData = apiClient.getCurrentUserFromStorage();
        setUser(userData);
      }
      setIsLoading(false);
    };

    // Handle automatic logout on 401 errors
    const handleUnauthorized = (event: CustomEvent) => {
      setUser(null);
      toast({
        title: 'Sessão Expirada',
        description: event.detail?.message || 'Por favor, faça login novamente.',
        variant: 'destructive',
      });
    };

    checkAuth();
    
    // Listen for unauthorized events
    window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    };
  }, [toast]);

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginData) => apiClient.login(credentials),
    onSuccess: (response) => {
      setUser(response.user);
      toast({
        title: 'Bem-vindo de volta!',
        description: `Logado como ${response.user.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Falha no Login',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: (userData: SignupData) => apiClient.signup(userData),
    onSuccess: (response) => {
      setUser(response.user);
      toast({
        title: 'Conta Criada!',
        description: `Bem-vindo ao Centro de Lutas, ${response.user.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Falha no Cadastro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const logout = () => {
    apiClient.logout();
    setUser(null);
    queryClient.clear();
    toast({
      title: 'Desconectado',
      description: 'Você foi desconectado com sucesso.',
    });
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    signup: signupMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
  };
}