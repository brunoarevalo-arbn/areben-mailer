import Link from 'next/link';
import { Check, Store, Users, AtSign, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ImportarContactosBtn } from '@/components/ImportarContactosBtn';

type Paso = {
  titulo: string;
  detalle: string;
  icono: React.ReactNode;
  hecho: boolean;
  accion?: React.ReactNode;
};

/**
 * Guía de primera vez. Reemplaza al dashboard mientras la cuenta está sin
 * estrenar: un comerciante que recién instaló la app veía todo en cero y ningún
 * indicio de por dónde empezar. Cada paso deduce su estado de los datos, así que
 * no hay nada que guardar ni que marcar como completado.
 */
export function PrimerosPasos({
  nombreTienda,
  tiendaConectada,
  tieneContactos,
  tieneRemitente,
  tieneCampania,
  urlConectar,
}: {
  nombreTienda: string;
  tiendaConectada: boolean;
  tieneContactos: boolean;
  tieneRemitente: boolean;
  tieneCampania: boolean;
  urlConectar: string;
}) {
  const pasos: Paso[] = [
    {
      titulo: 'Tienda conectada',
      detalle: tiendaConectada ? nombreTienda : 'Conectá tu Tiendanube para traer tus clientes.',
      icono: <Store className="h-4 w-4" aria-hidden />,
      hecho: tiendaConectada,
      accion: tiendaConectada ? undefined : (
        <a href={urlConectar}>
          <Button variant="accent" size="sm">
            Conectar Tiendanube
          </Button>
        </a>
      ),
    },
    {
      titulo: 'Traé tus contactos',
      detalle: 'Importá los clientes de tu tienda para empezar a escribirles.',
      icono: <Users className="h-4 w-4" aria-hidden />,
      hecho: tieneContactos,
      accion: tieneContactos ? undefined : <ImportarContactosBtn />,
    },
    {
      titulo: 'Configurá tu remitente',
      detalle: 'Desde qué dirección salen los envíos. Hay que verificar el dominio.',
      icono: <AtSign className="h-4 w-4" aria-hidden />,
      hecho: tieneRemitente,
      accion: tieneRemitente ? undefined : (
        <Link href="/remitentes">
          <Button variant="secondary" size="sm">
            Configurar
          </Button>
        </Link>
      ),
    },
    {
      titulo: 'Creá tu primera campaña',
      detalle: 'Elegí una plantilla, escribí y mandá.',
      icono: <Send className="h-4 w-4" aria-hidden />,
      hecho: tieneCampania,
      accion: tieneCampania ? undefined : (
        <Link href="/campanias">
          <Button variant="secondary" size="sm">
            Crear campaña
          </Button>
        </Link>
      ),
    },
  ];

  const listos = pasos.filter((p) => p.hecho).length;

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">Empezá en unos pasos</h2>
        <p className="text-muted text-sm mt-0.5">
          {listos} de {pasos.length} listos. Cuando termines, acá vas a ver las métricas de tus envíos.
        </p>
      </div>

      <ol className="space-y-4">
        {pasos.map((paso, i) => (
          <li key={paso.titulo} className="flex gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                paso.hecho ? 'bg-accent text-accent-foreground' : 'bg-surface-muted text-muted'
              }`}
              aria-hidden
            >
              {paso.hecho ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-subtle">{paso.icono}</span>
                <span className={`text-sm font-medium ${paso.hecho ? 'text-muted line-through' : 'text-foreground'}`}>
                  {paso.titulo}
                </span>
              </div>
              <p className="text-muted text-sm mt-0.5">{paso.detalle}</p>
              {paso.accion && <div className="mt-2">{paso.accion}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
