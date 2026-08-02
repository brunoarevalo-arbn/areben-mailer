"use client";

import { useRef, type ReactNode } from "react";
import { Bold } from "lucide-react";
import { tapTarget } from "@/lib/ui";

/**
 * El botón **N** que envuelve lo seleccionado en `**`.
 *
 * 🔑 No hay editor rich-text y no lo va a haber: el bloque sigue siendo un
 * `string` plano, así que esto no es más que un atajo para escribir cuatro
 * asteriscos en el lugar correcto. Quien prefiera tipearlos a mano obtiene
 * exactamente lo mismo, y eso es lo que evita el bump de esquema, la migración
 * y una segunda definición de "qué es un texto".
 *
 * Envuelve al campo en vez de reemplazarlo (`children`) para no tocarle la API
 * a `Input`/`Textarea` de `components/ui`, y encuentra el control por el DOM:
 * sirve para los dos, que es justo lo que hace falta —la bajada de la portada
 * es un `Input` de una línea y el resto son `Textarea`—.
 */
export function ConNegrita({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (nuevo: string) => void;
  children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);

  const aplicar = () => {
    const el = caja.current?.querySelector("textarea, input") as
      | HTMLTextAreaElement
      | HTMLInputElement
      | null;
    if (!el) return;
    // Sin selección no se adivina qué palabra quiso: se dejan los cuatro
    // asteriscos con el cursor en el medio, que es lo que hace cualquier editor
    // y lo que deja seguir escribiendo sin volver a tocar nada.
    const desde = el.selectionStart ?? value.length;
    const hasta = el.selectionEnd ?? desde;
    const sel = value.slice(desde, hasta);
    onChange(`${value.slice(0, desde)}**${sel}**${value.slice(hasta)}`);
    // El re-foco va después del re-render o el navegador lo pierde: el valor lo
    // controla React y el `<textarea>` se repinta con el string nuevo.
    requestAnimationFrame(() => {
      el.focus();
      const cursor = desde + 2;
      el.setSelectionRange(cursor, cursor + sel.length);
    });
  };

  return (
    <div ref={caja} className="space-y-1.5">
      {children}
      <button
        type="button"
        onClick={aplicar}
        title="Poner en negrita lo seleccionado"
        className={`${tapTarget} inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted hover:border-border-strong`}
      >
        <Bold size={13} aria-hidden />
        Negrita
      </button>
    </div>
  );
}
