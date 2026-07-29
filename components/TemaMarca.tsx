"use client";

import { useState, useTransition } from "react";
import { TemaSelector } from "@/components/TemaSelector";
import { Button } from "@/components/ui/Button";
import { renderEmailHtml, type Bloque } from "@/lib/email/render";
import type { Tema } from "@/lib/email/tema";
import type { Marca } from "@/lib/marca";
import { guardarTemaMarca, traerMarcaDeTienda } from "@/app/(app)/remitentes/actions";

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

export function TemaMarca({
  inicial,
  marca: marcaInicial,
  conectada,
}: {
  inicial: Tema | undefined;
  marca: Marca;
  /** ¿La cuenta tiene tienda de Tiendanube vinculada? Sin eso no hay de dónde traer. */
  conectada: boolean;
}) {
  const [tema, setTema] = useState<Tema | undefined>(inicial);
  const [marca, setMarca] = useState<Marca>(marcaInicial);
  const [guardando, start] = useTransition();
  const [trayendo, startTraer] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgMarca, setMsgMarca] = useState<string | null>(null);

  const sucio = JSON.stringify(tema ?? {}) !== JSON.stringify(inicial ?? {});
  const previewHtml = renderEmailHtml(
    { bloques: MUESTRA, tema },
    {
      ...marca,
      // El tema guardado NO va de default acá: es justo lo que se está
      // editando. Si fuera también el default, sacarle un color en el selector
      // no se vería —lo taparía el que ya está en la base—.
      temaMarca: undefined,
      unsubscribeUrl: "#",
      preheader: "",
    },
  );

  const guardar = () =>
    start(async () => {
      const r = await guardarTemaMarca(tema ?? null);
      setMsg(r.ok ? "Guardado." : r.error);
    });

  const traer = () =>
    startTraer(async () => {
      const r = await traerMarcaDeTienda();
      if (!r.ok) return setMsgMarca(r.error ?? "No se pudo.");
      setMarca(r.marca);
      setMsgMarca(r.marca.logoCuenta ? "Listo: logo, sitio y datos de tu tienda." : "Listo, pero tu tienda no tiene logo cargado en Tiendanube.");
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        {/* La marca sale sola de Tiendanube: el comerciante no tiene que cargar
            su logo a mano para que el primer mail salga con su cara. */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">Marca de la tienda</div>
              <p className="mt-1 text-xs text-muted">
                El logo, el link y el idioma salen de Tiendanube. Los usan el encabezado y el pie de
                todos los mails.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={traer}
              disabled={!conectada || trayendo}
              title={conectada ? undefined : "Esta marca no está conectada a Tiendanube"}
            >
              {trayendo ? "Trayendo…" : "Traer de mi tienda"}
            </Button>
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <dt className="w-20 shrink-0 text-subtle">Logo</dt>
              <dd className="min-w-0 flex-1 text-muted">
                {marca.logoCuenta ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={marca.logoCuenta} alt="Logo de la tienda" className="h-8 w-auto max-w-40 object-contain" />
                ) : (
                  "— sin logo, se muestra el nombre"
                )}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-20 shrink-0 text-subtle">Sitio</dt>
              <dd className="min-w-0 flex-1 truncate text-muted">{marca.urlCuenta || "—"}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-20 shrink-0 text-subtle">Pie</dt>
              <dd className="min-w-0 flex-1 truncate text-muted">{marca.direccionPostal || "—"}</dd>
            </div>
          </dl>
          {msgMarca && <p className="mt-2 text-xs text-muted">{msgMarca}</p>}
        </div>

        <TemaSelector
          tema={tema}
          onChange={(t) => {
            setTema(t);
            setMsg(null);
          }}
          titulo={`Diseño de los mails de ${marca.nombreCuenta}`}
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
