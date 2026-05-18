import { Link, useLocation } from "wouter";
import { Home, Users, DollarSign, Settings } from "lucide-react";

const NAV_ITEMS = [
  { label: "Painel",        path: "/dashboard",            icon: Home,        exact: true },
  { label: "Alunos",        path: "/dashboard/alunos",     icon: Users,       exact: false },
  { label: "Financeiro",    path: "/dashboard/financeiro", icon: DollarSign,  exact: false },
  { label: "Configurações", path: "/settings",             icon: Settings,    exact: false },
] as const;

export function BottomNav() {
  const [location] = useLocation();

  // Only render on admin/professor dashboard routes
  const isDashboardRoute =
    location === "/dashboard" ||
    (location.startsWith("/dashboard/") && !location.startsWith("/dashboard/presenca")) ||
    location === "/settings";

  if (!isDashboardRoute) return null;

  const isActive = (path: string, exact: boolean) =>
    exact ? location === path : location === path || location.startsWith(path + "/");

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
    >
      <div
        className="grid grid-cols-4"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {NAV_ITEMS.map(({ label, path, icon: Icon, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={`h-5 w-5 shrink-0 transition-transform ${active ? "scale-110" : ""}`}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className={`text-[10px] font-medium leading-tight tracking-wide ${active ? "font-semibold" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
