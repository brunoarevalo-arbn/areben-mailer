"use client";

import { Select } from "@/components/ui/Select";
import type { PorFila, PorFilaMovil } from "@/lib/email/bloques";

/**
 * La forma de la grilla: cuántos productos por fila, en la computadora y en el
 * celular.
 *
 * Vive en un componente propio porque son **dos** los bloques que dibujan la
 * misma grilla —`productos` (elegidos a mano) y `productos-dinamicos` (la
 * consulta)— y el control tiene que decir exactamente lo mismo en los dos. Dos
 * copias del `<Select>` son dos textos que se van separando.
 *
 * ⚠️ No va al panel de estilo: no es una propiedad de un rol (título, cuerpo,
 * caja), es la forma del bloque.
 */
export function GrillaControl({
  movil,
  porFila,
  onChange,
}: {
  movil?: PorFilaMovil;
  porFila?: PorFila;
  onChange: (cambio: { movil?: PorFilaMovil; porFila?: PorFila }) => void;
}) {
  const tres = porFila === 3;
  return (
    <>
      <Select
        label="En la computadora"
        fullWidth
        // Ausente = 2, igual que en el render: es como se dibujó la grilla desde
        // el día uno y el control tiene que mostrar lo que el mail hace.
        value={String(porFila ?? 2)}
        onChange={(e) => onChange({ porFila: Number(e.target.value) === 3 ? 3 : 2 })}
        hint="Tres por fila es lo que hace la mayoría de las tiendas: entra más producto sin que el mail se haga interminable. De a dos la foto sale más grande."
      >
        <option value="2">2 productos por fila</option>
        <option value="3">3 productos por fila</option>
      </Select>
      <Select
        label="En el celular"
        fullWidth
        // Con tres por fila la grilla apila sí o sí, así que el control muestra
        // "1" y se apaga: dejarlo elegible sería prometer algo que el mail no
        // hace. El porqué está en `PorFila`, en bloques.ts.
        value={String(tres ? 1 : movil ?? 1)}
        disabled={tres}
        onChange={(e) => onChange({ movil: Number(e.target.value) === 2 ? 2 : 1 })}
        hint={
          tres
            ? "Con tres por fila en la computadora, en el celular se apila: una fila de tres no se puede partir en dos sin romper el mail en Outlook."
            : "De a dos entra el doble de producto en la misma pantalla y se comparan de un vistazo. De a uno la foto sale más grande."
        }
      >
        <option value="1">1 producto por fila</option>
        <option value="2">2 productos por fila</option>
      </Select>
    </>
  );
}
