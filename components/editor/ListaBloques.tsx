"use client";

import { useState } from "react";
import { ETIQUETA_BLOQUE, TIPOS_BLOQUE, type Bloque, type TipoBloque } from "@/lib/email/render";
import { ETIQUETA_FUENTE } from "@/lib/email/bloques";
import {
  AlignLeft, ChevronDown, ChevronUp, Code2, Columns2, Copy, GripVertical, ImageIcon,
  LayoutTemplate, Menu as MenuIcon, Minus, MousePointerClick, MoveVertical, PanelTop, Play, Plus,
  Share2, ShoppingBag, ShoppingCart, Sparkles, Ticket, Trash2, Type,
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
 * ⚠️ El costo de eso es que **no anda con touch**: los eventos `drag*` de HTML5
 * no se disparan en ningún navegador de celular. El camino táctil son las
 * flechas ↑↓, que también son el camino de teclado. La API de acá afuera es
 * `onReorder(desde, hasta)` justamente para que cambiar el motor de arrastre sea
 * reemplazar este archivo y nada más.
 *
 * 🔴 **Por eso el `GripVertical` se esconde abajo de `lg`**: promete arrastrar y
 * arrastrar no anda con el dedo. Es una mentira de 24px, y encima 24px que a
 * 375px hacen falta para que el nombre del bloque no quede en "Carrit…".
 *
 * ⚠️ Las tres decisiones táctiles de este archivo (el grip, el "+" entre
 * bloques y las acciones de fila) cuelgan de **`lg`, el viewport**, y no del
 * `@container` con el que `EditorMail` acomoda sus columnas. Son preguntas
 * distintas: "¿entran tres columnas en este espacio?" la contesta el contenedor,
 * "¿esto se toca con el dedo?" la contesta la pantalla. A 1280 el editor apila
 * —el espacio real no da— pero hay un mouse, y ahí el hover sigue siendo el
 * comportamiento correcto.
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
  "productos-dinamicos": Sparkles,
  carrito: ShoppingCart,
  columnas: Columns2,
  video: Play,
  redes: Share2,
  menu: MenuIcon,
  divisor: Minus,
  espaciador: MoveVertical,
  html: Code2,
};

/**
 * Las acciones de fila, tocables: 44px de alto y 36 de ancho abajo de `lg`.
 *
 * ⚠️ 36 de ancho y no los 44 de `tapTarget`, a propósito: son CUATRO botones
 * pegados, y a 44 se comen 176 de los ~303px que mide la fila a 375px — el
 * nombre del bloque quedaría en "Product…" y esta lista existe justamente para
 * reconocerlo sin abrirlo. El ALTO, que es la dimensión que se falla al tocar
 * una fila de una lista vertical, sí es el de la guía.
 */
const accionFila = "max-lg:flex max-lg:h-11 max-lg:w-9 max-lg:items-center max-lg:justify-center";

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
    // La consulta, no un conteo: el conteo todavía no existe cuando se arma el
    // mail, y "4 productos" mentiría igual el día que la tienda tenga tres.
    case "productos-dinamicos":
      return `${ETIQUETA_FUENTE[b.fuente]} · ${b.n ?? 4}`;
    case "carrito":
      return "Se completa al enviar";
    case "columnas": {
      const ETIQUETA_VARIANTE = {
        imagenes: "Dos imágenes",
        textos: "Dos textos",
        "imagen-texto": "Imagen + texto",
        "texto-imagen": "Texto + imagen",
      } as const;
      return ETIQUETA_VARIANTE[b.variante ?? "imagenes"];
    }
    case "video":
      return b.url || "Sin link";
    case "redes":
      return b.links.map((l) => l.red).filter(Boolean).join(", ") || "Sin redes";
    case "menu":
      return b.links.map((l) => l.texto).filter(Boolean).join(", ") || "Sin links";
    case "divisor":
      return "—";
    case "espaciador":
      return `${b.alto ?? 24}px`;
    case "html":
      return b.contenido.trim() ? "HTML propio" : "Vacío";
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
  avanzado = false,
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
  /** `puede(rol,"avanzado")`: sin esto, `html` no aparece en la paleta. */
  avanzado?: boolean;
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
        {/* Abajo de `lg` el hueco crece a 32px y el botón a 44: con el dedo no
            hay dónde "pasar por encima", así que un separador de 8px con el
            botón en `opacity-0` es un lugar de inserción que no existe. */}
        <div className="group flex h-2 items-center justify-center max-lg:h-8">
          {arrastrando === null && !soloLectura && (
            <button
              type="button"
              onClick={() => setPaletaEn((p) => (p === i ? null : i))}
              aria-label="Insertar un bloque acá"
              aria-expanded={paletaEn === i}
              className={`flex h-4 w-full items-center justify-center transition-opacity max-lg:h-11 ${
                paletaEn === i
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-60 focus-visible:opacity-100 max-lg:opacity-60"
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
            avanzado={avanzado}
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
                <span className={`shrink-0 max-lg:hidden ${movible ? "cursor-grab text-subtle" : "text-transparent"}`}>
                  <GripVertical className="h-4 w-4" aria-hidden />
                </span>
                <Icono className={`h-4 w-4 shrink-0 ${sel ? "text-accent-subtle-foreground" : "text-muted"}`} aria-hidden />
                {/* Sin `onClick` propio: el de la fila ya lo cubre y el click
                    de este botón burbujea hasta ahí —también el que dispara un
                    Enter con el foco puesto, que es para lo que el botón
                    existe—. Tenerlo en los dos lados hacía correr `elegir()`
                    dos veces por click. */}
                <button type="button" className="min-w-0 flex-1 text-left">
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
                  //
                  // 🔴 Abajo de `lg` están SIEMPRE, en todas las filas. Un
                  // `opacity-0` no saca a un botón del alcance del dedo: seguía
                  // recibiendo el toque, invisible. Y no alcanza con dejarlas
                  // en la fila elegida, porque en celular tocar una fila salta
                  // al panel de propiedades — nunca se vería la fila elegida
                  // con sus acciones al lado.
                  <span
                    className={`flex shrink-0 items-center text-muted transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100 ${
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
                          className={`px-0.5 transition-colors hover:text-foreground disabled:opacity-25 ${accionFila}`}
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onReorder(i, i + 1); }}
                          disabled={i >= bloques.length - 1}
                          aria-label="Bajar"
                          className={`px-0.5 transition-colors hover:text-foreground disabled:opacity-25 ${accionFila}`}
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDuplicar(i); }}
                      aria-label="Duplicar"
                      className={`px-0.5 transition-colors hover:text-foreground ${accionFila}`}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onBorrar(i); }}
                      aria-label="Eliminar"
                      className={`px-0.5 text-danger-foreground transition-opacity hover:opacity-70 ${accionFila}`}
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
  avanzado,
  enCero,
  onElegir,
}: {
  hayEncabezado: boolean;
  /** `puede(rol,"avanzado")`: sin esto, `html` no se ofrece — es la escotilla de ADMIN. */
  avanzado: boolean;
  /** El encabezado solo se puede insertar arriba de todo, que es donde existe. */
  enCero: boolean;
  onElegir: (t: TipoBloque) => void;
}) {
  const disponibles = TIPOS_BLOQUE.filter(
    (t) => (t !== "encabezado" || (!hayEncabezado && enCero)) && (t !== "html" || avanzado),
  );
  return (
    <div className="my-1 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-muted p-1.5">
      {disponibles.map((t) => {
        const Icono = ICONO[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onElegir(t)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface hover:text-foreground max-lg:min-h-11"
          >
            <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{ETIQUETA_BLOQUE[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
