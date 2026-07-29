"use client";

import { useState, useTransition } from "react";
import { TemaSelector } from "@/components/TemaSelector";
import { Button } from "@/components/ui/Button";
import { renderEmailHtml, type Bloque } from "@/lib/email/render";
import type { Tema } from "@/lib/email/tema";
import { guardarTemaMarca } from "@/app/(app)/remitentes/actions";

// Aspecto por defecto de los mails de la marca.
//
// Vive en Remitentes porque es la otra mitad de la misma pregunta: esta página
// ya define CON QUÉ DIRECCIÓN sale el mail, y esto define CON QUÉ CARA.

/** Muestra para el preview: ejercita título, texto, botón, sección y divisor. */
const MUESTRA: Bloque[] = [
  { tipo: "titulo", texto: "Un título de ejemplo", align: "left" },
  {
    tipo: "texto",
    texto: "Así se va a ver el cuerpo de tus mails. Este párrafo está solo para que se note la tipografía y el color del texto.",
    align: "left",
  },
  { tipo: "boton", texto: "Un botón", url: "#", align: "left", full: false },
  { tipo: "divisor" },
  {
    tipo: "seccion",
    bg: "",
    titulo: "Una sección",
    texto: "Los bloques con fondo propio ajustan su texto para seguir siendo legibles.",
    botonTexto: "",
    botonUrl: "",
  },
];

export function TemaMarca({ inicial, nombreCuenta }: { inicial: Tema | undefined; nombreCuenta: string }) {
  const [tema, setTema] = useState<Tema | undefined>(inicial);
  const [guardando, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sucio = JSON.stringify(tema ?? {}) !== JSON.stringify(inicial ?? {});
  const previewHtml = renderEmailHtml(
    { bloques: MUESTRA, tema },
    { unsubscribeUrl: "#", nombreCuenta, preheader: "" },
  );

  const guardar = () =>
    start(async () => {
      const r = await guardarTemaMarca(tema ?? null);
      setMsg(r.ok ? "Guardado." : r.error);
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <TemaSelector
          tema={tema}
          onChange={(t) => {
            setTema(t);
            setMsg(null);
          }}
          titulo={`Diseño de los mails de ${nombreCuenta}`}
          ayuda="El punto de partida de todas las campañas y automations. Cada una puede cambiarlo después."
        />
        <div className="flex items-center gap-3">
          <Button onClick={guardar} disabled={!sucio || guardando}>
            {guardando ? "Guardando…" : "Guardar diseño"}
          </Button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-muted">Vista previa</div>
        <iframe
          title="Vista previa del diseño"
          sandbox=""
          srcDoc={previewHtml}
          className="h-[60vh] w-full rounded-xl border border-border"
        />
        <p className="mt-2 text-xs text-muted">
          Gmail y Outlook pueden aplicar su propio modo oscuro por encima de esto. Antes de usar un
          diseño oscuro en serio, mandate una prueba y miralo en el buzón.
        </p>
      </div>
    </div>
  );
}
