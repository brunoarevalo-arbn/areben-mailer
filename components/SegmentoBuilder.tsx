"use client";

import { useState, useEffect, useTransition } from "react";
import { CAMPOS, type Reglas, type Condicion, type CondCampo } from "@/lib/segmentos";
import { guardarSegmento, contarSegmento } from "@/app/(app)/segmentos/actions";
import { Button } from "@/components/ui/Button";
import { usePermisos } from "@/components/PermisosProvider";
import { X } from "lucide-react";
import { campoBase, tapTarget } from "@/lib/ui";


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
  const { soloLectura } = usePermisos();

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
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <label className="block text-sm">
          <span className="text-muted">Nombre del segmento</span>
          <input className={`${campoBase} mt-1 w-full`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Cumplir</span>
          <select className={campoBase} value={op} onChange={(e) => setOp(e.target.value as "AND" | "OR")}>
            <option value="AND">TODAS las condiciones</option>
            <option value="OR">CUALQUIER condición</option>
          </select>
        </div>

        {conds.map((c, i) => {
          const def = campoDef(c.campo);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className={campoBase} value={c.campo} onChange={(e) => cambiarCampo(i, e.target.value as CondCampo)}>
                {CAMPOS.map((cd) => (
                  <option key={cd.campo} value={cd.campo}>{cd.label}</option>
                ))}
              </select>
              <select className={campoBase} value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>
                {def.ops.map((o) => (
                  <option key={o.op} value={o.op}>{o.label}</option>
                ))}
              </select>
              {def.tipo === "num" && (
                <input type="number" className={`${campoBase} w-28`} value={Number(c.valor)} onChange={(e) => setCond(i, { valor: Number(e.target.value) })} />
              )}
              {def.tipo === "dias" && (
                <input type="number" className={`${campoBase} w-24`} value={Number(c.valor)} onChange={(e) => setCond(i, { valor: Number(e.target.value) })} />
              )}
              {def.tipo === "bool" && (
                <select className={campoBase} value={String(c.valor)} onChange={(e) => setCond(i, { valor: e.target.value === "true" })}>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              )}
              {def.tipo === "estado" && (
                <select className={campoBase} value={String(c.valor)} onChange={(e) => setCond(i, { valor: e.target.value })}>
                  {["ACTIVO", "BAJA", "REBOTADO", "SPAM"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <button onClick={() => setConds((cs) => cs.filter((_, j) => j !== i))} aria-label="Quitar condición" className={`inline-flex ${tapTarget} items-center justify-center px-2 text-danger-foreground hover:opacity-70`}><X className="h-4 w-4" aria-hidden /></button>
            </div>
          );
        })}

        <button onClick={() => setConds((cs) => [...cs, nuevaCondicion()])} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm text-muted hover:bg-surface-muted">
          + Agregar condición
        </button>
      </div>

      {/* `flex-wrap`: a 343px "Contactos que matchean:" + el número + "Guardar"
          no entran en una línea, y sin envolver el botón se comprime hasta
          partir la palabra. El `ml-auto` sigue valiendo envuelto: cuando el
          bloque de acciones cae solo a la segunda línea, queda a la derecha. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
        <div className="text-sm text-muted">Contactos que matchean:</div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{count === null ? "…" : count.toLocaleString("es-AR")}</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {msg && <span className="text-sm text-muted">{msg}</span>}
          <Button variant="primary" onClick={guardar} disabled={saving || soloLectura} title={soloLectura ? `Tu usuario es de solo lectura.` : undefined}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
