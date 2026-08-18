"use client";

import {
  RANGOS, ROLES_POR_TIPO, ROL_LABEL, propsDeRol,
  type EstiloBloque, type EstiloResuelto, type Estilos, type RolEstilo, type ValorColor,
} from "@/lib/email/estilos";
import { avisarContraste, superficieDe, type AvisoContraste } from "@/lib/email/contraste";
import { FUENTES, FUENTE_LABEL, type Paleta } from "@/lib/email/tema";
import type { TipoBloque } from "@/lib/email/render";
import { ControlBool, ControlColor, ControlEnum, ControlNumero, ControlTamanoBoton } from "@/components/editor/ControlEstilo";
import { Desplegable } from "@/components/ui/Desplegable";

/**
 * La pestaña **Estilo**: una capa de la cascada, editable rol por rol.
 *
 * El mismo componente sirve para las dos capas que se editan a mano —la del
 * documento ("en este mail, todos los títulos…") y la del bloque— porque la
 * única diferencia entre ellas es contra qué se resuelve el "automático". Quien
 * llama pasa el `resolver`.
 *
 * Lo que NO se ofrece está tan pensado como lo que sí: los controles salen de
 * `propsDeRol`, que espeja lo que el renderer emite de verdad y lo verifica
 * `scripts/probar-panel-estilo.ts`. Una perilla que no mueve nada se lee como
 * "el mail está roto".
 */

/** Las propiedades que el panel sabe dibujar. `ancho` y `alto` no se emiten hoy. */
type Prop = Exclude<keyof EstiloBloque, "ancho" | "alto">;

interface Opcion {
  valor: string | number;
  label: string;
}

type Def =
  | { tipo: "color"; label: string; avanzado?: boolean }
  | { tipo: "num"; label: string; rango: readonly [number, number]; paso?: number; sufijo?: string; avanzado?: boolean }
  | { tipo: "enum"; label: string; opciones: readonly Opcion[]; avanzado?: boolean }
  | { tipo: "bool"; label: string; avanzado?: boolean };

const ALIGN = [
  { valor: "left", label: "Izquierda" },
  { valor: "center", label: "Centro" },
  { valor: "right", label: "Derecha" },
] as const;

const PESOS = [
  { valor: 400, label: "Normal" },
  { valor: 500, label: "Medio" },
  { valor: 600, label: "Semi negrita" },
  { valor: 700, label: "Negrita" },
] as const;

const BORDES = [
  { valor: "solid", label: "Línea llena" },
  { valor: "dashed", label: "Línea cortada" },
] as const;

const TIPOGRAFIAS = (Object.keys(FUENTES) as (keyof typeof FUENTES)[]).map((k) => ({
  valor: k,
  label: FUENTE_LABEL[k],
}));

/**
 * Cada propiedad descrita UNA vez.
 *
 * `avanzado: true` es lo que queda detrás del permiso: son las perillas de
 * diseñador —interlineado, espaciado entre letras, grosores, bordes— que a quien
 * vende en Tiendanube no le aportan nada y sí le suben el costo de equivocarse.
 */
const CAMPO: Record<Prop, Def> = {
  color: { tipo: "color", label: "Color del texto" },
  fondo: { tipo: "color", label: "Fondo" },
  bordeColor: { tipo: "color", label: "Color del borde", avanzado: true },

  tamano: { tipo: "num", label: "Tamaño", rango: RANGOS.tamano },
  padX: { tipo: "num", label: "Margen lateral", rango: RANGOS.padX },
  padY: { tipo: "num", label: "Margen arriba y abajo", rango: RANGOS.padY },
  interlinea: { tipo: "num", label: "Interlineado", rango: RANGOS.interlinea, paso: 0.05, sufijo: "×", avanzado: true },
  espaciado: { tipo: "num", label: "Espacio entre letras", rango: RANGOS.espaciado, avanzado: true },
  radio: { tipo: "num", label: "Redondeo", rango: RANGOS.radio, avanzado: true },
  bordeAncho: { tipo: "num", label: "Grosor del borde", rango: RANGOS.bordeAncho, avanzado: true },

  align: { tipo: "enum", label: "Alineación", opciones: ALIGN },
  peso: { tipo: "enum", label: "Grosor", opciones: PESOS, avanzado: true },
  // 🔑 **Sin `avanzado`, y es la única del panel que lo perdió** (4-ago-2026).
  // Elegir la letra es una decisión de MARCA, que es exactamente lo que un
  // comerciante de Tiendanube quiere tomar; el interlineado y el espacio entre
  // letras no lo son y siguen gateados, que es para lo que el permiso existe.
  // Mientras estuvo acá, el comerciante no podía elegir ni una de las fuentes.
  fuente: { tipo: "enum", label: "Tipografía", opciones: TIPOGRAFIAS },
  bordeEstilo: { tipo: "enum", label: "Estilo del borde", opciones: BORDES, avanzado: true },

  mayusculas: { tipo: "bool", label: "En mayúsculas", avanzado: true },
  subrayado: { tipo: "bool", label: "Subrayado", avanzado: true },
  italica: { tipo: "bool", label: "Itálica", avanzado: true },
  ocultarMovil: { tipo: "bool", label: "Ocultar en el celular", avanzado: true },
  ocultarEscritorio: { tipo: "bool", label: "Ocultar en escritorio", avanzado: true },
};

export function PanelEstilo({
  tipo,
  valor,
  onChange,
  resolver,
  pal,
  bg,
  roles,
  omitir,
  avanzado,
  abiertos,
  onAbiertosChange,
}: {
  /** Contra qué bloque se resuelve el "automático". */
  tipo: TipoBloque;
  /** La capa que se edita. `undefined` = esta capa no dice nada. */
  valor: Estilos | undefined;
  onChange: (e: Estilos | undefined) => void;
  resolver: (rol: RolEstilo) => EstiloResuelto;
  pal: Paleta;
  /**
   * El fondo propio del bloque (`hero.bg` / `seccion.bg`), para ubicar sobre qué
   * se apoya su texto. Sin esto el aviso de contraste mediría contra la tarjeta
   * y no contra la portada.
   */
  bg?: string;
  /** Qué roles mostrar. Por defecto, los que el bloque dibuja de verdad. */
  roles?: readonly RolEstilo[];
  /**
   * Perillas que este llamador NO quiere ofrecer, aunque el rol las tenga.
   *
   * 🔑 Existe por la **capa de documento**: ahí la caja se ofrece para poner el
   * aire de todo el mail de una vez, pero `ocultarMovil`/`ocultarEscritorio`
   * viven en el mismo rol y aplicados a todo el mail significan **mandar un mail
   * vacío**. No es una perilla fina —no alcanza con `avanzado`—: es una que en
   * esa capa no tiene sentido ninguno.
   */
  omitir?: readonly Prop[];
  /** ¿Se ven las perillas finas? Cuelga del rol, no de una preferencia del navegador. */
  avanzado: boolean;
  /**
   * Qué secciones dejó abiertas la persona, para que sobrevivan al remonte.
   *
   * Tres valores distintos, y los tres significan cosas distintas:
   * `undefined`/`null` = nunca tocó nada ⇒ abre la primera · `[]` = cerró todo
   * a propósito ⇒ no abre ninguna · con roles = abre esos.
   *
   * Sin esta prop el panel se porta como siempre (abre la primera), que es lo
   * que quiere la capa de documento: esa no se remonta nunca.
   */
  abiertos?: readonly RolEstilo[] | null;
  onAbiertosChange?: (roles: RolEstilo[]) => void;
}) {
  const lista = roles ?? ROLES_POR_TIPO[tipo];

  if (!lista.length) {
    return (
      <p className="text-sm text-muted">
        Este bloque no tiene nada de estilo para tocar: es alto y nada más, y el alto está
        acá arriba.
      </p>
    );
  }

  /**
   * Escribe una propiedad de un rol en la capa que se está editando.
   *
   * ⚠️ Un rol sin ninguna propiedad se BORRA, y una capa sin ningún rol también.
   * Un `{}` colgado hace que `"titulo" in estilos` diga que sí para un rol que
   * nadie tocó, y de ese "¿lo eligió una persona?" dependen la legibilidad
   * contextual y el modo oscuro.
   */
  const set = (rol: RolEstilo, k: Prop, v: unknown) => setMuchas(rol, { [k]: v });

  /**
   * Varias propiedades de un rol **en una sola escritura**.
   *
   * 🔴 No es azúcar sobre `set`: es al revés, y el orden importa. Llamar a `set`
   * tres veces seguidas para el selector de tamaño de botón **no funciona** —
   * cada llamada reconstruye desde el mismo `valor` de este render, así que la
   * segunda y la tercera parten del estado viejo y se pisan entre sí; quedaría
   * escrita nada más que la última.
   *
   * Una clave con valor `undefined` se BORRA, que es como se vuelve a heredar.
   */
  const setMuchas = (rol: RolEstilo, campos: Record<string, unknown>) => {
    const nuevoRol: EstiloBloque = { ...valor?.[rol] };
    for (const [k, v] of Object.entries(campos)) {
      if (v === undefined) delete nuevoRol[k as Prop];
      else (nuevoRol as Record<string, unknown>)[k] = v;
    }

    const out: Estilos = { ...valor };
    if (Object.keys(nuevoRol).length) out[rol] = nuevoRol;
    else delete out[rol];

    onChange(Object.keys(out).length ? out : undefined);
  };

  /**
   * Los roles que de verdad se van a dibujar, ya sin los que quedaron vacíos.
   *
   * Se calcula antes del `map` y no adentro porque el "abierto" es el PRIMERO
   * QUE SE VE: con el índice del `lista.map`, un rol cuyos controles son todos
   * avanzados —invisible para quien no tiene el permiso— se lleva el `open` y el
   * panel abre cerrado entero.
   */
  const secciones = lista
    .map((rol) => ({
      rol,
      visibles: (propsDeRol(tipo, rol) as readonly Prop[]).filter(
        (k) => !omitir?.includes(k) && (avanzado || !CAMPO[k].avanzado),
      ),
    }))
    .filter((s) => s.visibles.length);

  /**
   * Qué secciones arrancan abiertas en ESTE montaje.
   *
   * 🔑 El valor tiene que **seguir** al DOM, nunca pelearse con él: cada vez que
   * la persona abre o cierra algo, `onAbiertosChange` deja la lista igual a lo
   * que el `<details>` ya hizo solo, así el único `open` que React llega a
   * escribir es el que coincide con lo que se ve. Es la condición que pide
   * `Desplegable` para que la prop no pise a la persona.
   *
   * Un rol recordado que este bloque no dibuja se descarta —cambiar de un
   * `titulo` a un `divisor` no puede dejar el panel entero cerrado—, pero
   * "cerré todo" (lista vacía) sí se respeta: si no, cerrar la última sección la
   * haría saltar de vuelta.
   */
  const presentes = abiertos?.filter((r) => secciones.some((s) => s.rol === r));
  const efectivos =
    presentes && (presentes.length > 0 || abiertos!.length === 0)
      ? presentes
      : secciones.length
        ? [secciones[0].rol]
        : [];

  /**
   * ¿El texto de este rol se lee sobre lo que tiene atrás?
   *
   * 🔴 **Nació del T01 de BDI**: seis nombres de producto salieron a 501 casillas
   * con el color del fondo puesto a mano, contraste 1.00:1. El motor obedeció
   * —tiene que obedecer, es el mail de quien lo arma— y no había ningún lugar
   * donde eso se viera antes de apretar Enviar.
   *
   * El botón se mide contra **su propio fondo** y no contra la superficie del
   * bloque: es la única parte del mail que trae la suya puesta.
   *
   * ⚠️ En la capa de DOCUMENTO —"en este mail, todos los títulos…"— la superficie
   * es siempre la tarjeta, porque esa capa no es de ningún bloque: un color
   * elegido ahí cae sobre todos, y la tarjeta es donde se apoya la mayoría. La
   * lectura fina de cada bloque sale en el panel de ESE bloque.
   */
  const superficie = superficieDe(tipo, resolver("caja"), pal, bg);
  const avisoDe = (rol: RolEstilo): AvisoContraste | null => {
    const e = resolver(rol);
    if (rol === "imagen" || rol === "caja") return null;
    const fondo = rol === "boton" ? e.fondo ?? superficie : superficie;
    return avisarContraste(e.color, fondo, e.elegidas.has("color") || e.elegidas.has("fondo"));
  };
  const avisos = secciones
    .map(({ rol }) => ({ rol, aviso: avisoDe(rol) }))
    .filter((a): a is { rol: RolEstilo; aviso: AvisoContraste } => a.aviso !== null);
  const invisibles = avisos.filter((a) => a.aviso.nivel === "invisible");

  return (
    // Un desplegable por rol, y NO abajo de un breakpoint: cinco roles por seis
    // a dieciocho propiedades en una sola columna continua también son malos a
    // 1440. El porqué de que sea nativo está en `Desplegable`.
    //
    // ⛔ Y **no** son un binario tipo "uno abierto a la vez": los roles van de 1
    // a 5 y son ADITIVOS — querés el color del título Y el del cuerpo abiertos
    // juntos. Es lo que obliga a que `abiertos` sea una lista y no un solo rol,
    // y a que el valor siga al DOM en vez de gobernarlo.
    <div className="space-y-4">
      {/* 🔑 **Arriba de todo y fuera de los desplegables, a propósito.** El aviso
          que vive adentro del rol sólo lo ve quien ya abrió ese rol, y el color
          ilegible del T01 estaba en un bloque que nadie había vuelto a abrir. Si
          el cartel no se ve con el panel plegado, no frena nada. */}
      {avisos.length > 0 && (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            invisibles.length
              ? "border-danger-border bg-danger text-danger-foreground"
              : "border-warning-border bg-warning text-warning-foreground"
          }`}
        >
          {invisibles.length > 0 ? (
            <>
              <strong>No se ve:</strong>{" "}
              {invisibles.map((a) => ROL_LABEL[a.rol].toLowerCase()).join(", ")} — el color
              elegido es casi el mismo que el del fondo.
            </>
          ) : (
            <>
              <strong>Se lee con dificultad:</strong>{" "}
              {avisos.map((a) => ROL_LABEL[a.rol].toLowerCase()).join(", ")}.
            </>
          )}
        </p>
      )}
      {secciones.map(({ rol, visibles }) => {
        const propio = valor?.[rol];
        const res = resolver(rol);

        return (
          <Desplegable
            key={rol}
            titulo={ROL_LABEL[rol]}
            tono="rol"
            abiertoDeFabrica={efectivos.includes(rol)}
            onToggle={
              onAbiertosChange &&
              // El `filter` corre en las dos ramas a propósito: así la lista es
              // la misma se dispare el evento una vez o dos, y nunca guarda un
              // rol repetido.
              ((abierto) => {
                const resto = efectivos.filter((r) => r !== rol);
                onAbiertosChange(abierto ? [...resto, rol] : resto);
              })
            }
          >
            {/* Arriba de las perillas, no abajo: es el atajo que la mayoría va
                a usar, y las tres que resume quedan a mano para afinar. Va
                dentro del rol `boton` y por eso vale para los cinco bloques que
                dibujan uno —el botón suelto, el cupón, la portada, la sección y
                las columnas— sin repetir nada. */}
            {rol === "boton" && (
              <ControlTamanoBoton valor={propio} onChange={(v) => setMuchas("boton", v)} />
            )}
            {visibles.map((k) => {
              const def = CAMPO[k];
              const bruto = propio?.[k];
              switch (def.tipo) {
                case "color":
                  return (
                    <ControlColor
                      key={k}
                      label={def.label}
                      valor={bruto as ValorColor | undefined}
                      resuelto={res[k as "color" | "fondo" | "bordeColor"] as string | undefined}
                      pal={pal}
                      // El par que se mide es texto↔fondo, así que el mismo
                      // aviso cuelga de los dos controles del botón —tocar
                      // cualquiera de los dos lo arregla— y de ninguno del
                      // borde, que no tiene letras encima.
                      aviso={k === "color" || (rol === "boton" && k === "fondo") ? avisoDe(rol) : null}
                      onChange={(v) => set(rol, k, v)}
                    />
                  );
                case "num":
                  return (
                    <ControlNumero
                      key={k}
                      label={def.label}
                      valor={bruto as number | undefined}
                      resuelto={res[k as keyof EstiloResuelto] as number | undefined}
                      rango={def.rango}
                      paso={def.paso}
                      sufijo={def.sufijo}
                      onChange={(v) => set(rol, k, v)}
                    />
                  );
                case "enum":
                  return (
                    <ControlEnum
                      key={k}
                      label={def.label}
                      valor={bruto as string | number | undefined}
                      resuelto={
                        // La fuente sale del tema del mail y se resuelve como
                        // stack CSS entero (`Georgia, serif`), no como la clave:
                        // no hay forma de mostrarla como opción del select, así
                        // que ese queda en "Automático" pelado.
                        (k === "fuente" ? undefined : res[k as keyof EstiloResuelto]) as string | number | undefined
                      }
                      opciones={def.opciones}
                      onChange={(v) => set(rol, k, v)}
                    />
                  );
                case "bool":
                  return (
                    <ControlBool
                      key={k}
                      label={def.label}
                      valor={bruto as boolean | undefined}
                      resuelto={res[k as keyof EstiloResuelto] as boolean | undefined}
                      onChange={(v) => set(rol, k, v)}
                    />
                  );
              }
            })}
          </Desplegable>
        );
      })}
    </div>
  );
}
