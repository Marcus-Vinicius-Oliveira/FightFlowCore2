import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: ('ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO')[];
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // If not authenticated, redirect to appropriate login page
    if (!isLoading && !isAuthenticated) {
      // If trying to access portal routes, redirect to portal login
      if (location.startsWith('/portal/')) {
        setLocation("/portal/login");
      } else {
        setLocation("/login");
      }
      return;
    }

    // If specific role is required and user doesn't have it, redirect
    if (
      !isLoading && 
      isAuthenticated && 
      user && 
      requireRole && 
      !requireRole.includes(user.role as any)
    ) {
      setLocation("/dashboard");
      return;
    }

    // FIRST ACCESS ENFORCEMENT: If student has firstAccess=true and trying to access portal routes (except login)
    if (
      !isLoading &&
      isAuthenticated &&
      user?.role === 'ALUNO' &&
      user.firstAccess &&
      location.startsWith('/portal/') &&
      location !== '/portal/login'
    ) {
      setLocation('/portal/login');
      return;
    }
  }, [isAuthenticated, user, isLoading, requireRole, location, setLocation]);

  // Show loading while checking authentication
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

  // Don't render if not authenticated or wrong role
  if (!isAuthenticated || (requireRole && user && !requireRole.includes(user.role as any))) {
    return null;
  }

  // Don't render portal content if student needs to change password first
  if (
    user?.role === 'ALUNO' &&
    user.firstAccess &&
    location.startsWith('/portal/') &&
    location !== '/portal/login'
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Redirecionando para alteração de senha...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}