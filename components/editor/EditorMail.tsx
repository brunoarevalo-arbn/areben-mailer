"use client";

import { useEffect, useRef, useState } from "react";
import {
  duplicarBloque, nuevoBloque, ETIQUETA_BLOQUE,
  type Bloque, type ContenidoCampania, type TipoBloque,
} from "@/lib/email/render";
import { resolverPaleta, type Tema } from "@/lib/email/tema";
import { resolverEstilo, ROLES_POR_TIPO, type Estilos, type RolEstilo } from "@/lib/email/estilos";
import { sobreDeRol } from "@/lib/email/contraste";
import { armarClip, leerClip, type Pegado } from "@/lib/email/portapapeles";
import { ListaBloques } from "@/components/editor/ListaBloques";
import { FormBloque } from "@/components/editor/FormBloque";
import { PanelEstilo } from "@/components/editor/PanelEstilo";
import { PreviewMail } from "@/components/editor/PreviewMail";
import { TemaSelector } from "@/components/TemaSelector";
import { Desplegable } from "@/components/ui/Desplegable";
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
  precio: "productos",
  nota: "productos",
};

/**
 * `caja` al final, siempre.
 *
 * 🔑 Todos los `ROLES_POR_TIPO` **empiezan** por `caja` —margen lateral, ocultar
 * en celular— y `PanelEstilo` abre de fábrica la primera sección que se ve. El
 * resultado era que estilar un `titulo` abría "Caja del bloque" y dejaba el
 * color un click más adentro, en cada bloque de cada mail.
 *
 * El orden vive acá y **no** en `ROLES_POR_TIPO` porque es una decisión de
 * presentación: qué roles tiene un bloque es del motor, en qué orden se
 * muestran es del panel. `probar-panel-estilo.ts` itera esa tabla y no le
 * importa el orden en que la dibujemos.
 */
function cajaAlFinal(roles: readonly RolEstilo[]): readonly RolEstilo[] {
  if (roles.length < 2 || roles[0] !== "caja") return roles;
  return [...roles.slice(1), "caja"];
}

/**
 * Qué roles ofrece el panel de estilo para ESTE bloque puntual.
 *
 * `ROLES_POR_TIPO` es por TIPO, así que no sabe que un `columnas` en variante
 * "imagenes" no dibuja ningún texto: ofrecer `titulo`/`cuerpo` ahí sería la
 * misma perilla desconectada que `probar-panel-estilo.ts` está pensado para
 * cazar, nada más que a nivel de instancia y no de tipo.
 */
/**
 * El fondo propio de una portada o una sección, cuando el bloque lo trae.
 *
 * Es la mitad del cálculo de la superficie que `superficieDe` no puede adivinar:
 * `bg` es un campo del bloque, no de su estilo.
 */
function bgDe(b: Bloque): string | undefined {
  return b.tipo === "hero" || b.tipo === "seccion" ? b.bg : undefined;
}

function rolesDe(b: Bloque): readonly RolEstilo[] {
  if (b.tipo !== "columnas") return cajaAlFinal(ROLES_POR_TIPO[b.tipo]);
  const variante = b.variante ?? "imagenes";
  const conImagen = variante === "imagenes" || variante === "imagen-texto" || variante === "texto-imagen";
  const conTexto = variante === "textos" || variante === "imagen-texto" || variante === "texto-imagen";
  return cajaAlFinal([
    "caja",
    ...(conImagen ? (["imagen"] as const) : []),
    ...(conTexto ? (["titulo", "cuerpo"] as const) : []),
  ]);
}

/** Los roles que tiene sentido fijar para todo el mail de una sola vez. */
const ROLES_DOC: readonly RolEstilo[] = ["titulo", "subtitulo", "cuerpo", "boton", "nota"];

/**
 * ¿El foco está adentro de algo donde se escribe?
 *
 * La guarda de los atajos que se pisan con el tecleo: sin ella, borrar una letra
 * del asunto con ⌫ borra el bloque elegido, y las flechas que mueven el cursor
 * saltan de bloque. ⚠️ **No es uniforme para todos los atajos** —⌥↑/⌥↓ y ⌘D
 * corren igual adentro de un campo, ver el efecto de abajo—, por eso vive suelta
 * y no adentro del listener.
 */
function enCampo(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

/**
 * ¿Hay un modal abierto por encima del editor?
 *
 * 🔴 `ImagenPicker` y `ModalVistaPrevia` se dibujan con un **portal a
 * `document.body`** —`container-type` implica `contain: layout`, así que adentro
 * del editor un `fixed inset-0` mediría una columna—, y el foco ahí adentro
 * suele quedar en el `body`. O sea: abrir la biblioteca de imágenes y apretar ⌫
 * borraba el bloque de atrás, con el modal todavía abierto mostrando las fotos
 * de un bloque que ya no existe.
 *
 * Se pregunta por `aria-modal`, que es el atributo que ya tienen que llevar por
 * accesibilidad, y no por una clase de Tailwind: un `z-50` es una decisión de
 * pintura y se puede cambiar sin que nadie se acuerde de este archivo.
 */
function hayModal(): boolean {
  return typeof document !== "undefined" && document.querySelector('[aria-modal="true"]') !== null;
}

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
  /**
   * Qué secciones del panel de estilo dejó abiertas la persona.
   *
   * 🔑 Vive **acá y no adentro de `PanelEstilo`**, que se remonta en cada cambio
   * de bloque (`key={seleccionado.id}`). Sin esto, poner el mismo color en cinco
   * títulos seguidos obliga a abrir "Título" cinco veces.
   *
   * Arranca en **`[]` y no en `null`**, y la diferencia importa: `null` sería
   * "que el panel decida", o sea abrir la primera sección en cada bloque que se
   * elige. Desde que el estilo comparte columna con el contenido eso es ruido
   * —la mayoría de las veces se entra a escribir, no a pintar—, así que el
   * estilo entra plegado y **el primer click se paga una sola vez**: lo que se
   * abre queda abierto en los bloques siguientes. La capa de documento sí usa el
   * default, porque esa no se remonta nunca.
   */
  const [rolesAbiertos, setRolesAbiertos] = useState<RolEstilo[] | null>([]);
  // Cuál de las tres columnas se muestra cuando NO entran las tres. Arranca en
  // la lista: el mapa del mail es desde donde se elige qué tocar.
  const [vistaMovil, setVistaMovil] = useState<VistaMovil>("lista");
  /**
   * El renglón efímero que cuenta qué acaba de pasar con el portapapeles.
   *
   * Copiar y pegar son las dos únicas operaciones del editor **sin consecuencia
   * visible en el lugar donde se hace el gesto**: mover, duplicar y borrar se
   * ven en la lista, pero un ⌘C no mueve un pixel y un ⌘V mete bloques que
   * pueden caer fuera de la parte visible de una lista larga. Sin este renglón,
   * la única forma de saber si copió es probar pegando.
   *
   * ⚠️ Va con `n` además del texto: copiar dos veces el mismo bloque tiene que
   * volver a encender el aviso, y con un `string` pelado el `setState` sería el
   * mismo valor y el efecto que lo apaga no se volvería a correr.
   */
  const [aviso, setAviso] = useState<{ txt: string; n: number } | null>(null);
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

  const avisar = (txt: string) => setAviso((a) => ({ txt, n: (a?.n ?? 0) + 1 }));

  // Se apaga solo. El renglón es una confirmación, no un estado: dejarlo puesto
  // haría que el "Título copiado" de hace diez minutos parezca de recién.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  /**
   * ⌘C — el bloque elegido al portapapeles del sistema.
   *
   * 🔴 **Portapapeles real y no un `sessionStorage`**, porque el caso es Zattia
   * en una pestaña y BDI en otra: dos sesiones del panel que no comparten nada.
   *
   * ⚠️ `writeText` y no el evento `copy`: es la mitad de la API que **no** pide
   * confirmación en Safari (la que pregunta es `readText`, y por eso pegar va
   * por el evento nativo y no por acá). Corre adentro del `keydown`, que es un
   * gesto del usuario — sin gesto, WebKit lo rechaza.
   */
  const copiar = (b: Bloque) => {
    if (!navigator.clipboard) {
      // Sin `https` no existe `navigator.clipboard`. En prod y en localhost está;
      // decirlo es mejor que un atajo que no hace nada y nadie sabe por qué.
      avisar("Este navegador no deja copiar desde acá");
      return;
    }
    navigator.clipboard.writeText(armarClip([b], marca.nombreCuenta)).then(
      () => avisar(`${ETIQUETA_BLOQUE[b.tipo]} copiado`),
      () => avisar("No se pudo copiar"),
    );
  };

  /**
   * ⌘V — los bloques del portapapeles, abajo del que está elegido.
   *
   * 🔑 **`leerClip` primero (que llama a `leerContenido`, regla 6) y recién
   * después el id nuevo con `duplicarBloque`.** El orden no es intercambiable, y
   * el segundo paso **no es una precaución sino LA garantía**: medido al
   * escribirlo, `leerContenido` tiene un camino rápido (`esActual`) que devuelve
   * el documento tal cual cuando el `v` ya es el actual, y ese chequeo **no mira
   * los ids repetidos**. O sea que de `leerClip` pueden salir ids que ya existen
   * en este documento —pegar dos veces el mismo bloque es el caso obvio— y así
   * React colapsa las dos tarjetas en una y el panel edita la equivocada.
   * `duplicarBloque` es la misma pieza que ya resuelve eso para ⌘D.
   *
   * ⛔ **El encabezado no entra nunca.** Hay uno solo y va primero (lo dice el
   * renderer, no la lista): un segundo encabezado pegado lo borra
   * `acomodarEncabezado` en la próxima lectura del Json, o sea que el bloque
   * aparecería en la lista y se evaporaría al guardar.
   *
   * ⚠️ **`html` pide `avanzado`**, igual que en la paleta. El bloque igual está
   * gateado por `permiteHtmlCrudo` al renderizar, así que esto no es la
   * seguridad: es que la escotilla de ADMIN no se abra desde otra pestaña.
   *
   * Lo que sí cruza de marca y está bien que cruce son los estilos: un color
   * guardado como `$acento` se repinta con la paleta de la marca de destino y
   * uno clavado en `#f59e0b` llega clavado, que es la misma distinción que el
   * panel muestra en cada control.
   */
  const pegar = (p: Pegado) => {
    const sinCabecera = p.bloques.filter((b) => b.tipo !== "encabezado");
    const entran = avanzado ? sinCabecera : sinCabecera.filter((b) => b.tipo !== "html");

    const motivos: string[] = [];
    if (sinCabecera.length < p.bloques.length) motivos.push("el encabezado no se duplica");
    if (entran.length < sinCabecera.length) motivos.push("el bloque HTML pide el permiso avanzado");

    if (!entran.length) {
      avisar(motivos.length ? `No se pegó nada: ${motivos.join(" y ")}` : "No había bloques para pegar");
      return;
    }

    const nuevos = entran.map(duplicarBloque);
    const i = bloques.findIndex((b) => b.id === seleccionadoId);
    // Abajo del elegido, igual que ⌘D. Sin nada elegido va al final: el otro
    // candidato —el principio— es justo donde vive el encabezado.
    const copia = [...bloques];
    copia.splice(i >= 0 ? i + 1 : bloques.length, 0, ...nuevos);
    setBloques(copia, { marcar: true });
    if (nuevos[0]?.id) setSeleccionadoId(nuevos[0].id);

    // De qué marca vino, y solo cuando NO es esta: pegar adentro de la misma
    // marca es el caso común y no necesita que se lo expliquen.
    const de = p.marca && p.marca !== marca.nombreCuenta ? ` de ${p.marca}` : "";
    const cuantos = nuevos.length === 1 ? "1 bloque pegado" : `${nuevos.length} bloques pegados`;
    avisar(`${cuantos}${de}${motivos.length ? ` · ${motivos.join(" y ")}` : ""}`);
  };

  /**
   * El teclado de bloques: `⌥↑`/`⌥↓` mover · `⌘D` duplicar · `⌘C` copiar ·
   * `⌫` borrar · `↑`/`↓` elegir. (`⌘V` no está acá: ver `alPegar`.)
   *
   * Cero UI nueva: las cinco funciones ya existían acá arriba y son las mismas
   * que llaman los botones de `ListaBloques`. Lo que resuelve es la puntería:
   * llevar un bloque de la posición 10 a la 1 son ocho clicks sobre un chevron
   * de 16px que además está en `opacity-0` hasta el hover. Con `⌥↑` mantenido,
   * el autorepetido del `keydown` lo hace en un segundo y medio.
   *
   * 🔑 **La guarda de foco NO es uniforme, y es lo único que decide si esto
   * sirve o estorba:**
   *
   * - **`⌥↑`/`⌥↓` y `⌘D` corren también con el cursor adentro de un campo.** El
   *   90% del tiempo se está tipeando: obligar a clickear afuera antes de mover
   *   un bloque mataría la tanda. Es el mismo criterio que ya tomó `useHistorial`
   *   con ⌘Z, que pisa el deshacer nativo adentro de un `<input>` a propósito.
   * - **`⌫`, `↑` y `↓` sólo con el foco FUERA de un campo.** Son las que tienen
   *   un significado nativo que se usa todo el tiempo mientras se escribe.
   *
   * ⚠️ **`⌘D` lleva `preventDefault()` incondicional**: es "Agregar marcador" en
   * Safari y en Chrome, y abrir ese diálogo es peor respuesta que no hacer nada,
   * haya bloque elegido o no. Mismo motivo por el que `BarraAcciones` lo hace
   * con ⌘S.
   *
   * ⚠️ **Con nada elegido, `↑`/`↓` no se apropian de la tecla**: el editor es una
   * página larga y las flechas son cómo se scrollea. Recién cuando hay un bloque
   * elegido —o sea, cuando ya estás "adentro" de la lista— pasan a navegarla.
   *
   * ⛔ **`Esc` no entra.** `ImagenPicker` ya lo escucha en `window`: los dos
   * listeners dispararían y cerrarías el modal **y** perderías la selección. Era
   * el atajo de menos valor de la lista.
   *
   * Los cinco reusan las operaciones marcadas (`{ marcar: true }`), así que cada
   * uno es **un** paso de ⌘Z aunque venga pegado a una ráfaga de tecleo.
   */
  const alTeclado = (ev: KeyboardEvent) => {
    // Con la biblioteca de imágenes o la vista previa abiertas, el editor de
    // atrás no escucha nada: ahí el foco vive en el `body` y ⌫ borraba un
    // bloque que no se estaba mirando.
    if (hayModal()) return;
    const i = bloques.findIndex((b) => b.id === seleccionadoId);

    // ⌘D / Ctrl+D — duplicar. `metaKey` en Mac y `ctrlKey` en Windows: los
    // dos, no uno u otro, que es el criterio que ya usan ⌘Z y ⌘S.
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") {
      ev.preventDefault();
      if (i >= 0) duplicar(i);
      return;
    }

    // ⌘C / Ctrl+C — copiar. ⚠️ **Sin `preventDefault` incondicional**, al revés
    // que ⌘D: acá el default del navegador es la operación que la gente
    // realmente quiere el 99% de las veces —copiar el texto seleccionado— y
    // quedárselo sería romper copiar una URL del panel para pegarla en un botón.
    // Se lo queda solo cuando el navegador no tendría nada que copiar.
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "c") {
      if (i < 0 || enCampo(ev.target)) return;
      // Algo seleccionado con el mouse gana siempre: es lo que la persona
      // está mirando cuando aprieta ⌘C.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;
      ev.preventDefault();
      copiar(bloques[i]);
      return;
    }

    // ⌥↑ / ⌥↓ — mover. El clamp del encabezado y el de los extremos ya viven
    // adentro de `mover`, así que acá no se repiten.
    if (ev.altKey && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
      if (i < 0) return;
      ev.preventDefault();
      mover(i, ev.key === "ArrowUp" ? i - 1 : i + 1);
      return;
    }

    // De acá para abajo, sólo teclas peladas y con el foco fuera de un campo.
    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.shiftKey) return;
    if (enCampo(ev.target)) return;

    if (ev.key === "Backspace" || ev.key === "Delete") {
      if (i < 0) return;
      ev.preventDefault();
      borrar(i);
      return;
    }

    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      if (i < 0) return;
      const destino = bloques[ev.key === "ArrowUp" ? i - 1 : i + 1];
      // Sin vecino la tecla se devuelve al navegador: en el primer y el último
      // bloque las flechas siguen scrolleando, que es lo que uno espera al
      // llegar a la punta de una lista.
      if (!destino?.id) return;
      ev.preventDefault();
      elegir(destino.id);
    }
  };

  /**
   * El handler vivo, en un ref, y el listener registrado UNA sola vez.
   *
   * 🔑 `alTeclado` cierra sobre `bloques` y sobre las cinco operaciones, y las
   * seis cosas se rehacen en **cada render** — o sea en cada tecla que se
   * escribe, porque el estado de este editor es el documento entero. Colgándolo
   * de las dependencias del efecto, el listener de `window` se daba de baja y de
   * alta una vez por letra tipeada; en dependencias vacías, en cambio, el
   * listener se queda con el `bloques` del primer render y mueve el bloque
   * equivocado. El ref es lo que rompe el falso dilema.
   *
   * ⚠️ Se escribe desde un efecto y **nunca durante el render** — escribir un ref
   * mientras se renderiza es justo lo que frena el lint de React (es el mismo
   * cuidado que documenta `useHistorial`).
   */
  /**
   * ⌘V, por el **evento nativo `paste`** y no por el `keydown`.
   *
   * 🔴 Es toda la tanda: la contracara de `writeText` es `readText()`, y en
   * Safari **pide confirmación en un diálogo cada vez** que se la llama. Un
   * pegar que abre un cartel es un pegar que nadie usa dos veces. El evento
   * `paste` trae el contenido puesto en `clipboardData`, sin permiso ninguno,
   * porque el gesto ES el permiso.
   *
   * ⚠️ El precio de la asimetría es que **pegar no se puede disparar desde un
   * botón**: no hay evento `paste` sin ⌘V. Por eso no hay botón de pegar en la
   * lista, y no es un olvido.
   *
   * La guarda es la misma que la de `⌫`: adentro de un campo, pegar tiene su
   * significado de siempre. Alguien que copió un bloque, entró a "Asunto" a
   * corregir una letra y apretó ⌘V se lleva el Json a la vista — feo, pero es
   * lo que pidió, y un ⌘Z lo saca. Robarle el pegado a un campo de texto sería
   * mucho peor.
   */
  const alPegar = (ev: ClipboardEvent) => {
    if (hayModal() || enCampo(ev.target)) return;
    const txt = ev.clipboardData?.getData("text/plain");
    if (!txt) return;
    const p = leerClip(txt);
    // `null` = esto no es nuestro. El evento se le devuelve al navegador entero:
    // el editor no tiene por qué opinar sobre el resto de las pegadas.
    if (!p) return;
    ev.preventDefault();
    pegar(p);
  };

  const atajos = useRef(alTeclado);
  const pegadas = useRef(alPegar);
  useEffect(() => {
    atajos.current = alTeclado;
    pegadas.current = alPegar;
  });

  useEffect(() => {
    if (soloLectura) return;
    const onKey = (ev: KeyboardEvent) => atajos.current(ev);
    const onPaste = (ev: ClipboardEvent) => pegadas.current(ev);
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [soloLectura]);

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
  const soloSi = (v: VistaMovil) => (vistaMovil === v ? "" : "@max-[66rem]:hidden");

  return (
    // 🔴 `@container` y no un breakpoint de viewport, porque el editor **nunca
    // tuvo el ancho de la pantalla**. El `xl:` de antes disparaba a 1280, pero
    // ahí el espacio real es 1280 − 240 (sidebar) − 64 (padding) = 976, y las
    // dos columnas fijas se comen 632: la del medio —donde están TODOS los
    // formularios— nacía con 344px. El contenedor mide lo que hay de verdad.
    //
    // 66rem = 1056px es dónde la del medio y el preview llegan a **382px cada
    // uno**: 260 de la lista más 32 de gaps, y el resto partido al medio entre
    // los dos `1fr`. Medido, no supuesto — el 62rem del plan daba 350 y el
    // primer corte que probé, 240.
    //
    // ⚠️ Eso cae en **1360px de viewport** con el menú desplegado: 1056 + 64 de
    // padding + 240 del sidebar. Con el menú **plegado** (64px) el mismo umbral
    // cae en 1184, y ésa es la mitad de lo que el plegado resuelve.
    //
    // 🔴 **Sacar el editor del cap NO baja ese umbral**, aunque este comentario
    // dijo lo contrario hasta el 5-ago-2026: a 1280 el ancho útil es
    // 1280−240−64 = 976 **con cap y sin cap por igual**, porque a ese tamaño el
    // cap ni siquiera está actuando. Lo que el cap SÍ hacía es congelar la
    // columna del medio en **398px** a partir de ~1392px de ventana — a 1440, a
    // 1512 y a 1920 por igual.
    //
    // ✅ **Las dos cosas se resolvieron el 5-ago-2026, y hacían falta las dos.**
    // El cap de estas tres pantallas subió a `--ancho-editor` (90rem) vía el
    // `has-[[data-editor]]` de `app/(app)/layout.tsx`, y el menú se pliega a
    // 4rem. Por separado ninguna alcanzaba: plegar sin subir el cap devuelve
    // **cero** pixeles arriba de 1400 (el cap ya era el que mandaba), y subir el
    // cap sin plegar deja 120 de los 296 posibles. Juntas, a 1512 el editor pasa
    // de 1088 a 1376 útiles y la columna del medio de 398 a ~542.
    // ⛔ Subir el cap, nunca sacarlo: sin tope, en un monitor de 1920 el campo
    // "Asunto" mediría 1616px de línea.
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
        {/* El renglón del portapapeles. Va acá arriba y no adentro de la lista
            de bloques porque abajo del corte se ve UNA columna por vez: pegar
            estando en "Vista previa" tiene que decir algo igual.

            ⚠️ Montado siempre, aunque esté vacío. Un `aria-live` que aparece
            junto con su texto no se anuncia: el lector de pantalla tiene que
            estar mirando la región desde antes de que cambie. */}
        <span
          aria-live="polite"
          className="min-w-0 flex-1 truncate px-2 text-center text-xs text-muted"
        >
          {aviso?.txt ?? ""}
        </span>
        <AISoonButton label="Redactar con IA" />
      </div>

      {/* Una vista a la vez, no tres apiladas. Apiladas son dos pantallas de
          scroll entre el control que se gira y el mail que se mira, y el valor
          entero de este editor es que el preview ES el mail que va a salir.
          Desaparece en cuanto las tres columnas entran juntas — con el MISMO
          corte que la grilla, o queda un tramo donde el selector no está y el
          layout sigue apilado. */}
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-0.5 @[66rem]:hidden">
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
          abrirlo.

          🔴 El preview pasó de `minmax(340px,460px)` a `minmax(340px,1fr)`, y
          esa es la mitad que faltaba del arreglo. Un track con máximo FIJO se
          sirve primero y el `1fr` del medio se queda con las sobras: medido en
          prod, con las tres columnas recién entrando la del medio nacía con
          **240px** — peor que los 344 que este cambio venía a arreglar. Con dos
          `1fr` el espacio libre se parte al medio y ninguna de las dos puede
          matar de hambre a la otra. */}
      <div className="grid grid-cols-1 gap-4 @[66rem]:grid-cols-[260px_minmax(0,1fr)_minmax(340px,1fr)]">
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
          // 🔑 **Contenido y estilo, en una sola columna.** Hasta el 5-ago-2026
          // eran dos pestañas, y `pestana` era un `useState` del editor que NO
          // se reseteaba al cambiar de bloque: si tocabas "Estilo" en uno, el
          // siguiente que elegías también abría en Estilo — clickeabas un texto
          // en el preview para escribirlo y te aparecía un panel de colores.
          //
          // ⛔ Resetear la pestaña a "contenido" al cambiar de selección NO era
          // el arreglo: rompe el flujo inverso, que es poner el mismo color en
          // cinco bloques seguidos. Un modo global tiene dos usuarios con
          // necesidades opuestas; una columna scrolleable no tiene ese problema.
          //
          // El panel crece exactamente un `<summary>` por rol respecto de la
          // vieja pestaña Contenido: el estilo entra **plegado** (`rolesAbiertos`
          // arranca en `[]`) y lo que se abra se recuerda de un bloque al otro.
          <div className={`space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm ${soloSi("panel")}`}>
            <h3 className="text-sm font-semibold text-foreground">{ETIQUETA_BLOQUE[seleccionado.tipo]}</h3>
            <fieldset disabled={soloLectura} className="space-y-4 disabled:opacity-60">
              <FormBloque bloque={seleccionado} onChange={editar} marca={marca} pal={pal} />
              <div className="border-t border-border pt-4">
                <PanelEstilo
                  // Remonta al cambiar de bloque: si no, el picker libre que
                  // quedó abierto en uno aparece abierto en el siguiente. Lo que
                  // SÍ sobrevive es qué secciones estaban abiertas, que vive
                  // arriba justamente porque esto se remonta.
                  key={seleccionado.id}
                  tipo={seleccionado.tipo}
                  valor={seleccionado.estilo}
                  onChange={(e) => editar({ estilo: e })}
                  // 🔴 El `sobre` no estaba, y por eso el panel podía mostrar un
                  // color que el mail no dibujaba: en una portada con fondo
                  // propio, el título en automático se recalcula contra ESE
                  // fondo (`tonosSobre`) y acá salía el de la paleta. `sobreDeRol`
                  // es la misma tabla que usa el renderer, así que ahora las dos
                  // pantallas contestan lo mismo — que es la condición para que
                  // el aviso de contraste no mienta.
                  resolver={(rol) => {
                    const ctx = { pal, doc: contenido.estilos, propio: seleccionado.estilo };
                    const caja = resolverEstilo(seleccionado.tipo, "caja", ctx);
                    const sobre = sobreDeRol(seleccionado.tipo, rol, caja, pal, bgDe(seleccionado));
                    return resolverEstilo(seleccionado.tipo, rol, ctx, sobre);
                  }}
                  pal={pal}
                  bg={bgDe(seleccionado)}
                  roles={rolesDe(seleccionado)}
                  avanzado={avanzado}
                  abiertos={rolesAbiertos}
                  onAbiertosChange={setRolesAbiertos}
                />
              </div>
            </fieldset>
          </div>
        ) : (
          <div className={`space-y-4 ${soloSi("panel")}`}>
            <TemaSelector
              tema={contenido.tema}
              onChange={setTema}
              temaMarca={marca.temaMarca}
              ayuda={ayudaTema}
              plegable
            />
            <div className="rounded-2xl border border-border bg-surface px-8 py-6 shadow-sm">
              <Desplegable
                titulo="Tipografía del mail"
                resumen="tamaños, colores y alineación por rol"
              >
              <p className="text-xs text-muted">
                Vale para todos los bloques de este mail. Un bloque suelto puede pisarlo desde
                su propio panel, eligiéndolo en la lista.
              </p>
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
              </Desplegable>
            </div>
          </div>
        )}

        {/* Columna 3 · el mail */}
        <PreviewMail
          contenido={contenido}
          marca={marca}
          preheader={preheader}
          anchoMail={anchoMail}
          seleccionadoId={seleccionadoId}
          // Tocar una parte del mail abre su formulario. En celular `elegir`
          // además salta a la vista "Editar": tocar algo y quedarse mirando el
          // mail sería la mitad del gesto.
          onSeleccionar={soloLectura ? undefined : elegir}
          // El `sticky` se mueve con la grilla, no con el viewport: si se
          // quedara en `xl:` el preview se volvería pegajoso mientras todavía
          // está apilado abajo de las otras dos columnas, y "pegado arriba"
          // adentro de una pila es un cuadro que tapa el formulario.
          className={`@[66rem]:sticky @[66rem]:top-6 h-fit ${soloSi("preview")}`}
        />
      </div>
    </div>
  );
}
