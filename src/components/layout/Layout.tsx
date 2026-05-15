import { ReactNode, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  KanbanSquare,
  Wallet,
  Package,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";
import "./Layout.css";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projetos", label: "Projetos", icon: KanbanSquare },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/investidores", label: "Investidores", icon: Briefcase },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/auditoria", label: "Auditoria", icon: History },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { sessao, logout } = useApp();
  const navigate = useNavigate();

  return (
    <div className="sidebar-shell relative flex h-full w-full flex-col">
      <div className="relative z-10 flex h-full flex-col p-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="mb-8 flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold tracking-tight">
            V4
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Gestão de Projetos</p>
            <p className="text-[11px] text-white/60 leading-tight">Unidade · Marketing</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  isActive && "active"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="sidebar-card rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-white/60">Logado como</p>
            <p className="mt-1 text-sm font-semibold text-white">{sessao?.nome ?? "—"}</p>
            <p className="text-xs text-white/70">{sessao?.email}</p>
            <p className="mt-2 inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/80">
              {sessao?.perfil}
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="sidebar-link flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-30 bg-[#140003] text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-extrabold">
              V4
            </div>
            <span className="text-sm font-semibold">Gestão de Projetos</span>
          </Link>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex w-72 max-w-[80vw] flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-20 rounded-md p-1.5 text-white/80 hover:bg-white/10"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="main-shell flex-1 min-w-0 lg:pl-64">
        <div className="pt-[60px] lg:pt-0">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-10 xl:px-10 2xl:px-12 animate-fade-in">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}
