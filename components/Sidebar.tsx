'use client';

import { useEffect, useState } from 'react';
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
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { BrandSwitcher } from './BrandSwitcher';
import { Badge } from './ui/Badge';
import { logout } from '@/app/(public)/login/actions';
import { puede, ROL_LABEL, type Permiso, type Rol } from '@/lib/permisos';
import { tapTarget } from '@/lib/ui';

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
  const [abierto, setAbierto] = useState(false);
  const marcaActiva = cuentas.find((c) => c.id === cuentaActivaId)?.nombre;

  // Cerrar al navegar. Sin esto, tocás "Contactos", la página cambia por debajo
  // y el cajón queda abierto tapándola — es la razón por la que el drawer lleva
  // estado de React y no el truco del checkbox: con CSS puro la navegación soft
  // del App Router no puede cerrarlo.
  //
  // Va como ajuste DURANTE el render y no en un `useEffect`: en el efecto,
  // React alcanza a pintar un cuadro con el cajón abierto sobre la página
  // nueva, y encima el lint lo rechaza (`react-hooks/set-state-in-effect`).
  const [rutaPrevia, setRutaPrevia] = useState(pathname);
  if (rutaPrevia !== pathname) {
    setRutaPrevia(pathname);
    setAbierto(false);
  }

  // Escape y bloqueo del scroll de fondo. El scroll real es el del documento
  // (el `overflow-auto` del <main> no acota altura), así que se frena ahí.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alTeclear);
    const previo = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.documentElement.style.overflow = previo;
    };
  }, [abierto]);

  return (
    <>
      {/* Barra superior de celular. El nombre de la marca activa NO es adorno:
          la app es multi-marca y en escritorio ese dato está siempre a la vista;
          sin él, alguien con tres marcas manda una prueba creyendo que está en
          otra. */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls="sidebar-nav"
          className={`flex ${tapTarget} items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground`}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Send className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 truncate text-sm font-semibold text-foreground">
          {marcaActiva ?? 'Areben Mailer'}
        </div>
      </div>

      {/* Fondo oscuro: cierra al tocar afuera. z-30 lo deja abajo del <aside> y
          del modal de ImagenPicker (z-50). */}
      {abierto && (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-30 cursor-default bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="sidebar-nav"
        // ⛔ El transform va con `max-lg:`, NUNCA suelto: un `transform` en este
        // <aside> crea un containing block y el `fixed inset-0` del click-away
        // de BrandSwitcher pasaría a medir el sidebar en vez del viewport ⇒ en
        // escritorio el dropdown de marcas dejaría de cerrarse. En `lg+` esto
        // queda idéntico a como estaba.
        className={[
          'sticky top-0 h-screen w-60 shrink-0 border-r border-border bg-surface flex flex-col',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:h-dvh max-lg:w-[17rem] max-lg:shadow-xl max-lg:transition-transform',
          // `invisible` saca los 11 links del orden de tabulación: un drawer
          // fuera de pantalla pero tabulable es una trampa de teclado que no se
          // ve.
          abierto
            ? 'max-lg:translate-x-0 max-lg:visible'
            : 'max-lg:-translate-x-full max-lg:invisible',
        ].join(' ')}
      >
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
                // Cierra a mano además del efecto de `pathname`: tocar el link de
                // la página en la que ya estás no cambia la ruta, así que el
                // efecto no dispara y el cajón se quedaría abierto.
                onClick={() => setAbierto(false)}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 text-sm transition-colors max-lg:py-3 lg:py-2',
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
                className={`flex ${tapTarget} h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground`}
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
