import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface FirstAccessGuardProps {
  children: React.ReactNode;
}

export function FirstAccessGuard({ children }: FirstAccessGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Only apply first access guard for authenticated students
    if (isAuthenticated && user?.role === 'ALUNO' && user.firstAccess) {
      // If user is on a portal route (except login), redirect to login to show password change modal
      if (location.startsWith('/portal/') && location !== '/portal/login') {
        setLocation('/portal/login');
      }
    }
  }, [isAuthenticated, user, location, setLocation]);

  // If this is a student on first access and trying to access portal routes (except login),
  // don't render the protected content
  if (
    isAuthenticated && 
    user?.role === 'ALUNO' && 
    user.firstAccess && 
    location.startsWith('/portal/') && 
    location !== '/portal/login'
  ) {
    // Return loading state while redirecting
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