import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { usarPlantilla, usarPreset, eliminarPlantilla, crearPlantilla } from "./actions";
import { presetsGaleria } from "@/lib/plantillas/presets";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { renderEmailHtml, aplicarMergeTags } from "@/lib/email/render";
import { leerContenido } from "@/lib/email/esquema";
import { marcaDe, hostDeEnvio } from "@/lib/marca";
import { MiniaturaMail } from "@/components/MiniaturaMail";

export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const cuenta = await getCuentaActiva();
  const [plantillas, remitente] = await Promise.all([
    prisma.plantilla.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { createdAt: "desc" },
    }),
    // El sitio de la tienda sale de `Cuenta.config`; el remitente es el fallback
    // para las cuentas que todavía no lo tienen cargado.
    getRemitenteEnvio(cuenta.id),
  ]);

  const marca = marcaDe(cuenta);
  const opts = { unsubscribeUrl: "#", assetsBase: hostDeEnvio(cuenta, process.env.APP_URL ?? ""), ...marca };
  const ejemplo = { nombre: "Ana", email: "ana@ejemplo.com" };
  const vista = (c: Parameters<typeof renderEmailHtml>[0]) =>
    aplicarMergeTags(renderEmailHtml(c, opts), ejemplo);

  // Prearmadas: los presets de automation no van acá, esos se crean desde
  // /automations con su disparador.
  const previews = presetsGaleria(cuenta, remitente?.email).map((p) => ({
    preset: p,
    html: vista(p.contenido),
  }));

  const guardadas = plantillas.map((p) => {
    const contenido = leerContenido(p.contenido);
    return { id: p.id, nombre: p.nombre, bloques: contenido.bloques.length, html: vista(contenido) };
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
              <MiniaturaMail titulo={preset.nombre} html={html} />
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">
            Mis plantillas <span className="text-subtle">({plantillas.length})</span>
          </h2>
          <form action={crearPlantilla}>
            <button className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:border-border-strong">
              + Nueva plantilla
            </button>
          </form>
        </div>
        {plantillas.length === 0 ? (
          <EmptyState
            title="Sin plantillas guardadas"
            message='Creá una en blanco, o abrí una campaña y tocá "Guardar como plantilla" para reusar su diseño.'
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {guardadas.map((p) => (
              <Card key={p.id} padding="none" className="overflow-hidden">
                {/* Misma miniatura que las prearmadas: un diseño guardado se
                    reconoce mirándolo, no leyendo "8 bloques". */}
                <MiniaturaMail titulo={p.nombre} html={p.html} />
                <div className="p-4">
                  <div className="truncate font-medium text-foreground" title={p.nombre}>
                    {p.nombre}
                  </div>
                  <div className="mt-1 text-xs text-muted">{p.bloques} bloques</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/plantillas/${p.id}`}
                      className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                    >
                      Editar
                    </Link>
                    <form action={usarPlantilla.bind(null, p.id)}>
                      <button className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:border-border-strong">
                        Usar
                      </button>
                    </form>
                    <form action={eliminarPlantilla.bind(null, p.id)}>
                      <button className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:border-border-strong">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
