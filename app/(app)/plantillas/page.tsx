import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { usarPlantilla, usarPreset, eliminarPlantilla } from "./actions";
import { PRESETS } from "@/lib/plantillas/presets";
import { renderEmailHtml, aplicarMergeTags, type ContenidoCampania } from "@/lib/email/render";
import { temaDe } from "@/lib/email/tema";

export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const cuenta = await getCuentaActiva();
  const plantillas = await prisma.plantilla.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: { createdAt: "desc" },
  });

  // Preview de cada prearmada (render real, con un nombre de ejemplo para los merge tags).
  const temaMarca = temaDe(cuenta.config);
  const previews = PRESETS.map((p) => {
    // Con el tema de la marca: la galería tiene que mostrar cómo va a quedar
    // ESTA tienda, no una versión genérica que después no se parece a nada.
    const html = renderEmailHtml({ bloques: p.bloques, tema: p.tema }, { unsubscribeUrl: "#", nombreCuenta: cuenta.nombre, temaMarca });
    return { preset: p, html: aplicarMergeTags(html, { nombre: "Ana", email: "ana@ejemplo.com" }) };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contenido"
        title="Plantillas"
        subtitle="Empezá desde una prearmada o reusá tus diseños guardados."
      />

      {/* Prearmadas (vienen con la app) */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Prearmadas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {previews.map(({ preset, html }) => (
            <Card key={preset.id} padding="none" className="overflow-hidden">
              <div className="h-56 overflow-hidden border-b border-border bg-white">
                <iframe
                  title={preset.nombre}
                  srcDoc={html}
                  className="pointer-events-none h-[560px] w-[400px] origin-top-left"
                  style={{ transform: "scale(0.68)" }}
                  tabIndex={-1}
                />
              </div>
              <div className="p-4">
                <div className="font-medium text-foreground">{preset.nombre}</div>
                <div className="mt-1 text-xs text-muted">{preset.descripcion}</div>
                <form action={usarPreset.bind(null, preset.id)} className="mt-3">
                  <button className="w-full rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
                    Usar
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Mis plantillas (guardadas desde el editor) */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Mis plantillas <span className="text-subtle">({plantillas.length})</span>
        </h2>
        {plantillas.length === 0 ? (
          <EmptyState
            title="Sin plantillas guardadas"
            message='Abrí una campaña, armá el diseño y tocá "Guardar como plantilla" para reusarlo.'
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantillas.map((p) => {
              const nBloques = ((p.contenido as unknown as ContenidoCampania)?.bloques ?? []).length;
              return (
                <Card key={p.id}>
                  <div className="font-medium text-foreground">{p.nombre}</div>
                  <div className="mt-1 text-sm text-subtle">{nBloques} bloques</div>
                  <div className="mt-3 flex items-center gap-2">
                    <form action={usarPlantilla.bind(null, p.id)}>
                      <button className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover">
                        Usar
                      </button>
                    </form>
                    <form action={eliminarPlantilla.bind(null, p.id)}>
                      <button className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:border-border-strong">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
