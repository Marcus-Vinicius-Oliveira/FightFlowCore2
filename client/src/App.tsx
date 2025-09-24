import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
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
import AuthPage from "@/pages/AuthPage";
import Cadastro from "@/pages/Cadastro";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import StudentDashboard from "@/pages/StudentDashboard";
import StudentManagement from "@/pages/StudentManagement";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/cadastro" component={Cadastro} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/alunos">
        <ProtectedRoute requireRole={['ADMIN_ACADEMIA']}>
          <StudentManagement />
        </ProtectedRoute>
      </Route>
      <Route path="/student-portal">
        <ProtectedRoute requireRole={['ALUNO']}>
          <StudentDashboard />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithSidebar() {
  const [currentView, setCurrentView] = useState<"dashboard" | "student-portal">("dashboard");
  const [userRole, setUserRole] = useState<"ADMIN_ACADEMIA" | "PROFESSOR" | "ALUNO">("ADMIN_ACADEMIA");
  
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };
  
  const userInfo = {
    name: userRole === "ALUNO" ? "Maria Santos" : "João Silva",
    email: userRole === "ALUNO" ? "maria@email.com" : "joao@dragonacademy.com",
    academy: "Dragon Martial Arts Academy"
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={userRole} userInfo={userInfo} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center space-x-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center space-x-2">
                <select 
                  value={userRole} 
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="px-3 py-1 border rounded text-sm"
                  data-testid="select-user-role"
                >
                  <option value="ADMIN_ACADEMIA">Visão Admin</option>
                  <option value="PROFESSOR">Visão Professor</option>
                  <option value="ALUNO">Visão Aluno</option>
                </select>
                <select 
                  value={currentView} 
                  onChange={(e) => setCurrentView(e.target.value as any)}
                  className="px-3 py-1 border rounded text-sm"
                  data-testid="select-current-view"
                >
                  <option value="dashboard">Painel Admin</option>
                  <option value="student-portal">Portal do Aluno</option>
                </select>
              </div>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-8">
            {currentView === "dashboard" ? <Dashboard /> : <StudentDashboard />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthPageWithIntegration() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

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

  if (isAuthenticated) {
    return <AppWithAuthentication />;
  }

  return <AuthPage />;
}

function AppWithAuthentication({ onLogout }: { onLogout?: () => void }) {
  const { user, logout } = useAuth();
  
  const handleLogout = () => {
    logout();
    onLogout?.();
  };
  
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          userRole={user?.role as any}
          userInfo={{
            name: user?.name || "",
            email: user?.email || "",
            academy: user?.academy?.name || ""
          }}
        />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center space-x-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="text-sm text-muted-foreground">
                Bem-vindo, {user?.name}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <LogoutButton onLogout={handleLogout} />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-8">
            {user?.role === 'ALUNO' ? <StudentDashboard /> : <Dashboard />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  return (
    <button
      onClick={onLogout}
      className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors"
      data-testid="button-logout"
    >
      Sair
    </button>
  );
}

function AppContent() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [showLanding, setShowLanding] = useState(!isAuthenticated);
  const [showDemo, setShowDemo] = useState(false);

  // Update landing state when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      setShowLanding(false);
      setShowDemo(false);
    }
  }, [isAuthenticated]);
  
  // Demo navigation controls
  const handleDemoLogin = () => {
    setShowDemo(true);
    setShowLanding(false);
  };
  
  const handleShowAuth = () => {
    setShowLanding(false);
    setShowDemo(false);
  };
  
  const handleBackToLanding = () => {
    setShowLanding(true);
    setShowDemo(false);
  };

  const handleLogout = () => {
    setShowLanding(true);
    setShowDemo(false);
  };

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

  // If authenticated, show authenticated app
  if (isAuthenticated && !showLanding && !showDemo) {
    return <AppWithAuthentication onLogout={handleLogout} />;
  }
  
  return (
    <div className="min-h-screen">
      {/* Demo Navigation Bar */}
      <div className="fixed top-0 right-0 z-50 p-4 flex items-center space-x-2 bg-background/95 backdrop-blur-sm border-l border-b rounded-bl-lg">
        <button
          onClick={handleBackToLanding}
          className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors"
          data-testid="button-show-landing"
        >
          Início
        </button>
        <button
          onClick={handleShowAuth}
          className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors"
          data-testid="button-show-auth"
        >
          Login
        </button>
        <button
          onClick={handleDemoLogin}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          data-testid="button-demo-login"
        >
          Demo
        </button>
      </div>
      
      {/* Main Content */}
      {showLanding ? (
        <Landing />
      ) : showDemo ? (
        <AppWithSidebar />
      ) : (
        <AuthPage />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="centro-lutas-theme">
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
