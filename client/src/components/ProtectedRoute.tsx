import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: ('SUPER_ADMIN' | 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO')[];
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const loginPath = location.startsWith('/portal/') ? '/portal/login' : '/login';
    return <Redirect to={loginPath} />;
  }

  if (requireRole && user && !requireRole.includes(user.role as any)) {
    if (user.role === 'SUPER_ADMIN') return <Redirect to="/superadmin/dashboard" />;
    if (user.role === 'ALUNO') return <Redirect to="/portal/dashboard" />;
    return <Redirect to="/dashboard" />;
  }

  if (
    user?.role === 'ALUNO' &&
    user.firstAccess &&
    location.startsWith('/portal/') &&
    location !== '/portal/login'
  ) {
    return <Redirect to="/portal/login" />;
  }

  return <>{children}</>;
}