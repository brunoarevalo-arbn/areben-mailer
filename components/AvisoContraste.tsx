"use client";

import { hallazgoEnTexto, invisiblesDe, type HallazgoContraste } from "@/lib/email/revisar";

/**
 * El cartel de "esto no se lee", en el momento de mandar.
 *
 * 🔴 **Es la mitad que le faltaba al aviso del panel.** `PanelEstilo` avisa del
 * bloque abierto, y el `$fondo` que dejó seis nombres de producto invisibles en
 * el T01 de BDI estaba en un bloque que nadie había vuelto a abrir. Este mira el
 * documento entero y vive **pegado al botón que manda**, que es el único lugar
 * por el que pasa todo el mundo.
 *
 * 🔑 **No bloquea nada.** Un color elegido se sigue respetando —es el mail de
 * quien lo arma—; lo que cambia es que ahora se ve antes, y que lo invisible
 * además pregunta (ver `preguntaAntesDeMandar`).
 */
export function AvisoContraste({ hallazgos }: { hallazgos: readonly HallazgoContraste[] }) {
  if (!hallazgos.length) return null;
  const ciegos = invisiblesDe(hallazgos);
  const grave = ciegos.length > 0;
  // Con algo invisible se nombra SOLO lo invisible: mezclarlo con los grises
  // flojos diluye lo único que de verdad hay que arreglar antes de mandar.
  const lista = grave ? ciegos : hallazgos;

  return (
    <div
      role="status"
      className={`space-y-1 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        grave
          ? "border-danger-border bg-danger text-danger-foreground"
          : "border-warning-border bg-warning text-warning-foreground"
      }`}
    >
      <div>
        <strong>{grave ? "No se ve:" : "Se lee con dificultad:"}</strong>{" "}
        {grave
          ? "el color elegido es casi el mismo que el del fondo, y así va a llegar a la casilla."
          : "el color elegido tiene poco contraste con su fondo."}
      </div>
      <ul className="space-y-0.5">
        {lista.map((h, i) => (
          <li key={`${h.bloqueId}-${h.rol}-${i}`}>
            · Bloque {h.posicion}: {hallazgoEnTexto(h)}
          </li>
        ))}
      </ul>
    </div>
  );
}
