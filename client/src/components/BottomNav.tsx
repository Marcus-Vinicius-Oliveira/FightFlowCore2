import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Users, DollarSign, Settings, UserCheck2, CreditCard, Calendar, Target,
  BarChart3, LayoutGrid,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

type BottomNavRole = "ADMIN_ACADEMIA" | "PROFESSOR";

// Espelho dos itens da AppSidebar (mesmos papéis e destinos). `primary` marca
// os 4 acessos mais frequentes, que ficam na barra; o resto vai para o sheet
// "Mais" — assim nenhuma página de admin fica órfã no mobile, onde a sidebar
// é escondida em favor desta barra.
const NAV_ITEMS = [
  { label: "Painel",              path: "/dashboard",             icon: Home,       exact: true,  primary: true,  roles: ["ADMIN_ACADEMIA", "PROFESSOR"] },
  { label: "Alunos",              path: "/dashboard/alunos",      icon: Users,      exact: false, primary: true,  roles: ["ADMIN_ACADEMIA"] },
  { label: "Financeiro",          path: "/dashboard/financeiro",  icon: DollarSign, exact: false, primary: true,  roles: ["ADMIN_ACADEMIA"] },
  { label: "Configurações",       path: "/settings",              icon: Settings,   exact: false, primary: true,  roles: ["ADMIN_ACADEMIA"] },
  { label: "Instrutores",         path: "/dashboard/instrutores", icon: UserCheck2, exact: false, primary: false, roles: ["ADMIN_ACADEMIA"] },
  { label: "Planos e Matrículas", path: "/dashboard/planos",      icon: CreditCard, exact: false, primary: false, roles: ["ADMIN_ACADEMIA"] },
  { label: "Grade de Aulas",      path: "/dashboard/grade",       icon: Calendar,   exact: false, primary: false, roles: ["ADMIN_ACADEMIA", "PROFESSOR"] },
  { label: "Pipeline",            path: "/dashboard/pipeline",    icon: Target,     exact: false, primary: false, roles: ["ADMIN_ACADEMIA"] },
  { label: "Relatórios",          path: "/reports",               icon: BarChart3,  exact: false, primary: false, roles: ["ADMIN_ACADEMIA"] },
] as const;

const MAX_SLOTS = 5;

export function BottomNav({ userRole = "ADMIN_ACADEMIA" }: { userRole?: BottomNavRole }) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Only render on admin/professor dashboard routes. Atenção: páginas de
  // admin fora de /dashboard/* (como /reports) precisam constar aqui, senão
  // o usuário fica sem navegação no mobile (a sidebar é escondida em favor
  // desta barra). /dashboard/presenca já foi excluída daqui e deixava o
  // usuário preso na página no celular — não recrie a exceção.
  const isDashboardRoute =
    location === "/dashboard" ||
    location.startsWith("/dashboard/") ||
    location === "/settings" ||
    location === "/reports";

  if (!isDashboardRoute) return null;

  const isActive = (path: string, exact: boolean) =>
    exact ? location === path : location === path || location.startsWith(path + "/");

  const visible = NAV_ITEMS.filter(i => (i.roles as readonly string[]).includes(userRole));
  // Se tudo couber na barra (ex.: professor), não há "Mais"
  const needsMore = visible.length > MAX_SLOTS;
  const barItems = needsMore ? visible.filter(i => i.primary) : visible;
  const moreItems = needsMore ? visible.filter(i => !i.primary) : [];
  const moreActive = moreItems.some(i => isActive(i.path, i.exact));
  const slots = barItems.length + (needsMore ? 1 : 0);

  const itemClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 transition-colors ${
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  const itemIcon = (Icon: typeof Home, active: boolean) => (
    <Icon
      className={`h-5 w-5 shrink-0 transition-transform ${active ? "scale-110" : ""}`}
      strokeWidth={active ? 2.25 : 1.75}
    />
  );

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))`,
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        }}
      >
        {barItems.map(({ label, path, icon: Icon, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link
              key={path}
              to={path}
              className={itemClass(active)}
              aria-current={active ? "page" : undefined}
            >
              {itemIcon(Icon, active)}
              <span className={`text-[10px] font-medium leading-tight tracking-wide ${active ? "font-semibold" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}

        {needsMore && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={itemClass(moreActive)}
            aria-current={moreActive ? "page" : undefined}
            data-testid="bottomnav-mais"
          >
            {itemIcon(LayoutGrid, moreActive)}
            <span className={`text-[10px] font-medium leading-tight tracking-wide ${moreActive ? "font-semibold" : ""}`}>
              Mais
            </span>
          </button>
        )}
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-xl pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Mais opções</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {moreItems.map(({ label, path, icon: Icon, exact }) => {
              const active = isActive(path, exact);
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border py-4 px-2 text-center transition-colors ${
                    active
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-muted-foreground hover-elevate"
                  }`}
                  aria-current={active ? "page" : undefined}
                  data-testid={`bottomnav-more-${path.split('/').pop()}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
