import type { Prisma } from "@prisma/client";

// Reglas de un segmento (guardadas en Segmento.reglas como JSON).
export type CondCampo =
  | "tnTotalGastado"
  | "tnUltimaCompra"
  | "tnAcceptsMkt"
  | "esComprador"
  | "estado"
  | "abrio"
  | "clickeo";

export interface Condicion {
  campo: CondCampo;
  op: string;
  valor: string | number | boolean;
}

export interface Reglas {
  op: "AND" | "OR";
  condiciones: Condicion[];
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function condToWhere(c: Condicion): Prisma.ContactoWhereInput | null {
  switch (c.campo) {
    case "tnTotalGastado": {
      const v = Number(c.valor);
      if (Number.isNaN(v)) return null;
      if (["gt", "gte", "lt", "lte"].includes(c.op)) return { tnTotalGastado: { [c.op]: v } };
      return null;
    }
    case "tnUltimaCompra": {
      const dias = Number(c.valor);
      if (Number.isNaN(dias)) return null;
      const umbral = diasAtras(dias);
      if (c.op === "comproUltimos") return { tnUltimaCompra: { gte: umbral } };
      if (c.op === "noComproUltimos")
        return { OR: [{ tnUltimaCompra: { lt: umbral } }, { tnUltimaCompra: null }] };
      return null;
    }
    case "tnAcceptsMkt":
      return { tnAcceptsMkt: c.valor === true || c.valor === "true" };
    case "esComprador":
      return c.valor === true || c.valor === "true"
        ? { tnTotalGastado: { gt: 0 } }
        : { OR: [{ tnTotalGastado: null }, { tnTotalGastado: { lte: 0 } }] };
    case "estado":
      return { estado: c.valor as Prisma.ContactoWhereInput["estado"] };
    // Enganche. Sale de `Envio` (`abiertoAt` / `clickAt`), que cuelga del
    // contacto: es la única condición que no mira una columna de `Contacto`.
    case "abrio":
    case "clickeo": {
      const dias = Number(c.valor);
      if (Number.isNaN(dias)) return null;
      const umbral = diasAtras(dias);
      const marca = c.campo === "abrio" ? "abiertoAt" : "clickAt";
      // "Lo hizo": algún envío de la ventana con la marca puesta.
      if (c.op === "si") return { envios: { some: { [marca]: { gte: umbral } } } };
      // 🔴 "No lo hizo" es **recibió y no lo hizo**, nunca "no me consta".
      //
      // Escrito como `{ envios: { none: { … } } }` a secas, entra todo el que
      // NUNCA recibió un mail —los que se anotaron ayer, los que estaban en un
      // tramo que todavía no salió— y el mail de reactivación le pega a gente
      // que jamás supo de nosotros. Es el mismo agujero que tiene
      // `noComproUltimos` acá arriba, donde una fecha vacía cuenta como "no
      // compró": ahí ya está escrito así y cambiarlo movería segmentos que
      // alguien pueda tener guardados, pero **no se repite en los nuevos**.
      //
      // Por eso son dos condiciones: recibió algo en la ventana Y ninguno de
      // esos envíos tiene la marca.
      if (c.op === "no")
        return {
          AND: [
            { envios: { some: { enviadoAt: { gte: umbral } } } },
            { envios: { none: { [marca]: { gte: umbral } } } },
          ],
        };
      return null;
    }
    default:
      return null;
  }
}

/** Convierte las reglas de un segmento en un where de Prisma (sin cuentaId). */
export function reglasToWhere(reglas: Reglas): Prisma.ContactoWhereInput {
  const conds = (reglas?.condiciones ?? []).map(condToWhere).filter(Boolean) as Prisma.ContactoWhereInput[];
  if (conds.length === 0) return {};
  return reglas.op === "OR" ? { OR: conds } : { AND: conds };
}

export const CAMPOS: { campo: CondCampo; label: string; ops: { op: string; label: string }[]; tipo: "num" | "dias" | "bool" | "estado" }[] = [
  { campo: "tnTotalGastado", label: "Total gastado", tipo: "num", ops: [
    { op: "gte", label: "≥" }, { op: "gt", label: ">" }, { op: "lte", label: "≤" }, { op: "lt", label: "<" },
  ] },
  { campo: "tnUltimaCompra", label: "Última compra", tipo: "dias", ops: [
    { op: "comproUltimos", label: "compró en los últimos (días)" },
    { op: "noComproUltimos", label: "no compró en (días)" },
  ] },
  { campo: "esComprador", label: "Es comprador", tipo: "bool", ops: [{ op: "eq", label: "es" }] },
  { campo: "tnAcceptsMkt", label: "Acepta marketing", tipo: "bool", ops: [{ op: "eq", label: "es" }] },
  { campo: "estado", label: "Estado", tipo: "estado", ops: [{ op: "eq", label: "es" }] },
  // ⚠️ El click va ANTES que la apertura en la lista a propósito: es la señal
  // que no se falsifica. El pixel de apertura lo dispara el escaneo de
  // seguridad de Outlook sin que nadie mire el mail —es lo que infló las 880
  // aperturas de la campaña de Perfit—, así que un segmento de "abrió" sobre
  // una lista con mucho Microsoft premia a gente que nunca lo vio. Para
  // *premiar* al enganchado se usa el click; la apertura sirve para lo
  // contrario: descartar al que ni la abre.
  { campo: "clickeo", label: "Hizo click en un mail", tipo: "dias", ops: [
    { op: "si", label: "sí, en los últimos (días)" },
    { op: "no", label: "no, habiendo recibido en (días)" },
  ] },
  { campo: "abrio", label: "Abrió un mail", tipo: "dias", ops: [
    { op: "si", label: "sí, en los últimos (días)" },
    { op: "no", label: "no, habiendo recibido en (días)" },
  ] },
];
