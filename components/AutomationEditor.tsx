"use client";

import { useState, useTransition } from "react";
import type { Bloque, ContenidoCampania } from "@/lib/email/render";
import { BloquesEditor } from "@/components/BloquesEditor";
import type { Tema } from "@/lib/email/tema";
import { guardarAutomation, enviarPruebaAutomation, toggleAutomation } from "@/app/(app)/automations/actions";
import { Button } from "@/components/ui/Button";
import { usePermisos } from "@/components/PermisosProvider";
import { Pause, Play } from "lucide-react";

const input = "rounded-lg border border-border-strong bg-background text-foreground placeholder:text-subtle px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30";

export function AutomationEditor({
  id,
  nombreCuenta,
  triggerLabel,
  estadoInicial,
  emailPrueba,
  initial,
  temaMarca,
}: {
  id: string;
  nombreCuenta: string;
  triggerLabel: string;
  estadoInicial: string;
  /** Mail de quien está mirando: la prueba sale a su casilla, no a una fija. */
  emailPrueba: string;
  initial: { nombre: string; asunto: string; preheader: string; esperaHoras: number; capDias: number; contenido: ContenidoCampania };
  /** Tema por defecto de la marca. La automation lo pisa campo por campo. */
  temaMarca?: Tema | null;
}) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [esperaHoras, setEsperaHoras] = useState(initial.esperaHoras);
  const [capDias, setCapDias] = useState(initial.capDias);
  const [bloques, setBloques] = useState<Bloque[]>(initial.contenido?.bloques ?? []);
  const [tema, setTema] = useState<Tema | undefined>(initial.contenido?.tema);
  const [estado, setEstado] = useState(estadoInicial);
  const [pruebaEmail, setPruebaEmail] = useState(emailPrueba);
  const { puede, motivo, soloLectura } = usePermisos();
  // Encender manda mails que salen solos: eso es "enviar". Pausar no.
  const puedeActivar = puede("enviar");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();
  const [toggling, startToggle] = useTransition();

  // El contenido ENTERO, no `{ bloques, tema }`: enumerar los campos a mano
  // hacía que la versión del esquema y los estilos de documento se perdieran en
  // cada guardado, y el mail salía distinto de lo que mostraba el editor.
  const contenido = (): ContenidoCampania => ({ ...initial.contenido, bloques, tema });
  const payload = () => ({ id, nombre, asunto, preheader, esperaHoras, capDias, contenido: contenido() });

  const guardar = () => startSave(async () => { await guardarAutomation(payload()); setMsg("Guardado ✓"); setTimeout(() => setMsg(null), 2000); });
  const prueba = () => startSend(async () => { await guardarAutomation(payload()); const r = await enviarPruebaAutomation(id, pruebaEmail); setMsg(r.ok ? `Prueba enviada ✓` : `Error: ${r.error}`); setTimeout(() => setMsg(null), 4000); });
  const toggle = () => startToggle(async () => { await guardarAutomation(payload()); const r = await toggleAutomation(id); if (r.ok && r.estado) setEstado(r.estado); });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
        <div className="text-sm text-foreground">
          <span className="text-muted">Disparador:</span> <b>{triggerLabel}</b>
        </div>
        <label className="flex items-center gap-1 text-sm text-foreground">
          <span className="text-muted">esperar</span>
          <input type="number" className={`${input} w-16`} value={esperaHoras} onChange={(e) => setEsperaHoras(Number(e.target.value))} />
          <span className="text-muted">horas</span>
        </label>
        <label className="flex items-center gap-1 text-sm text-foreground">
          <span className="text-muted">no repetir por</span>
          <input type="number" className={`${input} w-16`} value={capDias} onChange={(e) => setCapDias(Number(e.target.value))} />
          <span className="text-muted">días</span>
        </label>
        <Button
          variant={estado === "ACTIVO" ? "secondary" : "primary"}
          onClick={toggle}
          disabled={toggling || soloLectura || (estado !== "ACTIVO" && !puedeActivar)}
          title={estado !== "ACTIVO" && !puedeActivar ? motivo("enviar") : undefined}
          className="ml-auto"
        >
          {estado === "ACTIVO"
            ? <><Pause className="mr-1.5 h-4 w-4" aria-hidden /> Pausar</>
            : <><Play className="mr-1.5 h-4 w-4" aria-hidden /> Activar</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-sm">
          <span className="text-muted">Nombre</span>
          <input className={`${input} w-full`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted">Asunto</span>
          <input className={`${input} w-full`} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted">Preheader</span>
        <input className={`${input} w-full`} value={preheader} onChange={(e) => setPreheader(e.target.value)} />
      </label>

      <BloquesEditor
        bloques={bloques}
        onChange={setBloques}
        nombreCuenta={nombreCuenta}
        preheader={preheader}
        tema={tema}
        onTemaChange={setTema}
        temaMarca={temaMarca}
        base={initial.contenido}
      />

      {soloLectura ? (
        <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-muted">
          Estás viendo esta automation en modo lectura.
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <Button variant="primary" onClick={guardar} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <input className={`${input} max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} />
        <Button variant="accent" onClick={prueba} disabled={sending}>
          {sending ? "Enviando…" : "Enviar prueba"}
        </Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      )}
    </div>
  );
}
