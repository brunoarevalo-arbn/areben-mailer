"use client";

import { useMemo, useState, useTransition } from "react";
import type { ContenidoCampania } from "@/lib/email/render";
import { EditorMail } from "@/components/editor/EditorMail";
import { useHistorial } from "@/components/editor/useHistorial";
import { AvisoContraste } from "@/components/AvisoContraste";
import { preguntaAntesDeMandar, revisarContraste } from "@/lib/email/revisar";
import type { Marca } from "@/lib/marca";
import { guardarAutomation, enviarPruebaAutomation, toggleAutomation } from "@/app/(app)/automations/actions";
import { Button } from "@/components/ui/Button";
import { BarraAcciones } from "@/components/ui/BarraAcciones";
import { usePermisos } from "@/components/PermisosProvider";
import { Pause, Play } from "lucide-react";
import { campoBase } from "@/lib/ui";


export function AutomationEditor({
  id,
  marca,
  triggerLabel,
  estadoInicial,
  emailPrueba,
  initial,
}: {
  id: string;
  /** Nombre, logo, sitio, pie y tema de la marca (`marcaDe(cuenta)`). */
  marca: Marca;
  triggerLabel: string;
  estadoInicial: string;
  /** Mail de quien está mirando: la prueba sale a su casilla, no a una fija. */
  emailPrueba: string;
  initial: { nombre: string; asunto: string; preheader: string; esperaHoras: number; capDias: number; contenido: ContenidoCampania };
}) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [esperaHoras, setEsperaHoras] = useState(initial.esperaHoras);
  const [capDias, setCapDias] = useState(initial.capDias);
  const [contenido, setContenido, historial] = useHistorial<ContenidoCampania>(initial.contenido);
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
  const payload = () => ({ id, nombre, asunto, preheader, esperaHoras, capDias, contenido });

  const guardar = () => startSave(async () => { await guardarAutomation(payload()); setMsg("Guardado ✓"); setTimeout(() => setMsg(null), 2000); });
  const prueba = () => startSend(async () => { await guardarAutomation(payload()); const r = await enviarPruebaAutomation(id, pruebaEmail); setMsg(r.ok ? `Prueba enviada ✓` : `Error: ${r.error}`); setTimeout(() => setMsg(null), 4000); });
  // 🔴 El resultado del toggle SE MIRA. Antes se descartaba entero, así que
  // "no podés encender: la marca no tiene remitente" no llegaba a la pantalla y
  // el botón parecía no hacer nada. El `aviso` es la otra mitad: la automation
  // quedó activa pero Tiendanube rechazó su webhook, o sea que no se va a
  // disparar sola. Ninguno de los dos se auto-oculta — un mensaje que se borra
  // solo a los 4 segundos no sirve para algo que hay que ir a resolver.
  /**
   * Lo que no se lee en este mail. Igual que en una campaña, pero el momento es
   * otro: acá no hay botón "Enviar" — **el envío empieza al ACTIVAR**, y a
   * partir de ahí sale solo, sin que nadie vuelva a mirar la pantalla.
   */
  const hallazgos = useMemo(() => revisarContraste(contenido, marca), [contenido, marca]);

  const toggle = () => startToggle(async () => {
    // ⚠️ **Sólo al encender.** Pausar es la acción segura y no se frena por
    // nada: ante un problema hay que poder apagar sin contestar preguntas.
    if (estado !== "ACTIVO") {
      const aviso = preguntaAntesDeMandar(hallazgos);
      if (aviso && !confirm(`${aviso}\n\n¿Activar igual? A partir de acá el mail sale solo.`)) return;
    }
    await guardarAutomation(payload());
    const r = await toggleAutomation(id);
    if (!r.ok) { setMsg(`Error: ${r.error ?? "no se pudo cambiar el estado"}`); return; }
    if (r.estado) setEstado(r.estado);
    setMsg(r.aviso ? `⚠️ ${r.aviso}` : null);
  });

  return (
    // `data-editor` levanta el cap de 1152px del layout (ver el `has-[]` de
    // `app/(app)/layout.tsx`): en el editor el ancho ES la herramienta.
    <div data-editor className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
        <div className="text-sm text-foreground">
          <span className="text-muted">Disparador:</span> <b>{triggerLabel}</b>
        </div>
        <label className="flex items-center gap-1 text-sm text-foreground">
          <span className="text-muted">esperar</span>
          <input type="number" className={`${campoBase} w-16`} value={esperaHoras} onChange={(e) => setEsperaHoras(Number(e.target.value))} />
          <span className="text-muted">horas</span>
        </label>
        <label className="flex items-center gap-1 text-sm text-foreground">
          <span className="text-muted">no repetir por</span>
          <input type="number" className={`${campoBase} w-16`} value={capDias} onChange={(e) => setCapDias(Number(e.target.value))} />
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
        {/* En su propio renglón de la barra, al lado del botón que la enciende:
            una automation activa manda sola y nadie vuelve a esta pantalla. */}
        {hallazgos.length > 0 && (
          <div className="w-full">
            <AvisoContraste hallazgos={hallazgos} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-sm">
          <span className="text-muted">Nombre</span>
          <input className={`${campoBase} w-full`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-muted">Asunto</span>
          <input className={`${campoBase} w-full`} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-muted">Preheader</span>
        <input className={`${campoBase} w-full`} value={preheader} onChange={(e) => setPreheader(e.target.value)} />
      </label>

      <EditorMail
        contenido={contenido}
        onChange={setContenido}
        historial={historial}
        marca={marca}
        preheader={preheader}
        ayudaTema="Solo para esta automation. Sin tocar nada, usa el de la marca."
        soloLectura={soloLectura}
      />

      {soloLectura ? (
        <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-muted">
          Estás viendo esta automation en modo lectura.
        </div>
      ) : (
      <BarraAcciones onGuardar={guardar} guardando={saving} mensaje={msg} ancho="amplio">
        <input className={`${campoBase} max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} />
        <Button variant="accent" onClick={prueba} disabled={sending}>
          {sending ? "Enviando…" : "Enviar prueba"}
        </Button>
      </BarraAcciones>
      )}
    </div>
  );
}
