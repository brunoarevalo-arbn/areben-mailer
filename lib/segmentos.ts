import type { Prisma } from "@prisma/client";

// Reglas de un segmento (guardadas en Segmento.reglas como JSON).
export type CondCampo = "tnTotalGastado" | "tnUltimaCompra" | "tnAcceptsMkt" | "esComprador" | "estado";

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
];
