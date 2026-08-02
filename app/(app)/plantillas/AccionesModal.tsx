import { TRIGGERS_UI } from "@/app/(app)/automations/presets-ui";
import { type Trigger } from "@/lib/automations";
import { usarComoAutomation } from "./actions";

/**
 * El pie del modal de una plantilla: qué se crea con ella.
 *
 * Server component. Viaja como prop a `TarjetaPlantilla` (que sí es cliente):
 * los `<form>` con server action se renderizan del lado del servidor y llegan
 * armados, así que esto no necesita ni un estado de cliente.
 *
 * 🔑 Acá es donde se murió la palabra "Usar". La galería ofrecía un botón que no
 * decía qué iba a pasar —creaba una campaña BORRADOR y abría el editor—; ahora
 * dice **Editar**, que es lo que uno viene a hacer después de mirar un diseño.
 *
 * 🔴 **El disparador NO se elige acá.** El primer intento ponía un selector de
 * trigger en este modal y no se entendía: estás mirando diseños y de golpe te
 * preguntan por un evento de la tienda. El camino va al revés — se arranca en
 * `/automations`, donde el contexto ya está puesto ("quiero armar la
 * bienvenida"), y de ahí se cae acá con `?para=<trigger>` para elegir el diseño.
 * Cuando eso pasa, `para` viene cargado y el botón de arriba es ese.
 */

const BOTON =
  "inline-block rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover";
const BOTON_SEC =
  "inline-block rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-muted hover:border-border-strong";

/** Qué bloque necesita cada disparador para no salir a medias. */
const BLOQUE_QUE_PIDE: Partial<Record<Trigger, { bloque: string; falta: string }>> = {
  // `aplicarCuponDelTrigger` PISA el texto del bloque `cupon` con el premio real
  // —o lo borra si no hay código—, pero no lo crea: sin el bloque, la bienvenida
  // sale sin el cupón que la persona acaba de ganar.
  NUEVO_SUSCRIPTOR: { bloque: "cupon", falta: "saldría sin el cupón que la persona ganó" },
  // El procesador llena el bloque `carrito` con lo que quedó adentro. Sin él, el
  // mail de carrito abandonado no muestra ningún producto.
  CARRITO_ABANDONADO: { bloque: "carrito", falta: "saldría sin los productos del carrito" },
};

export function AccionesModal({
  origen,
  /** La acción que crea la campaña, ya atada al id (`usarPreset` o `usarPlantilla`). */
  crearCampania,
  /** Los tipos de bloque que tiene esta plantilla, para avisar lo que falta. */
  tipos,
  /** Si se está eligiendo el diseño de una automation, cuál. */
  para,
  /** Botones extra (Editar la plantilla original, en las guardadas). */
  extra,
}: {
  origen: { tipo: "preset" | "plantilla"; id: string };
  crearCampania: () => void | Promise<void>;
  tipos: string[];
  para?: Trigger;
  extra?: React.ReactNode;
}) {
  const label = (t: Trigger) => TRIGGERS_UI.find((u) => u.trigger === t)?.titulo ?? t;
  // El aviso se calcula MIRANDO los bloques de esta plantilla, no con una regla
  // general: decirlo siempre sería ruido, y acá es donde se decide de verdad.
  const pide = para ? BLOQUE_QUE_PIDE[para] : undefined;
  const falta = pide && !tipos.includes(pide.bloque) ? pide : null;

  if (para) {
    return (
      <>
        <form action={usarComoAutomation.bind(null, origen, para)}>
          <button className={BOTON}>Usar esta para «{label(para)}»</button>
        </form>
        <form action={crearCampania}>
          <button className={BOTON_SEC}>Editar como campaña</button>
        </form>
        <span className="w-full text-xs text-subtle">
          Se copia el diseño a la automation, que queda <b>pausada</b>: no manda nada hasta que la
          prendas.
        </span>
        {falta && (
          <p className="w-full text-xs text-warning-foreground">
            ⚠️ Esta plantilla no tiene bloque de {falta.bloque === "cupon" ? "cupón" : "carrito"}:{" "}
            {falta.falta}. Se lo podés agregar en el editor.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      {/* 🔑 Dice "Editar" y no "Crear campaña" a propósito: lo que uno quiere
          después de mirar una plantilla es meterle mano, no comprometerse con
          algo. Igual CREA una campaña en borrador —es lo único que se puede
          editar—, y por eso lo aclara la línea de abajo en vez del botón.
          ⚠️ En "Mis plantillas" el otro botón edita la plantilla ORIGINAL: son
          dos "editar" distintos y la palabra "original" es la que los separa. */}
      <form action={crearCampania}>
        <button className={BOTON}>Editar esta plantilla</button>
      </form>
      {extra}
      <span className="w-full text-xs text-subtle">
        Se copia el diseño a una campaña nueva, en borrador. La plantilla no se toca.
      </span>
    </>
  );
}
