"use client";

import { useEffect, useState } from "react";
import type { PorFila, PorFilaMovil, ProductoEmail } from "@/lib/email/render";
// Sólo el TIPO: `import type` se borra al compilar, así que el cliente de la API
// de Tiendanube no entra al bundle del editor.
import type { ProductoTN } from "@/lib/tn/products";
import { RotateCcw, X } from "lucide-react";
import { campoBase } from "@/lib/ui";
import { GrillaControl } from "@/components/editor/GrillaControl";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Input } from "@/components/ui/Input";


export function ProductosBlock({
  items,
  botonTexto,
  precioOculto,
  movil,
  porFila,
  onChange,
  onBoton,
  onPrecioOculto,
  onGrilla,
}: {
  items: ProductoEmail[];
  botonTexto?: string;
  precioOculto?: boolean;
  movil?: PorFilaMovil;
  porFila?: PorFila;
  onChange: (items: ProductoEmail[]) => void;
  onBoton: (botonTexto: string) => void;
  onPrecioOculto: (precioOculto: boolean) => void;
  onGrilla: (cambio: { movil?: PorFilaMovil; porFila?: PorFila }) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ProductoTN[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [editandoFoto, setEditandoFoto] = useState<number | null>(null);
  /** Las URLs cuya ficha da 404: sin publicar, borrada o renombrada. */
  const [rotas, setRotas] = useState<Set<string>>(new Set());

  // 🔑 El `oculto` que devuelve el buscador NO se guarda en el bloque: es un
  // dato de la tienda de hoy y quedaría mintiendo el día que el producto se
  // publica. Así que para los que ya están elegidos se vuelve a preguntar, con
  // el MISMO chequeo que frena el envío — si la ficha da 404, el mail llevaría
  // a una página que no existe.
  const urls = items
    .map((p) => p.url)
    .filter(Boolean)
    .join(",");
  useEffect(() => {
    if (!urls) return;
    let vivo = true;
    fetch(`/api/productos?revisar=${encodeURIComponent(urls)}`)
      .then((r) => r.json())
      .then((d) => vivo && setRotas(new Set<string>(d.rotos ?? [])))
      .catch(() => {
        // Sin respuesta no se afirma nada: el aviso desaparece, el freno del
        // envío sigue estando. Es el único lugar donde se puede fallar abierto.
      });
    return () => {
      vivo = false;
    };
  }, [urls]);
  // Sin productos no hay nada que avisar. Se DERIVA en vez de limpiar el estado
  // desde el efecto: un `setState` síncrono ahí adentro dispara un render en
  // cascada (lo frena el lint) y acá no hace falta ninguno — la lista vieja no
  // molesta, porque sólo se pregunta por las URLs que siguen estando.
  const sinPublicar = (u: string) => !!urls && rotas.has(u);

  const buscar = async () => {
    setBuscando(true);
    try {
      const res = await fetch(`/api/productos?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultados(data.productos ?? []);
    } finally {
      setBuscando(false);
    }
  };

  const agregar = ({ oculto, id, ...p }: ProductoTN) => {
    if (items.some((x) => x.url === p.url)) return;
    // 🔑 `oculto` e `id` se descartan al guardar. El primero es un dato de la
    // tienda de HOY —quedaría mintiendo apenas se publique el producto— y el
    // segundo no lo usa nadie: lo que el mail necesita es la URL, que es lo que
    // se vuelve a preguntar tanto en el editor como antes de enviar.
    void oculto;
    void id;
    onChange([...items, p]);
  };
  const quitar = (i: number) => onChange(items.filter((_, j) => j !== i));

  /**
   * Pisar la foto que trajo la tienda con una propia.
   *
   * ⚠️ `imagenTienda` se escribe **una sola vez**, la primera. Reescribirla en
   * cada cambio haría que la segunda foto propia pase a ser "la de la tienda" y
   * el botón de volver dejaría de volver a ningún lado.
   */
  const ponerFoto = (i: number, url: string) =>
    onChange(
      items.map((p, j) =>
        j !== i ? p : { ...p, imagen: url, imagenTienda: p.imagenTienda ?? p.imagen },
      ),
    );
  const volverALaDeLaTienda = (i: number) =>
    onChange(
      items.map((p, j) => {
        if (j !== i || !p.imagenTienda) return p;
        const { imagenTienda, ...resto } = p;
        return { ...resto, imagen: imagenTienda };
      }),
    );

  return (
    <div className="space-y-3">
      {/* Seleccionados.
          Era una fila de chips: miniatura, nombre y la cruz de sacar. Pasó a
          lista de renglones el 5-ago-2026 para que cada producto tuviera dónde
          colgar su propia foto — en un chip de 32px no entra un campo. */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((p, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-muted p-1.5">
              <div className="flex items-center gap-2">
                {p.imagen && <img src={p.imagen} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />}
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {p.nombre}
                  {sinPublicar(p.url) && (
                    <span className="ml-1.5 rounded border border-warning-border bg-warning px-1 py-0.5 text-[10px] font-semibold text-warning-foreground">
                      sin publicar
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setEditandoFoto(editandoFoto === i ? null : i)}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
                >
                  {p.imagenTienda ? "Foto propia" : "Cambiar la foto"}
                </button>
                <button
                  type="button"
                  aria-label={`Sacar ${p.nombre}`}
                  onClick={() => quitar(i)}
                  className="shrink-0 text-danger-foreground hover:opacity-70"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {editandoFoto === i && (
                <div className="space-y-1.5 border-t border-border p-1.5 pt-2">
                  <ImagenDrop value={p.imagen} onChange={(url) => ponerFoto(i, url)} />
                  {p.imagenTienda ? (
                    <button
                      type="button"
                      onClick={() => volverALaDeLaTienda(i)}
                      className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Volver a la foto de la tienda
                    </button>
                  ) : (
                    <p className="text-xs text-subtle">
                      Una foto propia pisa la de la tienda sólo en este mail. El producto no se toca.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Buscador */}
      <div className="flex gap-2">
        <input
          className={`${campoBase} flex-1`}
          value={q}
          placeholder="Buscar productos en tu tienda…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
        />
        <button onClick={buscar} disabled={buscando} className="rounded-lg border border-border-strong px-3 py-2 text-sm text-muted hover:bg-surface-muted disabled:opacity-50">
          {buscando ? "…" : "Buscar"}
        </button>
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto rounded-lg border border-border p-2">
            {resultados.map((p) => (
              <button key={p.url} onClick={() => agregar(p)} className="rounded-lg border border-border p-1.5 text-left hover:border-accent">
                {p.imagen && <img src={p.imagen} alt="" className="mb-1 aspect-square w-full rounded object-cover" />}
                <div className="truncate text-xs text-foreground">{p.nombre}</div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted">
                    ${Number(p.precioPromo || p.precio).toLocaleString("es-AR")}
                  </span>
                  {/* El buscador SÍ sabe si está publicado: se lo pregunta a
                      Tiendanube en el momento. Lo que no se guarda es la
                      respuesta — ver el efecto de arriba. */}
                  {p.oculto && (
                    <span className="rounded border border-warning-border bg-warning px-1 text-[10px] font-semibold text-warning-foreground">
                      oculto
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-subtle">
            Sólo aparecen los productos que tienen al menos una foto cargada.
          </p>
        </>
      )}

      {/* La explicación va acá abajo y no como alerta arriba: elegir un producto
          oculto es LEGÍTIMO —es cómo se arma una preventa— y lo que hace falta
          es decir qué pasa después, no impedirlo. */}
      {items.some((p) => sinPublicar(p.url)) && (
        <p className="rounded-lg border border-warning-border bg-warning p-2 text-xs leading-relaxed text-warning-foreground">
          Hay productos sin publicar en tu tienda. Su página da 404, así que{" "}
          <strong>el mail no va a salir hasta que los publiques</strong>: queda en cola y se
          manda solo apenas estén online. Sirve para armar una preventa hoy y lanzarla después
          — pero si te olvidás de publicar, el envío no arranca.
        </p>
      )}

      {/* El botón de cada tarjeta. El motor lo dibuja desde que existe la grilla
          —`renderCard` lo lee de `botonTexto`— pero hasta el 5-ago-2026 no había
          input en ningún lado: sólo las plantillas prearmadas podían ponerlo, y
          desde el editor el botón era inalcanzable. Vacío = no se dibuja, la
          convención de todo el motor. */}
      <Input
        label="Texto del botón"
        value={botonTexto ?? ""}
        placeholder="Sin botón"
        hint="Va debajo de cada producto y lleva a su página. Vacío, no se dibuja."
        onChange={(e) => onBoton(e.target.value)}
      />


      {/* Esconder el precio. La clave del bloque es `precioOculto` (ausente = se
          ve) para que ninguna grilla ya guardada cambie sola; ver bloques.ts. */}
      <label className="flex items-start gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={precioOculto ?? false}
          onChange={(e) => onPrecioOculto(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          Sin precio
          <span className="block text-xs text-subtle">
            La tarjeta muestra sólo la foto y el nombre. Sirve cuando lo que querés es que
            entren a ver el producto.
          </span>
        </span>
      </label>

      {/* Cómo se acomoda la grilla en el teléfono. Va último: primero se eligen
          los productos, después se decide cómo se ven. */}
      <GrillaControl movil={movil} porFila={porFila} onChange={onGrilla} />
    </div>
  );
}
