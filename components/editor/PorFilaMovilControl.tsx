"use client";

import { Select } from "@/components/ui/Select";
import type { PorFilaMovil } from "@/lib/email/bloques";

/**
 * "En el celular: 1 o 2 productos por fila."
 *
 * Vive en un componente propio porque son **dos** los bloques que dibujan la
 * misma grilla —`productos` (elegidos a mano) y `productos-dinamicos` (la
 * consulta)— y el control tiene que decir exactamente lo mismo en los dos. Dos
 * copias del `<Select>` es dos textos que se van separando.
 *
 * ⚠️ No va al panel de estilo: no es una propiedad de un rol (título, cuerpo,
 * caja), es la forma del bloque. En escritorio siempre son dos por fila.
 */
export function PorFilaMovilControl({
  movil,
  onChange,
}: {
  movil?: PorFilaMovil;
  onChange: (movil: PorFilaMovil) => void;
}) {
  return (
    <Select
      label="En el celular"
      fullWidth
      // Ausente = 1, igual que en el render: un mail guardado antes de que esto
      // existiera apila, y el control tiene que mostrar lo que el mail hace.
      value={String(movil ?? 1)}
      onChange={(e) => onChange(Number(e.target.value) === 2 ? 2 : 1)}
      hint="De a dos entra el doble de producto en la misma pantalla y se comparan de un vistazo. De a uno la foto sale más grande. En la computadora siempre son dos."
    >
      <option value="1">1 producto por fila</option>
      <option value="2">2 productos por fila</option>
    </Select>
  );
}
