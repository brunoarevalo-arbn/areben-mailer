import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { usarPlantilla, usarPreset, eliminarPlantilla, crearPlantilla } from "./actions";
import { presetsGaleria, FAMILIAS, type Familia } from "@/lib/plantillas/presets";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { renderEmailHtml, aplicarMergeTags } from "@/lib/email/render";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { leerContenido } from "@/lib/email/esquema";
import { marcaDe, hostDeEnvio } from "@/lib/marca";
import { MiniaturaMail } from "@/components/MiniaturaMail";
import { tapTarget } from "@/lib/ui";

export const dynamic = "force-dynamic";

const esFamilia = (x: string | undefined): x is Familia =>
  !!x && FAMILIAS.some((f) => f.id === x);

export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: Promise<{ familia?: string }>;
}) {
  const { familia: familiaParam } = await searchParams;
  // Una familia inventada por la URL cae a la primera, no rompe la página.
  const activa: Familia = esFamilia(familiaParam) ? familiaParam : FAMILIAS[0].id;

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

  const todas = presetsGaleria(cuenta, remitente?.email);
  // ⚠️ Solo se DIBUJA la familia activa. `renderEmailHtml` devuelve el mail
  // entero —unos 30 KB cada uno— y esto es un server component: lo que se
  // renderiza acá viaja al navegador dentro del payload. Con las 12 de hoy ya
  // eran ~350 KB por visita; con las 30+ que vienen pasaba el megabyte, en un
  // panel que el comerciante abre desde el celular.
  const delaFamilia = todas.filter((p) => p.familia === activa);
  const contenidosGuardados = plantillas.map((p) => ({ ...p, contenido: leerContenido(p.contenido) }));

  // 🔑 Las miniaturas se dibujan con los productos DE VERDAD de la tienda.
  //
  // Hasta el 1-ago-2026 `opts` no llevaba `productosDinamicos`, así que las ocho
  // plantillas con grilla la dibujaban vacía —el bloque sin productos no se
  // dibuja a propósito— y la galería entera parecía un montón de mails pelados.
  // Era la causa principal de "las plantillas se ven pobres", más que el hero.
  //
  // El costo es acotado: las consultas distintas de una familia son dos o tres,
  // `resolverProductosDinamicos` las pide en paralelo, cachea 10 minutos por
  // cuenta+consulta y **nunca lanza** — si TN no contesta, la miniatura sale sin
  // grilla y la página igual.
  // Van también los bloques de las plantillas guardadas: son las que el
  // comerciante armó él, y son las que más le importa reconocer de un vistazo.
  const productosDinamicos = await resolverProductosDinamicos(
    [...delaFamilia, ...contenidosGuardados].flatMap((p) => p.contenido.bloques),
    cuenta,
  );

  const marca = marcaDe(cuenta);
  const opts = {
    unsubscribeUrl: "#",
    assetsBase: hostDeEnvio(cuenta, process.env.APP_URL ?? ""),
    productosDinamicos,
    // Igual que el preview del editor: el `carrito` se llena con productos de
    // muestra para que se vea de qué se trata la plantilla. ⛔ Es solo de
    // preview — `probar-carrito.ts` fija que la muestra no sale en un envío.
    muestraCarrito: true,
    ...marca,
  };
  const ejemplo = { nombre: "Ana", email: "ana@ejemplo.com" };
  const vista = (c: Parameters<typeof renderEmailHtml>[0]) =>
    aplicarMergeTags(renderEmailHtml(c, opts), ejemplo);

  const previews = delaFamilia.map((p) => ({ preset: p, html: vista(p.contenido) }));

  const guardadas = contenidosGuardados.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    bloques: p.contenido.bloques.length,
    html: vista(p.contenido),
  }));

  const cuantas = (f: Familia) => todas.filter((p) => p.familia === f).length;
  const descripcion = FAMILIAS.find((f) => f.id === activa)!.descripcion;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contenido"
        title="Plantillas"
        subtitle="Empezá desde una prearmada o reusá tus diseños guardados."
      />

      {/* Prearmadas (vienen con la app), agrupadas por familia */}
      <section className="space-y-3">
        {/* Scroll horizontal en celular: seis pestañas no entran en 375px, y
            apilarlas se comería la pantalla antes de la primera miniatura. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex w-max gap-2">
            {FAMILIAS.map((f) => {
              const sel = f.id === activa;
              return (
                <Link
                  key={f.id}
                  href={`/plantillas?familia=${f.id}`}
                  className={`${tapTarget} flex items-center whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition-colors ${
                    sel
                      ? "bg-accent font-medium text-accent-foreground"
                      : "border border-border text-muted hover:border-border-strong hover:bg-surface-muted"
                  }`}
                >
                  {f.nombre} <span className={sel ? "opacity-70" : "text-subtle"}>&nbsp;({cuantas(f.id)})</span>
                </Link>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-muted">{descripcion}</p>

        {previews.length === 0 ? (
          <EmptyState
            title="Todavía no hay plantillas en esta familia"
            message="Se van sumando a medida que armamos nuevas. Mirá las otras pestañas."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
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
