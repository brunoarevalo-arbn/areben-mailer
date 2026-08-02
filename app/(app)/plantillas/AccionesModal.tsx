import Link from "next/link";
import { TRIGGERS_UI } from "@/app/(app)/automations/presets-ui";
import { type Trigger } from "@/lib/automations";
import { campoCompacto } from "@/lib/ui";
import { usarComoAutomation } from "./actions";

/**
 * El pie del modal de una plantilla: qué se crea con ella.
 *
 * Server component. Viaja como prop a `TarjetaPlantilla` (que sí es cliente):
 * los `<form>` con server action se renderizan del lado del servidor y llegan
 * armados, así que elegir el disparador no necesita ni un estado de cliente.
 *
 * 🔑 Acá es donde se murió la palabra "Usar". La galería ofrecía un botón que no
 * decía qué iba a pasar —creaba una campaña BORRADOR y abría el editor—; ahora
 * cada botón nombra lo que crea.
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
  /** Los disparadores que todavía no tienen automation en esta cuenta. */
  libres,
  /** Los que ya la tienen, para poder ir a esa en vez de ofrecer otra. */
  ocupados,
  /** Botones extra (Editar el diseño, en las guardadas). */
  extra,
}: {
  origen: { tipo: "preset" | "plantilla"; id: string };
  crearCampania: () => void | Promise<void>;
  tipos: string[];
  libres: Trigger[];
  ocupados: { trigger: Trigger; id: string }[];
  extra?: React.ReactNode;
}) {
  const label = (t: Trigger) => TRIGGERS_UI.find((u) => u.trigger === t)?.titulo ?? t;
  // El aviso se calcula MIRANDO los bloques de esta plantilla, no con una regla
  // general: decir "puede faltarte el cupón" en las 38 sería ruido.
  const avisos = libres
    .map((t) => ({ t, pide: BLOQUE_QUE_PIDE[t] }))
    .filter((x) => x.pide && !tipos.includes(x.pide.bloque));

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

      <div className="w-full border-t border-border pt-3">
        {libres.length === 0 ? (
          <p className="text-xs text-muted">
            Ya tenés una automation de cada disparador. Para cambiarle el diseño, entrá a la que
            corresponda desde{" "}
            <Link href="/automations" className="underline">
              Automations
            </Link>
            .
          </p>
        ) : (
          <form action={usarComoAutomation.bind(null, origen)} className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted" htmlFor={`trigger-${origen.id}`}>
              …o que este mail salga <b>solo</b>, cada vez que:
            </label>
            <select id={`trigger-${origen.id}`} name="trigger" className={campoCompacto} defaultValue={libres[0]}>
              {libres.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
            <button className={BOTON_SEC}>Crear automation</button>
            {/* Nace PAUSADA: prenderla es lo que registra el webhook en TN y lo
                que hace que empiecen a salir mails solos. */}
            <span className="w-full text-xs text-subtle">
              Queda en <b>Automations</b>, pausada: no manda nada hasta que la prendas.
            </span>
          </form>
        )}

        {avisos.map(({ t, pide }) => (
          <p key={t} className="mt-2 text-xs text-warning-foreground">
            ⚠️ Como <b>{label(t)}</b>, {pide!.falta}: esta plantilla no tiene bloque de{" "}
            {pide!.bloque === "cupon" ? "cupón" : "carrito"}. Se lo podés agregar en el editor.
          </p>
        ))}

        {ocupados.length > 0 && libres.length > 0 && (
          <p className="mt-2 text-xs text-subtle">
            Ya tenés una de: {ocupados.map((o) => label(o.trigger)).join(", ")}.
          </p>
        )}
      </div>
    </>
  );
}
