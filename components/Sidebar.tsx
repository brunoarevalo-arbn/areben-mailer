'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Tag,
  Target,
  Send,
  FileText,
  ClipboardList,
  Zap,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { BrandSwitcher } from './BrandSwitcher';
import { logout } from '@/app/(public)/login/actions';

interface Marca {
  id: string;
  nombre: string;
  slug: string;
}

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/contactos', label: 'Contactos', icon: Users },
  { href: '/listas', label: 'Listas', icon: Tag },
  { href: '/segmentos', label: 'Segmentos', icon: Target },
  { href: '/campanias', label: 'Campañas', icon: Send },
  { href: '/plantillas', label: 'Plantillas', icon: FileText },
  { href: '/formularios', label: 'Formularios', icon: ClipboardList },
  { href: '/automations', label: 'Automations', icon: Zap },
];

export function Sidebar({
  cuentas,
  cuentaActivaId,
  usuario,
}: {
  cuentas: Marca[];
  cuentaActivaId: string;
  usuario: { nombre: string | null; email: string } | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      {/* Marca + selector */}
      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2.5 px-2 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
            <Send className="h-5 w-5" aria-hidden />
          </div>
          <div className="text-sm font-semibold text-foreground leading-tight">
            Areben Mailer
          </div>
        </div>
        <BrandSwitcher cuentas={cuentas} activaId={cuentaActivaId} />
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent-subtle text-accent-subtle-foreground font-medium'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: usuario + tema + salir */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground truncate">
              {usuario?.nombre ?? usuario?.email ?? 'Usuario'}
            </div>
            {usuario?.nombre && (
              <div className="text-xs text-muted truncate">{usuario.email}</div>
            )}
          </div>
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
