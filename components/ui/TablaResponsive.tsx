import React from 'react';

/**
 * Una tabla que abajo de `lg` se dibuja como tarjetas.
 *
 * 🔴 **Una columna se declara UNA vez y alimenta las dos ramas.** El camino
 * corto —`hidden lg:table` sobre la tabla de hoy y un `<ul>` nuevo al lado— deja
 * dos markups que derivan en silencio: se agrega una columna a la tabla, nadie
 * se acuerda de las tarjetas, y el comerciante que mira desde el celular ve
 * menos datos que el que mira desde la compu **sin que nada se rompa ni avise**.
 * Acá una columna que no está en `columnas` no existe en ningún lado, y el rol
 * `movil` es lo único que decide dónde cae.
 *
 * ⛔ **No se hace con CSS puro** (`display:block` + `content: attr(data-label)`).
 * Las etiquetas de un pseudo-elemento son texto plano, y dos de las columnas que
 * hay que mostrar en el celular —"Estado" y "Marketing"— **son `<Badge>`**, y la
 * primera de campañas es un `<Link>`.
 *
 * Los roles:
 * - `titulo` — el renglón en negrita de la tarjeta. En escritorio es una columna
 *   como cualquier otra.
 * - `subtitulo` — se dibuja **abajo del título en las dos ramas** y no tiene
 *   columna propia en escritorio. Es exactamente lo que la tabla del home ya
 *   hacía a mano con el asunto de la campaña.
 * - `meta` (default) — par etiqueta/valor en el pie de la tarjeta.
 * - `oculta` — existe solo en escritorio. El único caso legítimo es un dato que
 *   en 343px es ruido; si es un dato que hace falta, va a `meta`.
 */
export type Col<T> = {
  /** Identidad de la columna (para el `key` de React, no se muestra). */
  key: string;
  /** El `<th>` en escritorio y la etiqueta del par en la tarjeta. */
  header: string;
  /** JSX libre: `<Badge>`, `<Link>`, lo que sea. */
  celda: (fila: T) => React.ReactNode;
  align?: 'left' | 'right';
  movil?: 'titulo' | 'subtitulo' | 'meta' | 'oculta';
  /**
   * Clases extra de la celda **de escritorio** (el color del texto, nada más).
   * Existe para que las tablas que ya estaban queden pixel-idénticas: en la
   * tarjeta del celular el valor de un par ya tiene su propio tratamiento, y
   * heredar acá un `text-muted` lo dejaría más apagado que su etiqueta.
   * ⛔ No es un lugar para esconder ni mostrar nada: eso es `movil`.
   */
  clase?: string;
};

interface TablaResponsiveProps<T> {
  filas: T[];
  columnas: Col<T>[];
  /** La `key` de React de cada fila. */
  clave: (fila: T) => string;
  /** Etiqueta accesible de la tabla (no se dibuja). */
  label?: string;
}

export function TablaResponsive<T>({
  filas,
  columnas,
  clave,
  label,
}: TablaResponsiveProps<T>) {
  // El título es el ancla de la tarjeta: si nadie lo declaró, la primera
  // columna. Sin este default una tabla nueva saldría con las tarjetas
  // descabezadas y el error se vería recién en un celular.
  const colTitulo = columnas.find((c) => c.movil === 'titulo') ?? columnas[0];
  const subtitulos = columnas.filter((c) => c.movil === 'subtitulo');
  const metas = columnas.filter(
    (c) => c !== colTitulo && c.movil !== 'subtitulo' && c.movil !== 'oculta',
  );
  // En escritorio están todas menos las de subtítulo, que se dibujan adentro de
  // la celda del título.
  const enTabla = columnas.filter((c) => c.movil !== 'subtitulo');

  /**
   * En la tarjeta, un par cuyo valor es un guion no se dibuja.
   *
   * En una tabla el "—" es necesario: la celda existe igual y vacía se leería
   * como un error de carga. En una tarjeta la celda no existe, así que
   * "Nombre —" y "Gastado —" son dos renglones que ocupan lugar para decir que
   * no hay nada. En `/contactos` eso es la mitad de la base (el pop-up de Nuby
   * pedía solo el mail), o sea la mitad de cada tarjeta en 343px.
   *
   * ⛔ Es lo ÚNICO que la tarjeta esconde y solo mira el valor renderizado: una
   * columna nunca desaparece por su rol, que es lo que este componente existe
   * para impedir.
   */
  const metasDe = (fila: T) =>
    metas.filter((c) => {
      const v = c.celda(fila);
      return !(typeof v === 'string' && (v.trim() === '' || v.trim() === '—'));
    });

  const subtitulosDe = (fila: T) =>
    subtitulos.map((c) => (
      <div key={c.key} className="text-xs text-subtle truncate max-w-xs">
        {c.celda(fila)}
      </div>
    ));

  return (
    <>
      {/* ── Escritorio ─────────────────────────────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm" aria-label={label}>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              {enTabla.map((c) => (
                <th
                  key={c.key}
                  className={`px-6 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={clave(fila)}
                className="border-b border-border last:border-0 transition-colors hover:bg-surface-muted/60"
              >
                {enTabla.map((c) => (
                  <td
                    key={c.key}
                    className={`px-6 py-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.clase ?? ''}`}
                  >
                    {c.celda(fila)}
                    {c === colTitulo && subtitulosDe(fila)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Celular ────────────────────────────────────────────────────────── */}
      <ul className="divide-y divide-border lg:hidden">
        {filas.map((fila) => (
          <li key={clave(fila)} className="px-4 py-3">
            <div className="font-medium text-foreground">{colTitulo.celda(fila)}</div>
            {subtitulosDe(fila)}
            {metasDe(fila).length > 0 && (
              // `<dl>` y no divs sueltos: son pares etiqueta/valor de verdad, y
              // así un lector de pantalla los lee apareados en vez de como una
              // sopa de palabras. Los `<div>` que agrupan cada par son HTML
              // válido adentro de un `<dl>`.
              <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                {metasDe(fila).map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5">
                    <dt className="text-subtle">{c.header}</dt>
                    <dd className="font-medium tabular-nums text-foreground">
                      {c.celda(fila)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
