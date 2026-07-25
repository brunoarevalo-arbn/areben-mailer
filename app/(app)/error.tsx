'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';

// Plantilla de error del panel (requisito de homologación de Tiendanube).
// Cubre cualquier error no manejado dentro de (app) sin sacar al usuario de la
// aplicación: mantiene el layout y ofrece reintentar.
export default function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[panel]', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Ups" title="Algo salió mal" subtitle="No pudimos cargar esta sección." />
      <ErrorState
        message={
          <>
            <p>Puede ser algo momentáneo. Probá de nuevo y, si sigue, escribinos.</p>
            {error.digest && <p className="mt-1 text-xs opacity-70">Referencia: {error.digest}</p>}
          </>
        }
        action={
          <Button variant="secondary" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
            Reintentar
          </Button>
        }
      />
    </div>
  );
}
