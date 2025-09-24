import { AppSidebar } from '../AppSidebar';
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar 
          userRole="ADMIN_ACADEMIA"
          userInfo={{
            name: "João Silva",
            email: "joao@dragonacademy.com",
            academy: "Dragon Martial Arts Academy"
          }}
        />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Academy Dashboard</h1>
            <p className="text-muted-foreground mb-8">Welcome to your martial arts academy management system.</p>
            <div className="bg-muted/50 rounded-lg p-8 text-center">
              <p>Main content area - click sidebar items to navigate</p>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}