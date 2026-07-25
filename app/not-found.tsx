import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

// 404 del panel (requisito de homologación, junto con la plantilla de error).
export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <EmptyState
        icon="🧭"
        title="No encontramos esta página"
        message="Puede que el enlace esté viejo o que la hayamos movido."
        action={
          <Link href="/">
            <Button variant="accent" size="sm">
              Volver al inicio
            </Button>
          </Link>
        }
      />
    </div>
  );
}
