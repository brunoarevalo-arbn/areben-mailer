"use client";

import { useState } from "react";
import {
  duplicarBloque, nuevoBloque, ETIQUETA_BLOQUE,
  type Bloque, type ContenidoCampania, type TipoBloque,
} from "@/lib/email/render";
import { resolverPaleta, type Tema } from "@/lib/email/tema";
import { resolverEstilo, ROLES_POR_TIPO, type Estilos, type RolEstilo } from "@/lib/email/estilos";
import { ListaBloques } from "@/components/editor/ListaBloques";
import { FormBloque } from "@/components/editor/FormBloque";
import { PanelEstilo } from "@/components/editor/PanelEstilo";
import { PreviewMail } from "@/components/editor/PreviewMail";
import { TemaSelector } from "@/components/TemaSelector";
import { AISoonButton } from "@/components/ui/AISoonButton";
import { usePermisos } from "@/components/PermisosProvider";
import type { Marca } from "@/lib/marca";
import type { Historial, OpcionesSet } from "@/components/editor/useHistorial";
import { tapTarget } from "@/lib/ui";
import { Palette, Redo2, Undo2 } from "lucide-react";

/**
 * Contra qué bloque se resuelve cada rol en la capa de DOCUMENTO.
 *
 * La capa del documento no pertenece a ningún bloque, pero el "automático" que
 * muestra el panel sale de la cascada, que sí depende del tipo (el título de un
 * `hero` mide 30px y el de una `seccion` 22). Se elige un representante por rol:
 * el bloque más común que lo usa. Solo afecta el número gris que se muestra al
 * lado del control, nunca lo que se guarda.
 */
const REPRESENTA: Record<RolEstilo, TipoBloque> = {
  caja: "texto",
  titulo: "titulo",
  subtitulo: "seccion",
  cuerpo: "texto",
  boton: "boton",
  imagen: "imagen",
  nota: "productos",
};

/**
 * Qué roles ofrece la pestaña Estilo para ESTE bloque puntual.
 *
 * `ROLES_POR_TIPO` es por TIPO, así que no sabe que un `columnas` en variante
 * "imagenes" no dibuja ningún texto: ofrecer `titulo`/`cuerpo` ahí sería la
 * misma perilla desconectada que `probar-panel-estilo.ts` está pensado para
 * cazar, nada más que a nivel de instancia y no de tipo.
 */
function rolesDe(b: Bloque): readonly RolEstilo[] {
  if (b.tipo !== "columnas") return ROLES_POR_TIPO[b.tipo];
  const variante = b.variante ?? "imagenes";
  const conImagen = variante === "imagenes" || variante === "imagen-texto" || variante === "texto-imagen";
  const conTexto = variante === "textos" || variante === "imagen-texto" || variante === "texto-imagen";
  return ["caja", ...(conImagen ? (["imagen"] as const) : []), ...(conTexto ? (["titulo", "cuerpo"] as const) : [])];
}

/** Los roles que tiene sentido fijar para todo el mail de una sola vez. */
const ROLES_DOC: readonly RolEstilo[] = ["titulo", "subtitulo", "cuerpo", "boton", "nota"];

/** Cuál de las tres columnas se está mirando cuando no entran las tres. */
type VistaMovil = "lista" | "panel" | "preview";

const VISTAS: readonly { v: VistaMovil; label: string }[] = [
  { v: "lista", label: "Bloques" },
  { v: "panel", label: "Editar" },
  { v: "preview", label: "Vista previa" },
];

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
  const [pestana, setPestana] = useState<"contenido" | "estilo">("contenido");
  // Cuál de las tres columnas se muestra cuando NO entran las tres. Arranca en
  // la lista: el mapa del mail es desde donde se elige qué tocar.
  const [vistaMovil, setVistaMovil] = useState<VistaMovil>("lista");
  // El panel avanzado cuelga del ROL, no de `localStorage`: es lo que permite
  // empaquetarlo en un plan y bajarle el ruido a quien no lo necesita.
  const { puede } = usePermisos();
  const avanzado = puede("avanzado");

  const seleccionado = bloques.find((b) => b.id === seleccionadoId) ?? null;
  const setBloques = (bs: Bloque[], o?: OpcionesSet) => onChange({ ...contenido, bloques: bs }, o);

  /**
   * Elegir qué se edita **y** llevar la vista hasta el formulario.
   *
   * Con las tres columnas apiladas, tocar un bloque y quedarse en la lista deja
   * el control que se quiere girar a dos pantallas de scroll del mail que se
   * está mirando — que es exactamente el valor entero de este editor. En
   * escritorio la segunda mitad no se nota: la vista elegida se ignora cuando
   * las tres columnas entran juntas.
   */
  const elegir = (id: string | null) => {
    setSeleccionadoId(id);
    setVistaMovil("panel");
  };

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
    // Un bloque recién insertado nace vacío: quedarse en la lista mirándolo es
    // el único caso en el que la vista de celular no serviría para nada.
    if (nuevo.id) elegir(nuevo.id);
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

  /** Los estilos del documento (capa b). Vacío = la clave no existe. */
  const setEstilosDoc = (e: Estilos | undefined) => {
    const c = { ...contenido };
    if (e) c.estilos = e;
    else delete c.estilos;
    onChange(c);
  };

  // La misma paleta que va a usar el render: los swatches del panel son los
  // colores reales de la marca, no una aproximación del navegador.
  const pal = resolverPaleta({ ...(marca.temaMarca ?? {}), ...(contenido.tema ?? {}) });
  const anchoMail = pal.ancho;

  /** Abajo del corte se muestra UNA columna; arriba, las tres. */
  const soloSi = (v: VistaMovil) => (vistaMovil === v ? "" : "@max-[62rem]:hidden");

  return (
    // 🔴 `@container` y no un breakpoint de viewport, porque el editor **nunca
    // tuvo el ancho de la pantalla**. El `xl:` de antes disparaba a 1280, pero
    // ahí el espacio real es 1280 − 240 (sidebar) − 64 (padding) = 976, y las
    // dos columnas fijas se comen 632: la del medio —donde están TODOS los
    // formularios— nacía con 344px. El contenedor mide lo que hay de verdad.
    //
    // 62rem = 992px es dónde la del medio pasa a tener ~360: 260 + 340 de las
    // fijas más 32 de gaps. Con el `max-w-6xl` del layout eso cae recién a
    // 1296px de viewport, y sacar el editor de ese `max-w` es la Etapa 2.
    //
    // ⚠️ `container-type` implica `contain: layout`, así que este div es el
    // bloque de referencia de todo `position: fixed` que cuelgue adentro. Por
    // eso `ImagenPicker` dibuja su modal con un portal a `document.body`: sin
    // eso, la biblioteca de imágenes se abriría adentro de una columna.
    <div className="@container space-y-3">
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
                className={`flex ${tapTarget} items-center justify-center rounded-lg border border-border p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-30`}
              >
                <Undo2 className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={historial.rehacer}
                disabled={!historial.puedeRehacer}
                title="Rehacer (⇧⌘Z)"
                aria-label="Rehacer"
                className={`flex ${tapTarget} items-center justify-center rounded-lg border border-border p-1.5 text-muted transition-colors hover:text-foreground disabled:opacity-30`}
              >
                <Redo2 className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </div>
        <AISoonButton label="Redactar con IA" />
      </div>

      {/* Una vista a la vez, no tres apiladas. Apiladas son dos pantallas de
          scroll entre el control que se gira y el mail que se mira, y el valor
          entero de este editor es que el preview ES el mail que va a salir.
          Desaparece en cuanto las tres columnas entran juntas — con el MISMO
          corte que la grilla, o queda un tramo donde el selector no está y el
          layout sigue apilado. */}
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-0.5 @[62rem]:hidden">
        {VISTAS.map(({ v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => setVistaMovil(v)}
            aria-pressed={vistaMovil === v}
            className={`${tapTarget} rounded-md px-2 py-2 text-sm transition-colors ${
              vistaMovil === v
                ? "bg-accent-subtle font-medium text-accent-subtle-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 260px y no 220: con 220 la lista mostraba "Carrit…" y "Espa…", y el
          mapa del mail existe justamente para saber qué bloque es cuál sin
          abrirlo. El ancho sale de la columna del medio, que tiene aire. */}
      <div className="grid grid-cols-1 gap-4 @[62rem]:grid-cols-[260px_minmax(0,1fr)_minmax(340px,460px)]">
        {/* Columna 1 · el mapa del mail */}
        <div className={`space-y-2 rounded-xl border border-border bg-surface p-3 shadow-sm ${soloSi("lista")}`}>
          <button
            type="button"
            onClick={() => elegir(null)}
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
              onSeleccionar={elegir}
              onReorder={mover}
              onDuplicar={duplicar}
              onBorrar={borrar}
              onInsertar={insertar}
              soloLectura={soloLectura}
              avanzado={avanzado}
            />
          </div>
        </div>

        {/* Columna 2 · el panel de propiedades. Sin nada elegido muestra el
            diseño del mail, que ya trae su propia tarjeta. */}
        {seleccionado ? (
          <div className={`space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm ${soloSi("panel")}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{ETIQUETA_BLOQUE[seleccionado.tipo]}</h3>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                {(["contenido", "estilo"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPestana(p)}
                    aria-pressed={pestana === p}
                    className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                      pestana === p ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <fieldset disabled={soloLectura} className="space-y-3 disabled:opacity-60">
              {pestana === "contenido" ? (
                <FormBloque bloque={seleccionado} onChange={editar} marca={marca} />
              ) : (
                <PanelEstilo
                  // Remonta al cambiar de bloque: si no, el picker libre que
                  // quedó abierto en uno aparece abierto en el siguiente.
                  key={seleccionado.id}
                  tipo={seleccionado.tipo}
                  valor={seleccionado.estilo}
                  onChange={(e) => editar({ estilo: e })}
                  resolver={(rol) =>
                    resolverEstilo(seleccionado.tipo, rol, {
                      pal,
                      doc: contenido.estilos,
                      propio: seleccionado.estilo,
                    })
                  }
                  pal={pal}
                  roles={rolesDe(seleccionado)}
                  avanzado={avanzado}
                />
              )}
            </fieldset>
          </div>
        ) : (
          <div className={`space-y-4 ${soloSi("panel")}`}>
            <TemaSelector
              tema={contenido.tema}
              onChange={setTema}
              temaMarca={marca.temaMarca}
              ayuda={ayudaTema}
            />
            <div className="space-y-3 rounded-2xl border border-border bg-surface px-8 py-6 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Tipografía del mail</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Vale para todos los bloques de este mail. Un bloque suelto puede pisarlo desde su
                  pestaña Estilo.
                </p>
              </div>
              <fieldset disabled={soloLectura} className="space-y-3 disabled:opacity-60">
                <PanelEstilo
                  // La capa de documento no es de ningún bloque: cada rol se
                  // resuelve contra un representante solo para mostrar el "auto".
                  tipo="texto"
                  valor={contenido.estilos}
                  onChange={setEstilosDoc}
                  resolver={(rol) =>
                    resolverEstilo(REPRESENTA[rol], rol, { pal, doc: contenido.estilos })
                  }
                  pal={pal}
                  roles={ROLES_DOC}
                  avanzado={avanzado}
                />
              </fieldset>
            </div>
          </div>
        )}

        {/* Columna 3 · el mail */}
        <PreviewMail
          contenido={contenido}
          marca={marca}
          preheader={preheader}
          anchoMail={anchoMail}
          // El `sticky` se mueve con la grilla, no con el viewport: si se
          // quedara en `xl:` el preview se volvería pegajoso mientras todavía
          // está apilado abajo de las otras dos columnas, y "pegado arriba"
          // adentro de una pila es un cuadro que tapa el formulario.
          className={`@[62rem]:sticky @[62rem]:top-6 h-fit ${soloSi("preview")}`}
        />
      </div>
    </div>
  );
}
