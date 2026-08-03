import Link from "next/link";
import type { EstadoCampania } from "@prisma/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { BotonVistaPrevia } from "@/components/BotonVistaPrevia";
import { BotonEliminar } from "@/components/BotonEliminar";
import { tapTarget } from "@/lib/ui";
import { horaLocal } from "@/lib/fechas";
import { crearCampania, eliminarCampania } from "./actions";

export const dynamic = "force-dynamic";

const estadoBadge: Record<string, "default" | "amber" | "blue" | "success"> = {
  BORRADOR: "default",
  PROGRAMADA: "amber",
  ENVIANDO: "blue",
  ENVIADA: "success",
  CANCELADA: "default",
};

/**
 * Los filtros de arriba. Mismo mecanismo que las familias de la galería: un link
 * con querystring, sin estado de cliente ni un `"use client"` de más.
 *
 * Son tres y no cinco: `PROGRAMADA` la escribe `programarCampania` desde el
 * 3-ago-2026 y por eso tiene su pestaña. `CANCELADA` sigue sin tener una — la
 * escribe solo la ventana de gracia del cron (`lib/email/programadas.ts`) cuando
 * una programada no pudo salir en 2 horas, que es un caso raro y que no se busca
 * por pestaña: aparece igual en "Todas".
 */
const FILTROS: readonly { id: string; label: string; estados: EstadoCampania[] | null }[] = [
  { id: "todas", label: "Todas", estados: null },
  { id: "borradores", label: "Borradores", estados: ["BORRADOR"] },
  { id: "programadas", label: "Programadas", estados: ["PROGRAMADA"] },
  { id: "enviadas", label: "Enviadas", estados: ["ENVIANDO", "ENVIADA"] },
];

const esFiltro = (x: string | undefined) => !!x && FILTROS.some((f) => f.id === x);

export default async function CampaniasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado: estadoParam } = await searchParams;
  // Un filtro inventado por la URL cae a "todas", no rompe la página.
  const activo = esFiltro(estadoParam) ? estadoParam! : "todas";
  const filtro = FILTROS.find((f) => f.id === activo)!;

  const cuenta = await getCuentaActiva();
  const campanias = await prisma.campania.findMany({
    where: {
      cuentaId: cuenta.id,
      ...(filtro.estados ? { estado: { in: filtro.estados } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { envios: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Envíos"
        title="Campañas"
        subtitle={`${campanias.length} ${activo === "todas" ? "campañas" : filtro.label.toLowerCase()}`}
        actions={
          <form action={crearCampania}>
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              + Crear campaña
            </button>
          </form>
        }
      />

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max gap-2">
          {FILTROS.map((f) => {
            const sel = f.id === activo;
            return (
              <Link
                key={f.id}
                href={f.id === "todas" ? "/campanias" : `/campanias?estado=${f.id}`}
                className={`${tapTarget} flex items-center whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition-colors ${
                  sel
                    ? "bg-accent font-medium text-accent-foreground"
                    : "border border-border text-muted hover:border-border-strong hover:bg-surface-muted"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {campanias.length === 0 ? (
        <EmptyState
          title={activo === "todas" ? "Sin campañas" : `Sin ${filtro.label.toLowerCase()}`}
          message="Creá tu primera campaña para empezar a comunicarte con tus contactos."
        />
      ) : (
        <div className="space-y-2">
          {/* 🔴 La fila NO es un `<Link>` que envuelve todo. Un `<button>` adentro
              de un `<a>` es HTML inválido y el click navega igual, así que las
              acciones van afuera del ancla: el link cubre el nombre y el asunto,
              que es lo que uno toca para entrar a editar. */}
          {campanias.map((c) => (
            <Card key={c.id} padding="compact" className="transition-colors hover:border-accent">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={`/campanias/${c.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{c.nombre}</div>
                  <div className="truncate text-sm text-muted">
                    {c.asunto || <span className="italic">sin asunto</span>}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {c._count.envios > 0 && (
                    <span className="text-sm text-subtle tabular-nums">
                      {c._count.envios.toLocaleString("es-AR")} envíos
                    </span>
                  )}
                  {/* La hora va PEGADA al badge: "PROGRAMADA" sin cuándo obliga a
                      abrir la campaña para saber lo único que importa de ese
                      estado. Se esconde abajo de `sm` porque ahí la fila ya está
                      llena — el editor la sigue mostrando entera. */}
                  {c.estado === "PROGRAMADA" && c.programadaAt && (
                    <span className="hidden text-sm text-subtle sm:inline">{horaLocal(c.programadaAt)}</span>
                  )}
                  <Badge variant={estadoBadge[c.estado] ?? "default"}>{c.estado}</Badge>
                  <BotonVistaPrevia
                    titulo={c.nombre}
                    fuente={{ tipo: "campania", id: c.id }}
                    acciones={
                      <Link
                        href={`/campanias/${c.id}`}
                        className="inline-block rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                      >
                        Abrir el editor
                      </Link>
                    }
                  />
                  {/* Solo los borradores. Una campaña que ya salió no muestra el
                      botón: de sus `Envio` cuelga la supresión por rebote. */}
                  {c.estado === "BORRADOR" && c._count.envios === 0 && (
                    <BotonEliminar
                      accion={eliminarCampania.bind(null, c.id)}
                      confirmacion={`¿Eliminar el borrador "${c.nombre}"?\n\nSe pierde el diseño. Si lo querés reusar, guardalo como plantilla desde el editor.`}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
