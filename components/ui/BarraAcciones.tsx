"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/**
 * La barra de acciones de un editor: pegada abajo de la pantalla y siempre a la
 * vista.
 *
 * Existe porque armar un mail lleva un rato largo y el Guardar vivía **abajo de
 * todo**: con el scroll en el medio del editor había que bajar a buscarlo, y no
 * había ningún atajo. Un editor donde guardar cuesta un viaje es un editor
 * donde se pierde trabajo.
 *
 * 🔴 **`fixed`, no `sticky`.** Un `sticky bottom-0` solo se despega cuando el
 * elemento *querría* salirse de la pantalla; estando estas acciones al final de
 * una página larga, con el scroll arriba no aparecen nunca — que es justo el
 * caso que había que resolver.
 *
 * ⚠️ **El corrimiento izquierdo no es un detalle estético.** El sidebar es parte
 * del flujo (`Sidebar.tsx`), así que un `inset-x-0` pelado centra el contenido
 * contra el VIEWPORT y la barra queda corrida respecto de la página. Abajo de
 * `lg` el sidebar es un cajón y no ocupa lugar, así que ahí va de borde a borde.
 * 🔑 Desde el 5-ago-2026 el ancho del menú es **plegable**, así que acá no puede
 * ir un `lg:left-60` clavado: se lee `--ancho-menu` (definida en `globals.css`
 * por la clase `menu-plegado` de `<html>`). Una variable heredada es lo único
 * que llega hasta acá — esta barra la dibuja la página, no el shell, y no tiene
 * cómo enterarse por props de que alguien plegó el menú.
 *
 * ⚠️ **El cap interno lo decide quien la usa** (`ancho`). Las tres pantallas que
 * la montan son editores, y ahí el layout sube su propio cap a `--ancho-editor`
 * (ver el `has-[[data-editor]]` de `app/(app)/layout.tsx`): si la barra se
 * quedara en `max-w-6xl`, el botón de guardar dejaría de estar alineado con el
 * contenido. Los dos leen **la misma variable**, que es lo que hace que "se
 * mueven juntos" deje de depender de que alguien se acuerde.
 *
 * ⚠️ **`z-20`, a propósito por debajo del cajón.** La escala en uso es `z-30`
 * (barra superior de celular y fondo del cajón), `z-40` (el `<aside>`) y `z-50`
 * (los modales portaleados). Con `z-30` la barra se dibujaba **encima del fondo
 * oscuro** del cajón abierto.
 *
 * ⚠️ **Va afuera del `@container` del editor**, que es lo que la deja ser
 * `fixed` sin portal: `container-type` implica `contain: layout` y vuelve al
 * contenedor el bloque de referencia de todo `fixed` que cuelgue adentro (por
 * eso `ImagenPicker` y `ModalVistaPrevia` sí van portaleados). Es hermana de
 * `EditorMail`, nunca hija.
 */
export function BarraAcciones({
  onGuardar,
  guardando,
  /** El "Guardado ✓" efímero, o lo que el editor quiera decir. */
  mensaje,
  /** Las acciones secundarias: plantilla, prueba, lo que sea. */
  children,
  /** `amplio` acompaña a una página que levantó el cap del layout (los editores). */
  ancho = "normal",
}: {
  onGuardar: () => void;
  guardando?: boolean;
  mensaje?: ReactNode;
  children?: ReactNode;
  ancho?: "normal" | "amplio";
}) {
  /**
   * ⌘S / Ctrl+S.
   *
   * El `preventDefault` es obligatorio: sin él el navegador abre su propio
   * "guardar página", que es la peor respuesta posible a alguien que quiso
   * guardar su campaña. Mismo patrón que el ⌘Z de `useHistorial`.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (!guardando) onGuardar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onGuardar, guardando]);

  // ⚠️ **El hueco que deja la barra lo pone la página, con `pb-24`**, y no este
  // componente con un espaciador propio: en campañas la barra está escrita en
  // el medio del JSX —abajo siguen los paneles de A/B y de envío— y un
  // espaciador acá abriría 96px de aire justo ahí. Es fija: dónde está escrita
  // no dice dónde se dibuja.
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 shadow-lg backdrop-blur lg:left-[var(--ancho-menu)]">
        <div
          className={`mx-auto flex flex-wrap items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 ${
            ancho === "amplio" ? "max-w-[var(--ancho-editor)]" : "max-w-6xl"
          }`}
        >
          <Button variant="primary" onClick={onGuardar} disabled={guardando} title="Guardar (⌘S)">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          {children}
          {mensaje && <span className="text-sm text-muted">{mensaje}</span>}
      </div>
    </div>
  );
}
