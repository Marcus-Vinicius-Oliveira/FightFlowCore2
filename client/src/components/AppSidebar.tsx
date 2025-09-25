import { 
  Home, 
  Users, 
  Calendar, 
  DollarSign, 
  Settings, 
  BookOpen,
  BarChart3,
  UserCheck,
  GraduationCap,
  Building2,
  CreditCard
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import logoIcon from "@assets/image_1758778298254.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";

interface AppSidebarProps {
  userRole?: "SUPER_ADMIN" | "ADMIN_ACADEMIA" | "PROFESSOR" | "ALUNO";
  userInfo?: {
    name: string;
    email: string;
    academy: string;
    avatar?: string;
  };
}

export function AppSidebar({ 
  userRole = "ADMIN_ACADEMIA",
  userInfo = {
    name: userRole === "SUPER_ADMIN" ? "Super Admin" : "João Silva", 
    email: userRole === "SUPER_ADMIN" ? "admin@centrodelivtas.com" : "joao@academia.com", 
    academy: userRole === "SUPER_ADMIN" ? "Fight Club App Platform" : "Dragon Academy"
  }
}: AppSidebarProps) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  
  // Menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      {
        title: "Painel",
        url: "/dashboard",
        icon: Home,
        roles: ["ADMIN_ACADEMIA", "PROFESSOR", "ALUNO"]
      }
    ];

    // Super Admin specific items
    const superAdminItems = [
      {
        title: "Dashboard SA",
        url: "/superadmin/dashboard",
        icon: Home,
        roles: ["SUPER_ADMIN"]
      },
      {
        title: "Academias",
        url: "/superadmin/academias",
        icon: Building2,
        roles: ["SUPER_ADMIN"]
      },
      {
        title: "Planos",
        url: "/superadmin/planos",
        icon: CreditCard,
        roles: ["SUPER_ADMIN"]
      }
    ];

    const adminItems = [
      {
        title: "Alunos",
        url: "/dashboard/alunos",
        icon: Users,
        roles: ["ADMIN_ACADEMIA"]
      },
      {
        title: "Grade de Aulas",
        url: "/dashboard/grade",
        icon: Calendar,
        roles: ["ADMIN_ACADEMIA", "PROFESSOR"]
      },
      {
        title: "Financeiro",
        url: "/finances",
        icon: DollarSign,
        roles: ["ADMIN_ACADEMIA"]
      },
      {
        title: "Relatórios",
        url: "/reports",
        icon: BarChart3,
        roles: ["ADMIN_ACADEMIA"]
      },
      {
        title: "Configurações",
        url: "/settings",
        icon: Settings,
        roles: ["ADMIN_ACADEMIA"]
      }
    ];

    const studentItems = [
      {
        title: "Meus Horários",
        url: "/my-schedule",
        icon: Calendar,
        roles: ["ALUNO"]
      },
      {
        title: "Minha Presença",
        url: "/my-attendance",
        icon: BookOpen,
        roles: ["ALUNO"]
      },
      {
        title: "Meu Progresso",
        url: "/my-progress",
        icon: GraduationCap,
        roles: ["ALUNO"]
      },
      {
        title: "Perfil",
        url: "/profile",
        icon: Settings,
        roles: ["ALUNO", "PROFESSOR"]
      }
    ];

    return [...baseItems, ...superAdminItems, ...adminItems, ...studentItems].filter(item =>
      item.roles.includes(userRole)
    );
  };

  const menuItems = getMenuItems();

  // Remove handleMenuClick - we'll use Link components directly

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      "ADMIN_ACADEMIA": "Administrador",
      "PROFESSOR": "Professor",
      "ALUNO": "Aluno"
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center space-x-2 p-2">
          <img src={logoIcon} alt="Fight Club App" className="h-8 w-8" />
          <div className="flex flex-col">
            <span className="font-bold text-sidebar-foreground">Fight Club App</span>
            <span className="text-xs text-sidebar-foreground/60">{userInfo.academy}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url} className="w-full justify-start">
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-4 space-y-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={userInfo.avatar} alt={userInfo.name} />
              <AvatarFallback className="text-sm">
                {getInitials(userInfo.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userInfo.name}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {getRoleDisplay(userRole)}
              </p>
              <p className="text-xs text-sidebar-foreground/40 truncate">
                {userInfo.email}
              </p>
            </div>
          </div>
          
          {/* Logout Button */}
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => {
              logout();
              setLocation('/');
            }}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da Conta
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}