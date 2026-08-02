"use client";

import {
  RANGOS, ROLES_POR_TIPO, propsDeRol,
  type EstiloBloque, type EstiloResuelto, type Estilos, type RolEstilo, type ValorColor,
} from "@/lib/email/estilos";
import { FUENTES, FUENTE_LABEL, type Paleta } from "@/lib/email/tema";
import type { TipoBloque } from "@/lib/email/render";
import { ControlBool, ControlColor, ControlEnum, ControlNumero } from "@/components/editor/ControlEstilo";
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
  fuente: { tipo: "enum", label: "Tipografía", opciones: TIPOGRAFIAS, avanzado: true },
  bordeEstilo: { tipo: "enum", label: "Estilo del borde", opciones: BORDES, avanzado: true },

  mayusculas: { tipo: "bool", label: "En mayúsculas", avanzado: true },
  subrayado: { tipo: "bool", label: "Subrayado", avanzado: true },
  ocultarMovil: { tipo: "bool", label: "Ocultar en el celular", avanzado: true },
  ocultarEscritorio: { tipo: "bool", label: "Ocultar en escritorio", avanzado: true },
};

export const ROL_LABEL: Record<RolEstilo, string> = {
  caja: "Caja del bloque",
  titulo: "Título",
  subtitulo: "Subtítulo",
  cuerpo: "Texto",
  boton: "Botón",
  imagen: "Imagen",
  nota: "Detalles",
};

export function PanelEstilo({
  tipo,
  valor,
  onChange,
  resolver,
  pal,
  roles,
  avanzado,
}: {
  /** Contra qué bloque se resuelve el "automático". */
  tipo: TipoBloque;
  /** La capa que se edita. `undefined` = esta capa no dice nada. */
  valor: Estilos | undefined;
  onChange: (e: Estilos | undefined) => void;
  resolver: (rol: RolEstilo) => EstiloResuelto;
  pal: Paleta;
  /** Qué roles mostrar. Por defecto, los que el bloque dibuja de verdad. */
  roles?: readonly RolEstilo[];
  /** ¿Se ven las perillas finas? Cuelga del rol, no de una preferencia del navegador. */
  avanzado: boolean;
}) {
  const lista = roles ?? ROLES_POR_TIPO[tipo];

  if (!lista.length) {
    return (
      <p className="text-sm text-muted">
        Este bloque no tiene nada de estilo para tocar: es alto y nada más, y el alto está en
        la pestaña Contenido.
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
  const set = (rol: RolEstilo, k: Prop, v: unknown) => {
    const rolAnterior = valor?.[rol];
    const nuevoRol: EstiloBloque = { ...rolAnterior };
    if (v === undefined) delete nuevoRol[k];
    else (nuevoRol as Record<string, unknown>)[k] = v;

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
    .map((rol) => ({ rol, visibles: (propsDeRol(tipo, rol) as readonly Prop[]).filter((k) => avanzado || !CAMPO[k].avanzado) }))
    .filter((s) => s.visibles.length);

  return (
    // Un desplegable por rol, y NO abajo de un breakpoint: cinco roles por seis
    // a dieciocho propiedades en una sola columna continua también son malos a
    // 1440. El porqué de que sea nativo está en `Desplegable`.
    //
    // ⛔ No se reusa `pestana`: eso es un binario entre dos paneles que se
    // excluyen (Contenido / Estilo). Los roles son de 1 a 5 y son ADITIVOS —
    // querés el color del título Y el del cuerpo abiertos a la vez.
    <div className="space-y-4">
      {secciones.map(({ rol, visibles }, i) => {
        const propio = valor?.[rol];
        const res = resolver(rol);

        return (
          <Desplegable key={rol} titulo={ROL_LABEL[rol]} tono="rol" abiertoDeFabrica={i === 0}>
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
