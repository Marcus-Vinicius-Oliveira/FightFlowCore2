import { useState, useEffect, useRef } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Recursos from "@/pages/Recursos";
import Precos from "@/pages/Precos";
import Sobre from "@/pages/Sobre";
import AuthPage from "@/pages/AuthPage";
import Cadastro from "@/pages/Cadastro";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import StudentDashboard from "@/pages/StudentDashboard";
import StudentManagement from "@/pages/StudentManagement";
import StudentDetail from "@/pages/StudentDetail";
import InstructorManagement from "@/pages/InstructorManagement";
import ClassManagement from "@/pages/ClassManagement";
import WeeklySchedule from "@/pages/WeeklySchedule";
import AttendanceControl from "@/pages/AttendanceControl";
import AttendanceOverview from "@/pages/AttendanceOverview";
import CheckinQR from "@/pages/CheckinQR";
import PortalCheckin from "@/pages/PortalCheckin";
import PlanManagement from "@/pages/PlanManagement";
import CreatePlan from "@/pages/CreatePlan";
import FinancialControl from "@/pages/FinancialControl";
import PortalLogin from "@/pages/PortalLogin";
import PortalDashboard from "@/pages/PortalDashboard";
import PortalSchedule from "@/pages/PortalSchedule";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import SuperAdminAcademias from "@/pages/SuperAdminAcademias";
import SuperAdminPlanos from "@/pages/SuperAdminPlanos";
import SettingsPage from "@/pages/Settings";
import SalesPipeline from "@/pages/SalesPipeline";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BottomNav } from "@/components/BottomNav";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/recursos" component={Recursos} />
      <Route path="/precos" component={Precos} />
      <Route path="/sobre" component={Sobre} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/cadastro" component={Cadastro} />
      <Route path="/login" component={Login} />
      
      {/* Portal do Aluno Routes */}
      <Route path="/portal/login" component={PortalLogin} />
      <Route path="/portal/dashboard">
        <ProtectedRoute requireRole={['ALUNO']}>
          <PortalDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/portal/horarios">
        <ProtectedRoute requireRole={['ALUNO']}>
          <PortalSchedule />
        </ProtectedRoute>
      </Route>
      <Route path="/portal/checkin">
        <ProtectedRoute requireRole={['ALUNO']}>
          <PortalCheckin />
        </ProtectedRoute>
      </Route>
      
      {/* Admin Dashboard Routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/alunos/:id">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <StudentDetail />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/alunos">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <StudentManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/instrutores">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <InstructorManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/aulas">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <ClassManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/planos">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <PlanManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/planos/novo">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <CreatePlan />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/financeiro">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <FinancialControl />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/pipeline">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <SalesPipeline />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/grade">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA', 'PROFESSOR']}>
          <WeeklySchedule />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/presenca">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA', 'PROFESSOR']}>
          <AttendanceOverview />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/presenca/:classId">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA', 'PROFESSOR']}>
          <AttendanceControl />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/checkin-qr">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA', 'PROFESSOR']}>
          <CheckinQR />
        </ProtectedRoute>
      </Route>
      
      {/* Super Admin Routes */}
      <Route path="/superadmin/dashboard">
        <ProtectedRoute requireRole={['SUPER_ADMIN']}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/academias">
        <ProtectedRoute requireRole={['SUPER_ADMIN']}>
          <SuperAdminAcademias />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/planos">
        <ProtectedRoute requireRole={['SUPER_ADMIN']}>
          <SuperAdminPlanos />
        </ProtectedRoute>
      </Route>
      <Route path="/superadmin/planos/novo">
        <ProtectedRoute requireRole={['SUPER_ADMIN']}>
          <SuperAdminPlanos />
        </ProtectedRoute>
      </Route>
      
      {/* Legacy student portal route */}
      <Route path="/student-portal">
        <ProtectedRoute requireRole={['ALUNO']}>
          <StudentDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

const PUBLIC_ONLY_PATHS = ['/', '/login', '/auth', '/cadastro', '/recursos', '/precos', '/sobre'];

function AuthenticatedRedirect() {
  const { user } = useAuth();
  if (user?.role === 'SUPER_ADMIN') return <Redirect to="/superadmin/dashboard" />;
  if (user?.role === 'ALUNO') return <Redirect to="/portal/dashboard" />;
  return <Redirect to="/dashboard" />;
}

function AppWithAuthentication() {
  const { user } = useAuth();
  const [location] = useLocation();

  // O scroll do app autenticado vive no <main> (overflow-y-auto), não na
  // janela — sem este reset, trocar de página preserva a posição de scroll
  // da página anterior e o usuário "entra pelo meio".
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location]);

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  if (PUBLIC_ONLY_PATHS.includes(location)) {
    return <AuthenticatedRedirect />;
  }

  const isAdminRole = user?.role === 'ADMIN_ACADEMIA' || user?.role === 'PROFESSOR';

  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <div className="flex h-dvh w-full">
        <AppSidebar
          userRole={user?.role as any}
          userInfo={{
            name: user?.name || "",
            email: user?.email || "",
            academy: user?.role === 'SUPER_ADMIN' ? 'Fight Club App Platform' : (user?.academy?.name || "")
          }}
        />
        <div className="flex flex-col flex-1 min-w-0 w-full overflow-x-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center space-x-4">
              {/* Sidebar trigger: hidden on mobile when bottom nav takes over primary navigation */}
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className={isAdminRole ? "hidden md:flex" : ""}
              />
              <div className="text-sm text-muted-foreground hidden sm:block truncate max-w-[200px] lg:max-w-none">
                Bem-vindo, {user?.name}
              </div>
            </div>
            <ThemeToggle />
          </header>
          {/* pb-16 on mobile leaves room above the fixed bottom nav; none on md+ */}
          <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 md:p-8 pb-20 md:pb-8">
            <Router />
          </main>
        </div>
      </div>
      {/* Bottom navigation — renders only on mobile for admin/professor roles */}
      {isAdminRole && <BottomNav />}
    </SidebarProvider>
  );
}

/** Páginas públicas rolam a janela (não há <main> com overflow) — reset próprio. */
function WindowScrollReset() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function AppContent() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && user ? (
        <AppWithAuthentication />
      ) : (
        <>
          <WindowScrollReset />
          <Router />
        </>
      )}
      <Toaster />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="centro-lutas-theme">
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}