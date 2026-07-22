"use client";

import { useState, useTransition } from "react";
import type { Bloque, ContenidoCampania } from "@/lib/email/render";
import { BloquesEditor } from "@/components/BloquesEditor";
import { guardarAutomation, enviarPruebaAutomation, toggleAutomation } from "@/app/automations/actions";

const input = "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function AutomationEditor({
  id,
  nombreCuenta,
  triggerLabel,
  estadoInicial,
  initial,
}: {
  id: string;
  nombreCuenta: string;
  triggerLabel: string;
  estadoInicial: string;
  initial: { nombre: string; asunto: string; preheader: string; esperaHoras: number; capDias: number; contenido: ContenidoCampania };
}) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [esperaHoras, setEsperaHoras] = useState(initial.esperaHoras);
  const [capDias, setCapDias] = useState(initial.capDias);
  const [bloques, setBloques] = useState<Bloque[]>(initial.contenido?.bloques ?? []);
  const [estado, setEstado] = useState(estadoInicial);
  const [pruebaEmail, setPruebaEmail] = useState("brunoarevalo@arebensrl.com");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();
  const [toggling, startToggle] = useTransition();

  const payload = () => ({ id, nombre, asunto, preheader, esperaHoras, capDias, contenido: { bloques } });

  const guardar = () => startSave(async () => { await guardarAutomation(payload()); setMsg("Guardado ✓"); setTimeout(() => setMsg(null), 2000); });
  const prueba = () => startSend(async () => { await guardarAutomation(payload()); const r = await enviarPruebaAutomation(id, pruebaEmail); setMsg(r.ok ? `Prueba enviada ✓` : `Error: ${r.error}`); setTimeout(() => setMsg(null), 4000); });
  const toggle = () => startToggle(async () => { await guardarAutomation(payload()); const r = await toggleAutomation(id); if (r.ok && r.estado) setEstado(r.estado); });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <div className="text-sm">
          <span className="text-neutral-500">Disparador:</span> <b>{triggerLabel}</b>
        </div>
        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-500">esperar</span>
          <input type="number" className={`${input} w-16`} value={esperaHoras} onChange={(e) => setEsperaHoras(Number(e.target.value))} />
          <span className="text-neutral-500">horas</span>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <span className="text-neutral-500">no repetir por</span>
          <input type="number" className={`${input} w-16`} value={capDias} onChange={(e) => setCapDias(Number(e.target.value))} />
          <span className="text-neutral-500">días</span>
        </label>
        <button onClick={toggle} disabled={toggling} className={`ml-auto rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${estado === "ACTIVO" ? "bg-neutral-500 hover:bg-neutral-600" : "bg-green-600 hover:bg-green-700"}`}>
          {estado === "ACTIVO" ? "⏸ Pausar" : "▶ Activar"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-sm">
          <span className="text-neutral-500">Nombre</span>
          <input className={`${input} w-full`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-neutral-500">Asunto</span>
          <input className={`${input} w-full`} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-neutral-500">Preheader</span>
        <input className={`${input} w-full`} value={preheader} onChange={(e) => setPreheader(e.target.value)} />
      </label>

      <BloquesEditor bloques={bloques} onChange={setBloques} nombreCuenta={nombreCuenta} preheader={preheader} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4">
        <button onClick={guardar} disabled={saving} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <input className={`${input} max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} />
        <button onClick={prueba} disabled={sending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
          {sending ? "Enviando…" : "Enviar prueba"}
        </button>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
      </div>
    </div>
  );
}
