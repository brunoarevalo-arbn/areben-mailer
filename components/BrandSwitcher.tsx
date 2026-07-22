'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cambiarCuenta } from '@/app/(app)/actions';

interface Marca {
  id: string;
  nombre: string;
  slug: string;
}

export function BrandSwitcher({
  cuentas,
  activaId,
}: {
  cuentas: Marca[];
  activaId: string;
}) {
  const [open, setOpen] = useState(false);
  const activa = cuentas.find((c) => c.id === activaId) ?? cuentas[0];

  // Una sola marca: mostrar el nombre sin selector.
  if (cuentas.length <= 1) {
    return (
      <div className="px-2 py-1.5 text-xs text-muted truncate">
        {activa?.nombre ?? '—'}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:border-border-strong"
      >
        <span className="truncate font-medium">{activa?.nombre ?? '—'}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
      </button>

      {open && (
        <>
          {/* click-away */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-md">
            {cuentas.map((c) => (
              <form key={c.id} action={cambiarCuenta.bind(null, c.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-muted"
                >
                  <span className="truncate">{c.nombre}</span>
                  {c.id === activa?.id && (
                    <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  )}
                </button>
              </form>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
