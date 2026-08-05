"use client";

import { useEffect, useState } from "react";
import { ETIQUETA_FUENTE, type FuenteProductos, type PorFila, type PorFilaMovil } from "@/lib/email/bloques";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Rango } from "@/components/editor/Rango";
import { GrillaControl } from "@/components/editor/GrillaControl";

/**
 * Los controles del bloque de productos automáticos.
 *
 * Tiene componente propio —y no un `case` más adentro de `FormBloque`— porque
 * necesita traer las categorías de la tienda, y eso son hooks: no se pueden
 * poner adentro de una rama de un `switch`.
 *
 * Acá no se elige ningún producto. Se elige **una pregunta**, y la respuesta se
 * busca cada vez que el mail sale. Es la diferencia entera con el bloque de
 * productos elegidos a mano.
 */

interface Categoria {
  id: string;
  nombre: string;
}

export function ProductosDinamicosBlock({
  fuente,
  categoriaId,
  n,
  botonTexto,
  movil,
  porFila,
  onChange,
}: {
  fuente: FuenteProductos;
  categoriaId?: string;
  n?: number;
  botonTexto?: string;
  movil?: PorFilaMovil;
  porFila?: PorFila;
  onChange: (cambio: { fuente?: FuenteProductos; categoriaId?: string; n?: number; botonTexto?: string; movil?: PorFilaMovil; porFila?: PorFila }) => void;
}) {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [error, setError] = useState("");

  // Las categorías se piden solo cuando hacen falta: es una llamada a la API de
  // Tiendanube, cuyo límite se comparte con el monitor y con Resorty. Quien
  // elige "los más vendidos" no tiene por qué gastarla.
  useEffect(() => {
    if (fuente !== "categoria" || categorias !== null) return;
    let vivo = true;
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setCategorias(d.categorias ?? []);
        if (d.error) setError(d.error);
      })
      .catch((e) => vivo && setError(String(e)));
    return () => {
      vivo = false;
    };
  }, [fuente, categorias]);

  return (
    <div className="space-y-4">
      <Select
        label="Qué productos traer"
        fullWidth
        value={fuente}
        onChange={(e) => onChange({ fuente: e.target.value as FuenteProductos })}
      >
        {(Object.keys(ETIQUETA_FUENTE) as FuenteProductos[]).map((f) => (
          <option key={f} value={f}>
            {ETIQUETA_FUENTE[f]}
          </option>
        ))}
      </Select>

      {fuente === "categoria" && (
        <Select
          label="Categoría"
          fullWidth
          value={categoriaId ?? ""}
          disabled={categorias === null}
          onChange={(e) => onChange({ categoriaId: e.target.value })}
          error={error || undefined}
          hint={
            categorias === null
              ? "Buscando las categorías de tu tienda…"
              : categoriaId
                ? undefined
                : "Sin categoría elegida el bloque no se dibuja: mandar cualquier cosa donde pediste una categoría sería peor."
          }
        >
          <option value="">Elegí una categoría…</option>
          {(categorias ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      )}

      <Rango
        label="Cuántos mostrar"
        value={n ?? 4}
        onChange={(v) => onChange({ n: v })}
        min={2}
        max={6}
        sufijo=""
      />

      {/* Mismo campo que en productos elegidos. El motor lo dibuja desde
          siempre; el input faltaba en los dos bloques. */}
      <Input
        label="Texto del botón"
        fullWidth
        value={botonTexto ?? ""}
        placeholder="Sin botón"
        hint="Va debajo de cada producto y lleva a su página. Vacío, no se dibuja."
        onChange={(e) => onChange({ botonTexto: e.target.value })}
      />

      <GrillaControl movil={movil} porFila={porFila} onChange={onChange} />

      <p className="text-sm leading-relaxed text-muted">
        Los productos se buscan en tu tienda <strong>cada vez que el mail sale</strong>, no
        ahora. Lo que ves en la vista previa es lo que traería hoy.
        <br />
        <br />
        Si en ese momento no hay ninguno —porque no quedó nada en oferta, o porque se
        agotaron— el bloque simplemente no aparece, en vez de dejar un hueco.
        <br />
        <br />
        {/* La contracara de la foto propia de productos elegidos. Decirlo acá
            evita el camino de buscarla diez minutos: no está, y no puede estar. */}
        Las fotos son las de cada producto y no se pueden cambiar desde el mail: este
        bloque guarda <strong>la pregunta</strong>, no los productos, así que hoy no sabe
        cuáles va a traer. Para pisar una foto va el bloque de{" "}
        <strong>productos elegidos</strong>.
      </p>
    </div>
  );
}
