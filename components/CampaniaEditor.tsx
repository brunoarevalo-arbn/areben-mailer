"use client";

import { useState, useTransition } from "react";
import { renderEmailHtml, type ContenidoCampania } from "@/lib/email/render";
import { guardarCampania, enviarPrueba, enviarCampania, guardarComoPlantilla } from "@/app/(app)/campanias/actions";
import { BloquesList } from "@/components/BloquesList";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/lib/ui";

interface Lista {
  id: string;
  nombre: string;
  _count: { contactos: number };
}

interface Segmento {
  id: string;
  nombre: string;
}

interface Props {
  id: string;
  nombreCuenta: string;
  initial: {
    nombre: string;
    asunto: string;
    preheader: string;
    destino: string; // "lista:<id>" | "seg:<id>" | ""
    contenido: ContenidoCampania;
  };
  listas: Lista[];
  segmentos: Segmento[];
  emailPrueba: string;
  estado: string;
}

export function CampaniaEditor({ id, nombreCuenta, initial, listas, segmentos, emailPrueba, estado }: Props) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [destino, setDestino] = useState(initial.destino ?? "");
  const [bloques, setBloques] = useState(initial.contenido?.bloques ?? []);
  const [pruebaEmail, setPruebaEmail] = useState(emailPrueba);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  const previewHtml = renderEmailHtml({ bloques }, {
    preheader,
    unsubscribeUrl: "#",
    nombreCuenta,
  });

  const guardar = () =>
    startSave(async () => {
      await guardarCampania({ id, nombre, asunto, preheader, destino, contenido: { bloques } });
      setMsg("Guardado ✓");
      setTimeout(() => setMsg(null), 2000);
    });

  const prueba = () =>
    startSend(async () => {
      await guardarCampania({ id, nombre, asunto, preheader, destino, contenido: { bloques } });
      const r = await enviarPrueba(id, pruebaEmail);
      setMsg(r.ok ? `Prueba enviada a ${pruebaEmail} ✓` : `Error: ${r.error}`);
      setTimeout(() => setMsg(null), 5000);
    });

  const [enviado, setEnviado] = useState(estado === "ENVIADA" || estado === "ENVIANDO");
  const [progreso, setProgreso] = useState<string | null>(null);

  const enviarTodo = async () => {
    if (!destino) { setMsg("Elegí un destino primero"); return; }
    if (!confirm("¿Enviar esta campaña a toda la lista (contactos que aceptan marketing)?")) return;
    setEnviado(true);
    await guardarCampania({ id, nombre, asunto, preheader, destino, contenido: { bloques } });
    const r = await enviarCampania(id);
    if (!r.ok) { setProgreso(`Error: ${r.error}`); setEnviado(false); return; }
    let enviadosAcum = 0;
    const total = r.total ?? 0;
    setProgreso(`Encolados ${total} envíos…`);
    // Procesar lotes hasta terminar
    for (let i = 0; i < 100000; i++) {
      const res = await fetch(`/api/campanias/${id}/procesar`, { method: "POST" });
      const data = await res.json();
      enviadosAcum += data.enviados ?? 0;
      setProgreso(`Enviados ${enviadosAcum}/${total} · restantes ${data.restantes}${data.fallidos ? ` · fallidos ${data.fallidos}` : ""}`);
      if (data.restantes === 0) { setProgreso(`✅ Campaña enviada (${enviadosAcum}/${total})`); break; }
      if (data.throttled) await new Promise((r) => setTimeout(r, 1000));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Columna editor */}
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <label className="block text-sm">
            <span className="text-muted">Nombre interno</span>
            <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Asunto</span>
            <input className={inputClass} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del email" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Preheader</span>
            <input className={inputClass} value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto de vista previa" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Destino</span>
            <select className={inputClass} value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">— elegí lista o segmento —</option>
              <optgroup label="Listas">
                {listas.map((l) => (
                  <option key={l.id} value={`lista:${l.id}`}>
                    {l.nombre} ({l._count.contactos.toLocaleString("es-AR")})
                  </option>
                ))}
              </optgroup>
              {segmentos.length > 0 && (
                <optgroup label="Segmentos">
                  {segmentos.map((s) => (
                    <option key={s.id} value={`seg:${s.id}`}>🎯 {s.nombre}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        </div>

        {/* Bloques */}
        <BloquesList bloques={bloques} onChange={setBloques} />

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <Button variant="primary" onClick={guardar} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const n = prompt("Nombre de la plantilla:", nombre);
              if (n === null) return;
              await guardarComoPlantilla(n, { bloques });
              setMsg("Plantilla guardada ✓");
              setTimeout(() => setMsg(null), 2000);
            }}
          >
            Guardar como plantilla
          </Button>
          <input className={`${inputClass} max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} placeholder="email de prueba" />
          <Button variant="accent" onClick={prueba} disabled={sending}>
            {sending ? "Enviando…" : "Enviar prueba"}
          </Button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>

        {/* Envío a la lista */}
        <div className="space-y-2 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
          <div className="text-sm font-medium text-accent-subtle-foreground">Enviar a la lista</div>
          <p className="text-xs text-muted">
            Se envía solo a los contactos de la lista que <b>aceptan marketing</b> y están activos.
          </p>
          <Button variant="accent" onClick={enviarTodo} disabled={enviado}>
            {enviado ? "Enviada / en curso" : "Enviar a la lista"}
          </Button>
          {progreso && <div className="text-sm text-foreground">{progreso}</div>}
        </div>
      </div>

      {/* Columna preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-muted">Vista previa</div>
        <iframe title="preview" srcDoc={previewHtml} className="h-[70vh] w-full rounded-xl border border-border bg-white" />
      </div>
    </div>
  );
}
