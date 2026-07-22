"use client";

import { useState, useEffect, useTransition } from "react";
import { CAMPOS, type Reglas, type Condicion, type CondCampo } from "@/lib/segmentos";
import { guardarSegmento, contarSegmento } from "@/app/segmentos/actions";

const input = "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function campoDef(campo: CondCampo) {
  return CAMPOS.find((c) => c.campo === campo)!;
}

function nuevaCondicion(): Condicion {
  return { campo: "tnTotalGastado", op: "gte", valor: 0 };
}

export function SegmentoBuilder({
  id,
  initial,
}: {
  id: string;
  initial: { nombre: string; reglas: Reglas };
}) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [op, setOp] = useState<"AND" | "OR">(initial.reglas?.op ?? "AND");
  const [conds, setConds] = useState<Condicion[]>(initial.reglas?.condiciones ?? []);
  const [count, setCount] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const reglas: Reglas = { op, condiciones: conds };

  // Conteo en vivo (con pequeño debounce)
  useEffect(() => {
    const t = setTimeout(async () => setCount(await contarSegmento(reglas)), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op, JSON.stringify(conds)]);

  const setCond = (i: number, patch: Partial<Condicion>) =>
    setConds((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const cambiarCampo = (i: number, campo: CondCampo) => {
    const def = campoDef(campo);
    const valor = def.tipo === "bool" ? true : def.tipo === "estado" ? "ACTIVO" : 0;
    setCond(i, { campo, op: def.ops[0].op, valor });
  };

  const guardar = () =>
    startSave(async () => {
      await guardarSegmento(id, nombre, reglas);
      setMsg("Guardado ✓");
      setTimeout(() => setMsg(null), 2000);
    });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-neutral-500">Nombre del segmento</span>
          <input className={`${input} mt-1 w-full`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Cumplir</span>
          <select className={input} value={op} onChange={(e) => setOp(e.target.value as "AND" | "OR")}>
            <option value="AND">TODAS las condiciones</option>
            <option value="OR">CUALQUIER condición</option>
          </select>
        </div>

        {conds.map((c, i) => {
          const def = campoDef(c.campo);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className={input} value={c.campo} onChange={(e) => cambiarCampo(i, e.target.value as CondCampo)}>
                {CAMPOS.map((cd) => (
                  <option key={cd.campo} value={cd.campo}>{cd.label}</option>
                ))}
              </select>
              <select className={input} value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>
                {def.ops.map((o) => (
                  <option key={o.op} value={o.op}>{o.label}</option>
                ))}
              </select>
              {def.tipo === "num" && (
                <input type="number" className={`${input} w-28`} value={Number(c.valor)} onChange={(e) => setCond(i, { valor: Number(e.target.value) })} />
              )}
              {def.tipo === "dias" && (
                <input type="number" className={`${input} w-24`} value={Number(c.valor)} onChange={(e) => setCond(i, { valor: Number(e.target.value) })} />
              )}
              {def.tipo === "bool" && (
                <select className={input} value={String(c.valor)} onChange={(e) => setCond(i, { valor: e.target.value === "true" })}>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              )}
              {def.tipo === "estado" && (
                <select className={input} value={String(c.valor)} onChange={(e) => setCond(i, { valor: e.target.value })}>
                  {["ACTIVO", "BAJA", "REBOTADO", "SPAM"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <button onClick={() => setConds((cs) => cs.filter((_, j) => j !== i))} className="px-2 text-red-500 hover:text-red-700">✕</button>
            </div>
          );
        })}

        <button onClick={() => setConds((cs) => [...cs, nuevaCondicion()])} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
          + Agregar condición
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="text-sm text-neutral-600">Contactos que matchean:</div>
        <div className="text-2xl font-semibold tabular-nums">{count === null ? "…" : count.toLocaleString("es-AR")}</div>
        <div className="ml-auto flex items-center gap-2">
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
          <button onClick={guardar} disabled={saving} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
