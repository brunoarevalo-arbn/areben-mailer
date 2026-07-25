'use client';

import { useState, useTransition } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { sincronizarContactosTN } from '@/app/(app)/contactos/actions';

type Resultado = { ok: boolean; error: string; nuevos: number; actualizados: number };

/**
 * Trae los clientes de la tienda desde Tiendanube. En una cuenta recién creada
 * no hay fecha de corte, así que importa todo el histórico: puede demorar y por
 * eso el botón lo avisa mientras corre.
 */
export function ImportarContactosBtn() {
  const [pending, startTransition] = useTransition();
  const [res, setRes] = useState<Resultado | null>(null);

  const importar = () =>
    startTransition(async () => {
      setRes(await sincronizarContactosTN());
    });

  return (
    <div className="space-y-2">
      <Button variant="accent" size="sm" onClick={importar} isLoading={pending}>
        <Download className="mr-1.5 h-4 w-4" aria-hidden />
        {pending ? 'Importando…' : 'Importar de Tiendanube'}
      </Button>

      {pending && (
        <p className="text-caption text-muted">
          Puede tardar un rato si tenés muchos clientes: traemos todo el histórico.
        </p>
      )}

      {res && !pending && (
        <p className={`text-sm ${res.ok ? 'text-muted' : 'text-danger-foreground'}`}>
          {res.ok
            ? `✓ ${res.nuevos} contacto${res.nuevos === 1 ? '' : 's'} nuevo${res.nuevos === 1 ? '' : 's'}` +
              (res.actualizados ? ` y ${res.actualizados} actualizado${res.actualizados === 1 ? '' : 's'}.` : '.')
            : `No se pudo importar: ${res.error}`}
        </p>
      )}
    </div>
  );
}
