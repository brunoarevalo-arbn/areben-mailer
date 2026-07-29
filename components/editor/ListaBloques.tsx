"use client";

import { useState } from "react";
import { ETIQUETA_BLOQUE, TIPOS_BLOQUE, type Bloque, type TipoBloque } from "@/lib/email/render";
import {
  AlignLeft, ChevronDown, ChevronUp, Columns2, Copy, GripVertical, ImageIcon,
  LayoutTemplate, Minus, MousePointerClick, MoveVertical, PanelTop, Play, Plus,
  Share2, ShoppingBag, ShoppingCart, Ticket, Trash2, Type,
} from "lucide-react";

/**
 * La columna izquierda del editor: qué bloques tiene el mail y en qué orden.
 *
 * Cada fila es UN renglón. Antes cada bloque abría su formulario entero acá
 * adentro, y con diez bloques la lista medía tres pantallas: mover el segundo al
 * final era scrollear a ciegas. Ahora el formulario vive en el panel de al lado
 * y esta lista es el mapa del mail.
 *
 * **Arrastrar es HTML5 nativo, sin dependencias.** Es una lista vertical de un
 * solo contenedor, que es el caso que `draggable` resuelve bien; `@dnd-kit` son
 * tres paquetes y ~40 KB en un bundle que ya lleva el renderer entero.
 *
 * ⚠️ El costo de eso es que **no anda con touch**: el editor es de escritorio y
 * las flechas ↑↓ cubren el táctil y el teclado. La API de acá afuera es
 * `onReorder(desde, hasta)` justamente para que cambiar el motor de arrastre sea
 * reemplazar este archivo y nada más.
 */

const ICONO: Record<TipoBloque, typeof Type> = {
  encabezado: PanelTop,
  hero: LayoutTemplate,
  seccion: AlignLeft,
  cupon: Ticket,
  titulo: Type,
  texto: AlignLeft,
  boton: MousePointerClick,
  imagen: ImageIcon,
  productos: ShoppingBag,
  carrito: ShoppingCart,
  columnas: Columns2,
  video: Play,
  redes: Share2,
  divisor: Minus,
  espaciador: MoveVertical,
};

/** Una línea de contexto para reconocer el bloque sin abrirlo. */
function resumen(b: Bloque): string {
  switch (b.tipo) {
    case "encabezado":
      return b.variante === "logo" ? "Logo" : b.texto?.trim() || "El nombre de la marca";
    case "titulo":
    case "texto":
      return b.texto.trim() || "—";
    case "boton":
      return b.texto.trim() || "—";
    case "hero":
    case "seccion":
      return b.titulo.trim() || "—";
    case "cupon":
      return b.codigo.trim() || "—";
    case "imagen":
      return b.url ? b.url.split("/").pop() ?? "" : "Sin imagen";
    case "productos":
      return b.items.length ? `${b.items.length} producto${b.items.length === 1 ? "" : "s"}` : "Sin productos";
    case "carrito":
      return "Se completa al enviar";
    case "columnas":
      return "Dos imágenes lado a lado";
    case "video":
      return b.url || "Sin link";
    case "redes":
      return b.links.map((l) => l.red).filter(Boolean).join(", ") || "Sin redes";
    case "divisor":
      return "—";
    case "espaciador":
      return `${b.alto ?? 24}px`;
  }
}

export function ListaBloques({
  bloques,
  seleccionadoId,
  onSeleccionar,
  onReorder,
  onDuplicar,
  onBorrar,
  onInsertar,
  soloLectura = false,
}: {
  bloques: Bloque[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  /** Mover el bloque de `desde` para que quede en la posición `hasta`. */
  onReorder: (desde: number, hasta: number) => void;
  onDuplicar: (i: number) => void;
  onBorrar: (i: number) => void;
  onInsertar: (tipo: TipoBloque, i: number) => void;
  soloLectura?: boolean;
}) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  /** Dónde va a caer lo que se está arrastrando: en qué fila y de qué lado. */
  const [destino, setDestino] = useState<{ i: number; antes: boolean } | null>(null);
  const [paletaEn, setPaletaEn] = useState<number | null>(null);

  // El encabezado se dibuja fuera de la tarjeta del mail: hay uno solo y va
  // primero. Por eso no se arrastra y nada se mete arriba de él — el renderer lo
  // subiría igual y la lista mostraría un orden que el mail no respeta.
  const hayEncabezado = bloques[0]?.tipo === "encabezado";
  const primerLibre = hayEncabezado ? 1 : 0;

  const cancelar = () => {
    setArrastrando(null);
    setDestino(null);
  };

  /** `hueco` es la posición ENTRE bloques: 0 = arriba de todo, length = al final. */
  const soltarEn = (hueco: number) => {
    const desde = arrastrando;
    cancelar();
    if (desde === null) return;
    const hasta = hueco > desde ? hueco - 1 : hueco;
    if (hasta !== desde) onReorder(desde, hasta);
  };

  /**
   * De qué lado de la fila `i` está el cursor.
   *
   * El clamp del encabezado se hace acá y no al soltar: si la línea se dibujara
   * arriba del encabezado, estaría prometiendo un lugar que `onReorder` después
   * ignora en silencio, y eso se lee como que el arrastre "no funcionó".
   */
  const ladoDe = (i: number, y: number, caja: DOMRect): { i: number; antes: boolean } => {
    const antes = y - caja.top < caja.height / 2;
    // Lo único prohibido es la posición 0 cuando hay encabezado. Debajo de él
    // (la mitad de arriba de la primera fila movible) sí es un lugar válido:
    // clamparlo también dejaba el primer lugar del mail inalcanzable.
    if (antes && i === 0 && hayEncabezado) return { i: 0, antes: false };
    return { i, antes };
  };

  // ⚠️ `hueco` va como función que devuelve JSX y NO como componente definido
  // acá adentro: un componente declarado dentro del render es un tipo nuevo en
  // cada pasada, así que React desmonta y vuelve a montar el nodo. Con arrastre
  // encima eso cancela el `dragover` a mitad de camino y el drop nunca llega.
  //
  // Ya NO es zona de soltar. Antes crecía a 28px con borde punteado mientras se
  // arrastraba, y eso estiraba la lista entera bajo el cursor: el bloque al que
  // le apuntabas se corría para abajo justo cuando ibas a buscarlo. Ahora el
  // blanco es la fila y lo que marca el lugar es una línea dibujada ENCIMA, que
  // no empuja nada.
  const hueco = (i: number) => {
    return (
      <li key={`h${i}`}>
        <div className="group flex h-2 items-center justify-center">
          {arrastrando === null && !soloLectura && (
            <button
              type="button"
              onClick={() => setPaletaEn((p) => (p === i ? null : i))}
              aria-label="Insertar un bloque acá"
              aria-expanded={paletaEn === i}
              className={`flex h-4 w-full items-center justify-center transition-opacity ${
                paletaEn === i ? "opacity-100" : "opacity-0 group-hover:opacity-60 focus-visible:opacity-100"
              }`}
            >
              <span className="h-px flex-1 bg-accent" />
              <span className="mx-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                <Plus className="h-3 w-3" aria-hidden />
              </span>
              <span className="h-px flex-1 bg-accent" />
            </button>
          )}
        </div>
        {paletaEn === i && (
          <Paleta
            hayEncabezado={hayEncabezado}
            enCero={i === 0}
            onElegir={(tipo) => {
              setPaletaEn(null);
              onInsertar(tipo, i);
            }}
          />
        )}
      </li>
    );
  };

  return (
    <div className="space-y-2">
      <ul
        className="space-y-0"
        // Soltar en el aire de abajo manda al final, en vez de perder el
        // arrastre. Los `dragover` de las filas pisan a este por burbujeo.
        onDragOver={(e) => {
          if (arrastrando === null) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          soltarEn(destino ? (destino.antes ? destino.i : destino.i + 1) : bloques.length);
        }}
      >
        {bloques.flatMap((b, i) => {
          const Icono = ICONO[b.tipo];
          const movible = !soloLectura && i >= primerLibre;
          const sel = b.id === seleccionadoId;
          const marca = arrastrando !== null && destino?.i === i ? destino.antes : null;
          return [
            ...(i >= primerLibre ? [hueco(i)] : []),
            <li key={b.id ?? i}>
              <div
                draggable={movible}
                onDragStart={(e) => {
                  setArrastrando(i);
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox no arranca el arrastre sin datos adentro.
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragEnd={cancelar}
                onDragOver={(e) => {
                  if (arrastrando === null) return;
                  e.preventDefault();
                  setDestino(ladoDe(i, e.clientY, e.currentTarget.getBoundingClientRect()));
                }}
                // Sin `onDragLeave`: el `dragover` de la fila siguiente ya pisa
                // el destino, y limpiarlo al cruzar el borde hacía parpadear la
                // línea entre cada dos filas.
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const d = ladoDe(i, e.clientY, e.currentTarget.getBoundingClientRect());
                  soltarEn(d.antes ? d.i : d.i + 1);
                }}
                onClick={() => b.id && onSeleccionar(b.id)}
                className={`group relative flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                  sel ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-surface-muted"
                } ${arrastrando === i ? "opacity-40" : ""}`}
              >
                {marca !== null && (
                  // `pointer-events-none` no es opcional: sin eso la línea recibe
                  // el `dragover` en vez de la fila y el destino oscila.
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-accent ${
                      marca ? "-top-px" : "-bottom-px"
                    }`}
                  />
                )}
                <span className={`shrink-0 ${movible ? "cursor-grab text-subtle" : "text-transparent"}`}>
                  <GripVertical className="h-4 w-4" aria-hidden />
                </span>
                <Icono className={`h-4 w-4 shrink-0 ${sel ? "text-accent-subtle-foreground" : "text-muted"}`} aria-hidden />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => b.id && onSeleccionar(b.id)}
                >
                  <span className={`block truncate text-sm ${sel ? "font-medium text-accent-subtle-foreground" : "text-foreground"}`}>
                    {ETIQUETA_BLOQUE[b.tipo]}
                  </span>
                  <span className="block truncate text-xs text-subtle">{resumen(b)}</span>
                </button>
                {!soloLectura && (
                  // Los cuatro botones se comían ~90px de cada fila y el nombre
                  // del bloque quedaba en "Carrit…". Aparecen al pasar el mouse
                  // —y con `focus-within`, o serían inalcanzables por teclado,
                  // que es justo lo que las flechas ↑↓ vienen a resolver—. En la
                  // fila elegida quedan siempre, que es donde uno está.
                  <span
                    className={`flex shrink-0 items-center text-muted transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
                      sel ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {movible && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorder(i, i - 1); }}
                          disabled={i <= primerLibre}
                          aria-label="Subir"
                          className="px-0.5 transition-colors hover:text-foreground disabled:opacity-25"
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorder(i, i + 1); }}
                          disabled={i >= bloques.length - 1}
                          aria-label="Bajar"
                          className="px-0.5 transition-colors hover:text-foreground disabled:opacity-25"
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDuplicar(i); }}
                      aria-label="Duplicar"
                      className="px-0.5 transition-colors hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onBorrar(i); }}
                      aria-label="Eliminar"
                      className="px-0.5 text-danger-foreground transition-opacity hover:opacity-70"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                )}
              </div>
            </li>,
          ];
        })}
        {hueco(bloques.length)}
      </ul>

      {!soloLectura && paletaEn === null && (
        <button
          type="button"
          onClick={() => setPaletaEn(bloques.length)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Agregar bloque
        </button>
      )}
    </div>
  );
}

function Paleta({
  hayEncabezado,
  enCero,
  onElegir,
}: {
  hayEncabezado: boolean;
  /** El encabezado solo se puede insertar arriba de todo, que es donde existe. */
  enCero: boolean;
  onElegir: (t: TipoBloque) => void;
}) {
  const disponibles = TIPOS_BLOQUE.filter((t) => t !== "encabezado" || (!hayEncabezado && enCero));
  return (
    <div className="my-1 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-muted p-1.5">
      {disponibles.map((t) => {
        const Icono = ICONO[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onElegir(t)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{ETIQUETA_BLOQUE[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
