"use client";

import { useState } from "react";
import {
  duplicarBloque, nuevoBloque, ETIQUETA_BLOQUE,
  type Bloque, type ContenidoCampania, type TipoBloque,
} from "@/lib/email/render";
import { resolverPaleta, type Tema } from "@/lib/email/tema";
import { ListaBloques } from "@/components/editor/ListaBloques";
import { FormBloque } from "@/components/editor/FormBloque";
import { PreviewMail } from "@/components/editor/PreviewMail";
import { TemaSelector } from "@/components/TemaSelector";
import { AISoonButton } from "@/components/ui/AISoonButton";
import type { Marca } from "@/lib/marca";
import type { Historial, OpcionesSet } from "@/components/editor/useHistorial";
import { Palette, Redo2, Undo2 } from "lucide-react";

/**
 * El editor de mails, entero. Lo comparten campañas, automations y plantillas.
 *
 *   ┌───────────┬──────────────┬───────────────┐
 *   │ bloques   │ propiedades  │ vista previa  │
 *   └───────────┴──────────────┴───────────────┘
 *
 * Tres decisiones que vale la pena tener presentes antes de tocarlo:
 *
 * - **Se edita el contenido ENTERO**, no `{ bloques, tema }`. Enumerar los
 *   campos a mano hacía que cada campo nuevo del esquema se perdiera en el
 *   guardado y el mail saliera distinto de lo que muestra el editor. Acá el
 *   estado ES el documento.
 * - **La selección va por `id`, nunca por índice.** Con índices, borrar el
 *   bloque 2 hace que el 3 pase a ser el 2 y el panel empieza a editar otro
 *   bloque en silencio. Los ids se los pone `leerContenido` a todo lo que entra.
 * - **Sin nada seleccionado, el panel muestra el diseño del mail.** Es la capa
 *   de documento: el aspecto se elige una vez para todo el mail y recién después
 *   se retoca un bloque suelto.
 */
export function EditorMail({
  contenido,
  onChange,
  historial,
  marca,
  preheader,
  ayudaTema,
  soloLectura = false,
}: {
  contenido: ContenidoCampania;
  /** El documento entero, siempre. `marcar` fuerza un paso nuevo de deshacer. */
  onChange: (c: ContenidoCampania, o?: OpcionesSet) => void;
  historial?: Historial;
  /** Nombre, logo, sitio, pie y tema de la marca (`marcaDe(cuenta)`). */
  marca: Marca;
  preheader?: string;
  ayudaTema?: string;
  soloLectura?: boolean;
}) {
  const bloques = contenido.bloques ?? [];
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const seleccionado = bloques.find((b) => b.id === seleccionadoId) ?? null;
  const setBloques = (bs: Bloque[], o?: OpcionesSet) => onChange({ ...contenido, bloques: bs }, o);

  const editar = (patch: Partial<Bloque>) =>
    setBloques(bloques.map((b) => (b.id === seleccionadoId ? ({ ...b, ...patch } as Bloque) : b)));

  const insertar = (tipo: TipoBloque, i: number) => {
    const nuevo = nuevoBloque(tipo);
    const copia = [...bloques];
    // El encabezado existe en un solo lugar: arriba de todo, fuera de la
    // tarjeta. La lista ya no lo ofrece en otra posición, pero el clamp queda
    // por si el bloque entra desde otro lado.
    copia.splice(tipo === "encabezado" ? 0 : i, 0, nuevo);
    setBloques(copia, { marcar: true });
    if (nuevo.id) setSeleccionadoId(nuevo.id);
  };

  const duplicar = (i: number) => {
    const copia = [...bloques];
    const clon = duplicarBloque(bloques[i]);
    copia.splice(i + 1, 0, clon);
    setBloques(copia, { marcar: true });
    if (clon.id) setSeleccionadoId(clon.id);
  };

  const borrar = (i: number) => {
    const fuera = bloques[i];
    setBloques(bloques.filter((_, j) => j !== i), { marcar: true });
    // Si el panel estaba mostrando el que se fue, se vuelve al diseño del mail:
    // dejarlo apuntando a un id que ya no existe deja el panel vacío y sin
    // explicación.
    if (fuera?.id === seleccionadoId) setSeleccionadoId(null);
  };

  const mover = (desde: number, hasta: number) => {
    if (hasta < 0 || hasta >= bloques.length) return;
    // Nadie pasa por encima del encabezado ni el encabezado se mueve.
    const fijoArriba = bloques[0]?.tipo === "encabezado";
    if (fijoArriba && (desde === 0 || hasta === 0)) return;
    const copia = [...bloques];
    const [x] = copia.splice(desde, 1);
    copia.splice(hasta, 0, x);
    setBloques(copia, { marcar: true });
  };

  const setTema = (t: Tema | undefined) => {
    const c = { ...contenido };
    // Ausente, no `{}`: "sin tema propio" es la ausencia de la clave. Un objeto
    // vacío guardado haría que el mail deje de heredar el tema de la marca.
    if (t) c.tema = t;
    else delete c.tema;
    onChange(c);
  };

  const anchoMail = resolverPaleta({ ...(marca.temaMarca ?? {}), ...(contenido.tema ?? {}) }).ancho;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {historial && !soloLectura && (
            <>
              <button
                type="button"
                onClick={historial.deshacer}
                disabled={!historial.puedeDeshacer}
                title="Deshacer (⌘Z)"
                aria-label="Deshacer"
                className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Undo2 className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={historial.rehacer}
                disabled={!historial.puedeRehacer}
                title="Rehacer (⇧⌘Z)"
                aria-label="Rehacer"
                className="rounded-lg border border-border p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-30"
              >
                <Redo2 className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </div>
        <AISoonButton label="Redactar con IA" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(340px,460px)]">
        {/* Columna 1 · el mapa del mail */}
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setSeleccionadoId(null)}
            className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-sm transition-colors ${
              seleccionadoId === null
                ? "border-accent bg-accent-subtle font-medium text-accent-subtle-foreground"
                : "border-transparent text-muted hover:bg-surface-muted"
            }`}
          >
            <Palette className="h-4 w-4 shrink-0" aria-hidden />
            Diseño del mail
          </button>
          <div className="border-t border-border pt-2">
            <ListaBloques
              bloques={bloques}
              seleccionadoId={seleccionadoId}
              onSeleccionar={setSeleccionadoId}
              onReorder={mover}
              onDuplicar={duplicar}
              onBorrar={borrar}
              onInsertar={insertar}
              soloLectura={soloLectura}
            />
          </div>
        </div>

        {/* Columna 2 · el panel de propiedades. Sin nada elegido muestra el
            diseño del mail, que ya trae su propia tarjeta. */}
        {seleccionado ? (
          <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">{ETIQUETA_BLOQUE[seleccionado.tipo]}</h3>
            <fieldset disabled={soloLectura} className="space-y-3 disabled:opacity-60">
              <FormBloque bloque={seleccionado} onChange={editar} marca={marca} />
            </fieldset>
          </div>
        ) : (
          <TemaSelector
            tema={contenido.tema}
            onChange={setTema}
            temaMarca={marca.temaMarca}
            ayuda={ayudaTema}
          />
        )}

        {/* Columna 3 · el mail */}
        <PreviewMail
          contenido={contenido}
          marca={marca}
          preheader={preheader}
          anchoMail={anchoMail}
          className="xl:sticky xl:top-6 h-fit"
        />
      </div>
    </div>
  );
}
