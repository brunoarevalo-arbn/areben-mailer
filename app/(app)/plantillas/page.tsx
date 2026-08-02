import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { getCuentaActiva } from "@/lib/cuenta";
import { usarPlantilla, usarPreset, eliminarPlantilla, crearPlantilla } from "./actions";
import { presetsGaleria, FAMILIAS, type Familia } from "@/lib/plantillas/presets";
import { getRemitenteEnvio } from "@/lib/remitentes";
import { renderEmailHtml, aplicarMergeTags } from "@/lib/email/render";
import { resolverProductosDinamicos } from "@/lib/email/productos-dinamicos";
import { leerContenido } from "@/lib/email/esquema";
import { combinarTema, resolverPaleta } from "@/lib/email/tema";
import { marcaDe } from "@/lib/marca";
import { TarjetaPlantilla } from "@/components/TarjetaPlantilla";
import { automationDelTrigger, esTrigger } from "@/lib/automations";
import { TRIGGERS_UI } from "@/app/(app)/automations/presets-ui";
import { AccionesModal } from "./AccionesModal";
import { tapTarget } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** El botón secundario de la tarjeta (mismas clases de siempre). */
const BOTON_SEC =
  "inline-block rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:border-border-strong";

const tituloTrigger = (t: string) => TRIGGERS_UI.find((u) => u.trigger === t)?.titulo ?? t;

const esFamilia = (x: string | undefined): x is Familia =>
  !!x && FAMILIAS.some((f) => f.id === x);

export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: Promise<{ familia?: string; para?: string }>;
}) {
  const { familia: familiaParam, para: paraParam } = await searchParams;
  // Una familia inventada por la URL cae a la primera, no rompe la página.
  const activa: Familia = esFamilia(familiaParam) ? familiaParam : FAMILIAS[0].id;

  const cuenta = await getCuentaActiva();
  const [plantillas, remitente, automations] = await Promise.all([
    prisma.plantilla.findMany({
      where: { cuentaId: cuenta.id },
      orderBy: { createdAt: "desc" },
    }),
    // El sitio de la tienda sale de `Cuenta.config`; el remitente es el fallback
    // para las cuentas que todavía no lo tienen cargado.
    getRemitenteEnvio(cuenta.id),
    // Para saber qué disparadores quedan libres: una automation por trigger y
    // por cuenta. Ofrecer uno que ya existe sería un botón que no crea nada.
    prisma.automation.findMany({
      where: { cuentaId: cuenta.id },
      select: { id: true, trigger: true, createdAt: true },
    }),
  ]);

  /**
   * Modo "elegí el diseño de esta automation". Se llega desde `/automations`,
   * que es donde el contexto ya está puesto.
   *
   * 🔴 Si ese disparador YA tiene automation, el modo se apaga: una por trigger
   * y por cuenta, porque el disparador manda todas las que matcheen ⇒ la segunda
   * es un segundo mail a la misma persona. La guarda de verdad está igual en la
   * action; esto es para no ofrecer un botón que no va a crear nada.
   */
  const para =
    paraParam && esTrigger(paraParam) && !automationDelTrigger(automations, paraParam)
      ? paraParam
      : undefined;

  const todas = presetsGaleria(cuenta, remitente?.email);
  // ⚠️ Solo se DIBUJA la familia activa. `renderEmailHtml` devuelve el mail
  // entero y esto es un server component: lo que se renderiza acá viaja al
  // navegador dentro del payload. Medido con la galería cerrada en 38 y las
  // grillas llenas: **7-21 KB por plantilla**, la pestaña más cargada
  // (catálogo, 12) **168 KB** y las 38 juntas **423 KB**, en un panel que el
  // comerciante abre desde el celular.
  // 🔑 Lo que pesa de verdad no es este HTML sino las fotos que se descargan al
  // pintarlo — por eso `MiniaturaMail` no crea el iframe hasta que la tarjeta
  // se acerca. Filtrar acá y ser perezoso allá son las dos mitades de lo mismo.
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

  const marca = marcaDe(cuenta, process.env.APP_URL ?? "");
  const opts = {
    unsubscribeUrl: "#",
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
  // El ancho del mail decide el marco de "escritorio" de la vista previa: el
  // corte responsive del correo es su propio ancho, así que un marco más angosto
  // mostraría la versión de celular con el toggle puesto en escritorio.
  const ancho = (c: Parameters<typeof renderEmailHtml>[0]) =>
    resolverPaleta(combinarTema(marca.temaMarca, c.tema)).ancho;

  // Los tipos de bloque de cada una: es con lo que el modal avisa que, como
  // bienvenida, esta plantilla saldría sin cupón. Un aviso medido y no una regla
  // general — decirlo en las 38 sería ruido.
  const tiposDe = (c: Parameters<typeof renderEmailHtml>[0]) => [...new Set(c.bloques.map((b) => b.tipo))];

  const previews = delaFamilia.map((p) => ({
    preset: p,
    html: vista(p.contenido),
    ancho: ancho(p.contenido),
    tipos: tiposDe(p.contenido),
  }));

  const guardadas = contenidosGuardados.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    bloques: p.contenido.bloques.length,
    html: vista(p.contenido),
    ancho: ancho(p.contenido),
    tipos: tiposDe(p.contenido),
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

      {/* Modo "elegí el diseño de esta automation". La barra dice para qué se
          está eligiendo y cómo salirse: sin eso, la galería se ve igual que
          siempre y el botón del modal aparecería de la nada. */}
      {para && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
          <div className="text-sm text-accent-subtle-foreground">
            Elegí el diseño para <b>«{tituloTrigger(para)}»</b>
            <span className="mt-0.5 block text-xs text-muted">
              Tocá <b>Ver</b> en la que te guste y confirmá adentro.
            </span>
          </div>
          <Link href="/automations" className={BOTON_SEC}>
            Cancelar
          </Link>
        </div>
      )}

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
                  // El `para` se arrastra entre pestañas: cambiar de familia no
                  // puede sacarte del modo "estoy eligiendo el diseño de la
                  // bienvenida" sin que lo pidas.
                  href={`/plantillas?familia=${f.id}${para ? `&para=${para}` : ""}`}
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
            {previews.map(({ preset, html, ancho: a, tipos }) => (
              <TarjetaPlantilla
                key={preset.id}
                titulo={preset.nombre}
                subtitulo={preset.descripcion}
                html={html}
                anchoMail={a}
                acciones={
                  <AccionesModal
                    origen={{ tipo: "preset", id: preset.id }}
                    crearCampania={usarPreset.bind(null, preset.id)}
                    tipos={tipos}
                    para={para}
                  />
                }
              />
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
              /* Misma tarjeta que las prearmadas: un diseño guardado se reconoce
                 mirándolo, no leyendo "8 bloques". */
              <TarjetaPlantilla
                key={p.id}
                titulo={p.nombre}
                subtitulo={`${p.bloques} bloques`}
                html={p.html}
                anchoMail={p.ancho}
                acciones={
                  <AccionesModal
                    origen={{ tipo: "plantilla", id: p.id }}
                    crearCampania={usarPlantilla.bind(null, p.id)}
                    tipos={p.tipos}
                    para={para}
                    extra={
                      <Link href={`/plantillas/${p.id}`} className={BOTON_SEC}>
                        Editar la plantilla original
                      </Link>
                    }
                  />
                }
                pie={
                  <form action={eliminarPlantilla.bind(null, p.id)}>
                    <button className={BOTON_SEC}>Eliminar</button>
                  </form>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
