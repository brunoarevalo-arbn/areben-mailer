"use client";

import { Select } from "@/components/ui/Select";
import { tapTarget } from "@/lib/ui";
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
/**
 * Lo que dice el campo "Texto del botón" de los dos bloques de grilla.
 *
 * Vive acá por el mismo motivo que el componente: con cuatro por fila el motor
 * **no dibuja el botón** (no entra en la tarjeta; ver `PorFila`), y un campo que
 * sigue aceptando texto sin avisarlo es exactamente la clase de silencio que
 * hace que alguien mande un mail creyendo que tiene botones.
 */
export const hintBotonGrilla = (porFila?: PorFila): string =>
  porFila === 4
    ? "Con cuatro por fila el botón no se dibuja: no entra en una tarjeta de ese ancho. El texto se guarda igual y vuelve al bajar a 3 o a 2."
    : "Va debajo de cada producto y lleva a su página. Vacío, no se dibuja.";

export function GrillaControl({
  movil,
  porFila,
  onChange,
}: {
  movil?: PorFilaMovil;
  porFila?: PorFila;
  onChange: (cambio: { movil?: PorFilaMovil; porFila?: PorFila }) => void;
}) {
  // Tres y cuatro comparten todo lo que le importa a este control: la fila no se
  // parte en el celular. Preguntar por "≠ 2" y no enumerar es lo que hace que un
  // valor nuevo no se olvide acá.
  const apila = porFila === 3 || porFila === 4;
  return (
    <>
      <Select
        label="En la computadora"
        fullWidth
        // Ausente = 2, igual que en el render: es como se dibujó la grilla desde
        // el día uno y el control tiene que mostrar lo que el mail hace.
        value={String(porFila ?? 2)}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange({ porFila: v === 3 || v === 4 ? v : 2 });
        }}
        hint="Tres por fila es lo que hace la mayoría de las tiendas: entra más producto sin que el mail se haga interminable. De a dos la foto sale más grande, y de a cuatro es una fila de fotos —sin botón, porque no entra—."
      >
        <option value="2">2 productos por fila</option>
        <option value="3">3 productos por fila</option>
        <option value="4">4 productos por fila</option>
      </Select>
      <Select
        label="En el celular"
        fullWidth
        // Con tres por fila la grilla apila sí o sí y el control se apaga:
        // dejarlo elegible sería prometer algo que el mail no hace. El porqué
        // está en `PorFila`, en bloques.ts.
        //
        // 🔴 Muestra el valor GUARDADO, no un "1" inventado. Hasta el
        // 4-ago-2026 decía `tres ? 1 : movil ?? 1`, así que un bloque con
        // `movil: 2` —que es lo que traen siete plantillas, todas junto con
        // `porFila: 3`— se veía en "1". El dato en pantalla no era el del
        // bloque, y al bajar la computadora a 2 el celular "cambiaba solo" a un
        // valor que en realidad ya estaba puesto.
        value={String(movil ?? 1)}
        disabled={apila}
        onChange={(e) => onChange({ movil: Number(e.target.value) === 2 ? 2 : 1 })}
        hint={
          apila
            ? `Con ${porFila === 4 ? "cuatro" : "tres"} por fila en la computadora, en el celular se apila: una fila de ${porFila === 4 ? "cuatro" : "tres"} no se puede partir en dos sin romper el mail en Outlook.`
            : "De a dos entra el doble de producto en la misma pantalla y se comparan de un vistazo. De a uno la foto sale más grande."
        }
      >
        <option value="1">1 producto por fila</option>
        <option value="2">2 productos por fila</option>
      </Select>
      {apila && (
        // El control apagado decía el MOTIVO y no el CAMINO. Que haya que
        // deducir "entonces bajá el de arriba a 2" es lo que lo hace parecer
        // roto en vez de decidido: el hint está abajo, en 12px y en gris, y lo
        // que uno mira es el select que no responde.
        <button
          type="button"
          onClick={() => onChange({ porFila: 2 })}
          className={`${tapTarget} self-start rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground`}
        >
          Poner 2 en la computadora para poder elegir acá
        </button>
      )}
    </>
  );
}
