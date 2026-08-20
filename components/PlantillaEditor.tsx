"use client";

import { useState, useTransition } from "react";
import type { ContenidoCampania } from "@/lib/email/render";
import { EditorMail } from "@/components/editor/EditorMail";
import { useHistorial } from "@/components/editor/useHistorial";
import type { Marca } from "@/lib/marca";
import { guardarPlantilla, usarPlantilla, duplicarPlantilla } from "@/app/(app)/plantillas/actions";
import { Button } from "@/components/ui/Button";
import { BarraAcciones } from "@/components/ui/BarraAcciones";
import { usePermisos } from "@/components/PermisosProvider";
import { useGuardadoDoc } from "@/components/useGuardadoDoc";
import { AvisoConflicto } from "@/components/AvisoConflicto";
import { inputClass } from "@/lib/ui";

/**
 * El editor de una plantilla guardada.
 *
 * Es el mismo `EditorMail` de campañas y automations, sin nada de envío: una
 * plantilla no tiene destinatarios, ni asunto, ni prueba que mandar. Hasta que
 * existió esta pantalla, tocar un diseño guardado obligaba a crear una campaña
 * desde él, editarla y volver a guardarla como plantilla — dejando una campaña
 * fantasma en el camino.
 *
 * El estado es el **contenido entero**, igual que en los otros dos editores:
 * armarlo de vuelta con `{ bloques, tema }` al guardar es lo que perdía la
 * versión del esquema y los estilos de documento.
 */
export function PlantillaEditor({
  id,
  marca,
  initial,
  version,
}: {
  id: string;
  /** Nombre, logo, sitio, pie y tema de la marca (`marcaDe(cuenta)`). */
  marca: Marca;
  initial: { nombre: string; contenido: ContenidoCampania };
  /** El `docVersion` que tenía la fila al abrir. Ver `lib/documentos.ts`. */
  version: number;
}) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [contenido, setContenido, historial] = useHistorial<ContenidoCampania>(initial.contenido);
  const { soloLectura } = usePermisos();
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [usando, startUsar] = useTransition();
  const { conflicto, guardarDoc } = useGuardadoDoc(version);

  // El conflicto NO va por `msg`: ese mensaje se borra solo a los 2,5 s y esto
  // hay que ir a resolverlo. Va al cartel, que se queda.
  const escribio = () => guardarDoc((v) => guardarPlantilla({ id, nombre, contenido, version: v }));

  const guardar = () =>
    startSave(async () => {
      if (!(await escribio())) return;
      setMsg("Guardado ✓");
      setTimeout(() => setMsg(null), 2500);
    });

  return (
    // `data-editor` levanta el cap de 1152px del layout (ver el `has-[]` de
    // `app/(app)/layout.tsx`): en el editor el ancho ES la herramienta.
    <div data-editor className="space-y-4 pb-24">
      <AvisoConflicto texto={conflicto} />
      <label className="block max-w-md text-sm">
        <span className="text-muted">Nombre de la plantilla</span>
        <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>

      <EditorMail
        contenido={contenido}
        onChange={setContenido}
        historial={historial}
        marca={marca}
        preheader=""
        ayudaTema="Queda guardado en la plantilla. Sin tocar nada, usa el de la marca."
        soloLectura={soloLectura}
      />

      {soloLectura ? (
        <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-muted">
          Estás viendo esta plantilla en modo lectura.
        </div>
      ) : (
        <BarraAcciones onGuardar={guardar} guardando={saving} mensaje={msg} ancho="amplio">
          <Button
            variant="accent"
            disabled={usando}
            onClick={() =>
              // Guardar primero: si no, la campaña nace del diseño anterior y lo
              // que se ve en pantalla no es lo que se copió.
              startUsar(async () => {
                // 🔴 Si el guardado no escribió, la campaña nacería del diseño
                // ANTERIOR — justo lo que este "guardar primero" venía a evitar.
                if (!(await escribio())) return;
                await usarPlantilla(id);
              })
            }
          >
            {usando ? "Creando…" : "Crear una campaña con esto"}
          </Button>
          <Button variant="secondary" onClick={() => duplicarPlantilla(id)}>
            Duplicar
          </Button>
        </BarraAcciones>
      )}
    </div>
  );
}
