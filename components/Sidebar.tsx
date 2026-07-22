'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/contactos', label: 'Contactos', icon: '👥' },
  { href: '/listas', label: 'Listas', icon: '🏷️' },
  { href: '/segmentos', label: 'Segmentos', icon: '🎯' },
  { href: '/campanias', label: 'Campañas', icon: '✉️' },
  { href: '/plantillas', label: 'Plantillas', icon: '📄' },
  { href: '/automations', label: 'Automations', icon: '⚡' },
];

export function Sidebar({ cuentaNombre }: { cuentaNombre: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-neutral-200 bg-neutral-50/60 flex flex-col">
      <div className="px-4 py-5 border-b border-neutral-200">
        <div className="text-xs uppercase tracking-wide text-neutral-400">Mailer</div>
        <div className="font-semibold text-neutral-800 truncate">{cuentaNombre}</div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-amber-50 text-amber-700 font-medium'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              ].join(' ')}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-neutral-200 text-xs text-neutral-400">
        areben-mailer · v0
      </div>
    </aside>
  );
}
