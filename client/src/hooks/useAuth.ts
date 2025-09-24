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

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = () => {
      if (apiClient.isAuthenticated()) {
        const userData = apiClient.getCurrentUserFromStorage();
        setUser(userData);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginData) => apiClient.login(credentials),
    onSuccess: (response) => {
      setUser(response.user);
      toast({
        title: 'Welcome back!',
        description: `Logged in as ${response.user.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Login Failed',
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
        title: 'Account Created!',
        description: `Welcome to Centro de Lutas, ${response.user.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Signup Failed',
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
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
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