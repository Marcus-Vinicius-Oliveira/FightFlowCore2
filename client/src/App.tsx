import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import StudentDashboard from "@/pages/StudentDashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/student-portal" component={StudentDashboard} />
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
                  <option value="ADMIN_ACADEMIA">Admin View</option>
                  <option value="PROFESSOR">Professor View</option>
                  <option value="ALUNO">Student View</option>
                </select>
                <select 
                  value={currentView} 
                  onChange={(e) => setCurrentView(e.target.value as any)}
                  className="px-3 py-1 border rounded text-sm"
                  data-testid="select-current-view"
                >
                  <option value="dashboard">Admin Dashboard</option>
                  <option value="student-portal">Student Portal</option>
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  
  // Demo navigation controls
  const handleDemoLogin = () => {
    setIsAuthenticated(true);
    setShowLanding(false);
  };
  
  const handleShowAuth = () => {
    setShowLanding(false);
  };
  
  const handleBackToLanding = () => {
    setShowLanding(true);
    setIsAuthenticated(false);
  };
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="centro-lutas-theme">
        <TooltipProvider>
          <div className="min-h-screen">
            {/* Demo Navigation Bar */}
            <div className="fixed top-0 right-0 z-50 p-4 flex items-center space-x-2 bg-background/95 backdrop-blur-sm border-l border-b rounded-bl-lg">
              <button
                onClick={handleBackToLanding}
                className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors"
                data-testid="button-show-landing"
              >
                Landing
              </button>
              <button
                onClick={handleShowAuth}
                className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors"
                data-testid="button-show-auth"
              >
                Auth
              </button>
              <button
                onClick={handleDemoLogin}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                data-testid="button-demo-login"
              >
                Demo App
              </button>
            </div>
            
            {/* Main Content */}
            {showLanding ? (
              <Landing />
            ) : isAuthenticated ? (
              <AppWithSidebar />
            ) : (
              <AuthPage />
            )}
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
