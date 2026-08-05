"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { campoCompacto, tapTarget } from "@/lib/ui";

/**
 * Un número que se elige con `−` y `+`, o tecleándolo.
 *
 * Reemplazó a los `<input type="range">` de todo el editor el 5-ago-2026. La
 * devolución fue literal —*«eso de la barra es medio molesto en todo»*— y el
 * porqué es que **una barra no sabe decir un número**: para pasar de 14 a 16 hay
 * que acertarle a 2 de 38 pixeles de recorrido, y para saber en cuánto quedó hay
 * que mirar a otro lado. Un campo con dos botones dice el valor, lo deja teclear
 * y hace el paso exacto.
 *
 * ### Lo que no es obvio
 *
 * - **No reusa `NumInput`**, aunque es el otro campo numérico de la casa. Ese
 *   resuelve el "problema del 0" mostrando **vacío cuando el valor es 0**, que es
 *   lo correcto en un formulario de plata y lo contrario de lo que hace falta acá:
 *   `padX: 0` es una elección legítima y frecuente, y un campo en blanco donde
 *   dice "Margen lateral" se lee como roto. Lo que sí se le copió es el manejo de
 *   la **coma decimal argentina**, que la interlínea necesita (paso 0,05).
 * - **Mientras se tipea sólo se emite lo que está en rango; el clamp va al salir
 *   del campo.** Emitir clampeado en cada tecla hace que escribir "18" con mínimo
 *   8 salte a 8 en la primera tecla y te coma el 1.
 * - **El paso se redondea a los decimales del propio paso.** Sin eso,
 *   `1.85 + 0.05` da `1.9000000000000001` y el valor entra al Json así.
 * - **Mantener apretado repite**, con 400 ms de gracia: ir de 14 a 40 de a un
 *   click son 26 clicks, y ése era justo el reclamo.
 */

const parse = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const mostrar = (v: number) => String(v).replace(".", ",");
/** Los decimales que admite el paso: 1 → 0, 0,05 → 2. */
const decimalesDe = (paso: number) => (String(paso).split(".")[1] ?? "").length;

export function Stepper({
  value,
  onChange,
  min,
  max,
  paso = 1,
  sufijo = "px",
  etiqueta,
  atenuado = false,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  paso?: number;
  sufijo?: string;
  /** Para los lectores de pantalla y los `aria-label` de los dos botones. */
  etiqueta: string;
  /** El valor viene heredado: se muestra en gris, como el "· auto" del panel. */
  atenuado?: boolean;
}) {
  const [buf, setBuf] = useState(() => mostrar(value));
  const repeticion = useRef<{ espera?: ReturnType<typeof setTimeout>; tic?: ReturnType<typeof setInterval> }>({});

  // El valor puede cambiar por fuera del campo: eligiendo otro bloque, con un
  // ⌘Z, o apretando el `+`. Sin esto el buffer se queda con lo viejo.
  const [ultimo, setUltimo] = useState(value);
  if (ultimo !== value) {
    setUltimo(value);
    if (parse(buf) !== value) setBuf(mostrar(value));
  }

  const acotar = (n: number) => Math.min(max, Math.max(min, n));
  const redondear = (n: number) => Number(n.toFixed(decimalesDe(paso)));

  function mover(signo: 1 | -1) {
    const proximo = acotar(redondear(value + signo * paso));
    if (proximo !== value) onChange(proximo);
  }

  // ⚠️ El `+` mantenido tiene que leer el valor de CADA render, no el del
  // render en que se apretó: con el intervalo cerrando sobre `value`, sumaba
  // siempre el mismo paso al mismo número y el valor no se movía del segundo.
  const moverRef = useRef(mover);
  useEffect(() => {
    moverRef.current = mover;
  });

  function frenar() {
    clearTimeout(repeticion.current.espera);
    clearInterval(repeticion.current.tic);
    repeticion.current = {};
  }
  useEffect(() => frenar, []);

  function arrancar(signo: 1 | -1) {
    moverRef.current(signo);
    frenar();
    repeticion.current.espera = setTimeout(() => {
      repeticion.current.tic = setInterval(() => moverRef.current(signo), 60);
    }, 400);
  }

  const boton =
    `flex ${tapTarget} h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border ` +
    `text-muted transition-colors hover:bg-surface-muted hover:text-foreground ` +
    `disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Bajar ${etiqueta}`}
        disabled={value <= min}
        // `onPointerDown` y no `onClick`: el click llega recién al soltar, y
        // entonces mantener apretado no podría repetir nunca.
        onPointerDown={() => arrancar(-1)}
        onPointerUp={frenar}
        onPointerLeave={frenar}
        onPointerCancel={frenar}
        className={boton}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>

      <div className="relative flex-1">
        <input
          type="text"
          inputMode="decimal"
          aria-label={etiqueta}
          value={buf}
          onChange={(e) => {
            const limpio = e.target.value.replace(/[^0-9.,-]/g, "");
            setBuf(limpio);
            const n = parse(limpio);
            if (n !== null && n >= min && n <= max) onChange(redondear(n));
          }}
          onBlur={() => {
            const n = parse(buf);
            const final = n === null ? value : acotar(redondear(n));
            setBuf(mostrar(final));
            if (final !== value) onChange(final);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              // Sin esto el cursor se va al principio o al final del texto.
              e.preventDefault();
              mover(e.key === "ArrowUp" ? 1 : -1);
            }
          }}
          // La ruedita no cambia el valor: scrolleando el panel con el mouse
          // encima de un campo, cambiaría el que pasa por debajo.
          onWheel={(e) => e.currentTarget.blur()}
          // ⚠️ `campoCompacto` y no un borde a mano: es el único lugar donde
          // vive el `text-base lg:text-sm` que evita que iOS Safari zoomee al
          // enfocar, y `lib/ui.ts` explica por qué el `py` no se pisa desde acá.
          className={`w-full ${campoCompacto} text-center tabular-nums ${
            atenuado ? "text-subtle" : "text-foreground"
          } ${sufijo ? "pr-7" : ""}`}
        />
        {sufijo && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-subtle"
          >
            {sufijo}
          </span>
        )}
      </div>

      <button
        type="button"
        aria-label={`Subir ${etiqueta}`}
        disabled={value >= max}
        onPointerDown={() => arrancar(1)}
        onPointerUp={frenar}
        onPointerLeave={frenar}
        onPointerCancel={frenar}
        className={boton}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
