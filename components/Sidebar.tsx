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
  Gauge,
  AtSign,
  UserCog,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { BrandSwitcher } from './BrandSwitcher';
import { Badge } from './ui/Badge';
import { logout } from '@/app/(public)/login/actions';
import { puede, ROL_LABEL, type Permiso, type Rol } from '@/lib/permisos';

interface Marca {
  id: string;
  nombre: string;
  slug: string;
}

// `permiso` opcional: sin él la sección la ve cualquiera. Una sección que va a
// dar 403 es ruido — y peor, hace pensar que la app está rota.
const NAV: { href: string; label: string; icon: LucideIcon; permiso?: Permiso }[] = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/contactos', label: 'Contactos', icon: Users },
  { href: '/listas', label: 'Listas', icon: Tag },
  { href: '/segmentos', label: 'Segmentos', icon: Target },
  { href: '/campanias', label: 'Campañas', icon: Send },
  { href: '/plantillas', label: 'Plantillas', icon: FileText },
  { href: '/formularios', label: 'Formularios', icon: ClipboardList },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/envio', label: 'Estado del envío', icon: Gauge, permiso: 'enviar' },
  { href: '/remitentes', label: 'Remitentes', icon: AtSign, permiso: 'remitentes' },
  { href: '/usuarios', label: 'Usuarios', icon: UserCog, permiso: 'usuarios' },
];

export function Sidebar({
  cuentas,
  cuentaActivaId,
  usuario,
  rol,
}: {
  cuentas: Marca[];
  cuentaActivaId: string;
  usuario: { nombre: string | null; email: string } | null;
  rol: Rol;
}) {
  const pathname = usePathname();
  const visibles = NAV.filter((i) => !i.permiso || puede(rol, i.permiso));

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
        {visibles.map((item) => {
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
            {rol !== 'ADMIN' && (
              <Badge size="sm" className="mt-1">
                {ROL_LABEL[rol]}
              </Badge>
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
