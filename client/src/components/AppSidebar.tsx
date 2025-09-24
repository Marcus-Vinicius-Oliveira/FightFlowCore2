import { 
  Home, 
  Users, 
  Calendar, 
  DollarSign, 
  Settings, 
  BookOpen,
  Shield,
  BarChart3,
  UserCheck,
  GraduationCap
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AppSidebarProps {
  userRole?: "ADMIN_ACADEMIA" | "PROFESSOR" | "ALUNO";
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
    name: "João Silva", 
    email: "joao@academia.com", 
    academy: "Dragon Academy"
  }
}: AppSidebarProps) {
  
  // Menu items based on user role
  const getMenuItems = () => {
    const baseItems = [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: Home,
        roles: ["ADMIN_ACADEMIA", "PROFESSOR", "ALUNO"]
      }
    ];

    const adminItems = [
      {
        title: "Students",
        url: "/students",
        icon: Users,
        roles: ["ADMIN_ACADEMIA"]
      },
      {
        title: "Classes & Schedule",
        url: "/classes",
        icon: Calendar,
        roles: ["ADMIN_ACADEMIA", "PROFESSOR"]
      },
      {
        title: "Attendance",
        url: "/attendance", 
        icon: UserCheck,
        roles: ["ADMIN_ACADEMIA", "PROFESSOR"]
      },
      {
        title: "Finances",
        url: "/finances",
        icon: DollarSign,
        roles: ["ADMIN_ACADEMIA"]
      },
      {
        title: "Reports",
        url: "/reports",
        icon: BarChart3,
        roles: ["ADMIN_ACADEMIA"]
      },
      {
        title: "Academy Settings",
        url: "/settings",
        icon: Settings,
        roles: ["ADMIN_ACADEMIA"]
      }
    ];

    const studentItems = [
      {
        title: "My Schedule",
        url: "/my-schedule",
        icon: Calendar,
        roles: ["ALUNO"]
      },
      {
        title: "My Attendance",
        url: "/my-attendance",
        icon: BookOpen,
        roles: ["ALUNO"]
      },
      {
        title: "My Progress",
        url: "/my-progress",
        icon: GraduationCap,
        roles: ["ALUNO"]
      },
      {
        title: "Profile",
        url: "/profile",
        icon: Settings,
        roles: ["ALUNO", "PROFESSOR"]
      }
    ];

    return [...baseItems, ...adminItems, ...studentItems].filter(item =>
      item.roles.includes(userRole)
    );
  };

  const menuItems = getMenuItems();

  const handleMenuClick = (item: typeof menuItems[0]) => {
    console.log(`Navigating to ${item.title} (${item.url})`);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      "ADMIN_ACADEMIA": "Academy Admin",
      "PROFESSOR": "Professor",
      "ALUNO": "Student"
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center space-x-2 p-2">
          <Shield className="h-8 w-8 text-sidebar-primary" />
          <div className="flex flex-col">
            <span className="font-bold text-sidebar-foreground">Centro de Lutas</span>
            <span className="text-xs text-sidebar-foreground/60">{userInfo.academy}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    onClick={() => handleMenuClick(item)}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <button className="w-full justify-start">
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}