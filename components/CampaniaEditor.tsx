"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renderEmailHtml, type ContenidoCampania } from "@/lib/email/render";
import {
  guardarCampania,
  enviarPrueba,
  enviarCampania,
  guardarComoPlantilla,
  promoverGanador,
} from "@/app/(app)/campanias/actions";
import { BloquesList } from "@/components/BloquesList";
import { TemaSelector } from "@/components/TemaSelector";
import type { Tema } from "@/lib/email/tema";
import { Button } from "@/components/ui/Button";
import { usePermisos } from "@/components/PermisosProvider";
import { AISoonButton } from "@/components/ui/AISoonButton";
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

interface AbInfo {
  ganador: string | null;
  testPct: number;
  a: { enviados: number; aperturas: number };
  b: { enviados: number; aperturas: number };
  holdout: number;
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
    asuntoB: string;
    abTestPct: number | null;
  };
  listas: Lista[];
  segmentos: Segmento[];
  emailPrueba: string;
  estado: string;
  abInfo?: AbInfo;
  /** Tema por defecto de la marca. La campaña lo pisa campo por campo. */
  temaMarca?: Tema | null;
}

const PCT_OPCIONES = [10, 20, 30, 50];
const tasa = (ap: number, env: number) => (env ? Math.round((ap / env) * 100) : 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CampaniaEditor({ id, nombreCuenta, initial, listas, segmentos, emailPrueba, estado, abInfo, temaMarca }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [asuntoB, setAsuntoB] = useState(initial.asuntoB);
  const [abActivo, setAbActivo] = useState(initial.abTestPct != null);
  const [abPct, setAbPct] = useState(initial.abTestPct ?? 20);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [destino, setDestino] = useState(initial.destino ?? "");
  const [bloques, setBloques] = useState(initial.contenido?.bloques ?? []);
  const [tema, setTema] = useState<Tema | undefined>(initial.contenido?.tema);
  const [pruebaEmail, setPruebaEmail] = useState(emailPrueba);
  const { puede, motivo, soloLectura } = usePermisos();
  const puedeEnviar = puede("enviar");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  /**
   * El contenido ENTERO, con lo que el editor edita pisado encima.
   *
   * Escribir `{ bloques, tema }` a mano perdía en cada guardado todo lo que el
   * editor todavía no muestra —la versión del esquema y los estilos de
   * documento— y el mail salía distinto de lo que se veía en pantalla. Es el
   * mismo bug que ya se cerró del lado del envío de automations.
   */
  const contenido = (): ContenidoCampania => ({ ...initial.contenido, bloques, tema });

  const previewHtml = renderEmailHtml(
    contenido(),
    { preheader, unsubscribeUrl: "#", nombreCuenta, muestraCarrito: true, temaMarca },
  );

  const campData = () => ({
    id,
    nombre,
    asunto,
    preheader,
    destino,
    contenido: contenido(),
    asuntoB: abActivo ? asuntoB : "",
    abTestPct: abActivo ? abPct : null,
  });

  const guardar = () =>
    startSave(async () => {
      await guardarCampania(campData());
      setMsg("Guardado ✓");
      setTimeout(() => setMsg(null), 2000);
    });

  const prueba = () =>
    startSend(async () => {
      await guardarCampania(campData());
      const r = await enviarPrueba(id, pruebaEmail);
      setMsg(r.ok ? `Prueba enviada a ${pruebaEmail} ✓` : `Error: ${r.error}`);
      setTimeout(() => setMsg(null), 5000);
    });

  const [enviado, setEnviado] = useState(estado === "ENVIADA" || estado === "ENVIANDO");
  const [progreso, setProgreso] = useState<string | null>(null);
  const [promoviendo, setPromoviendo] = useState(false);

  // El envío lo maneja la cola del servidor: acá solo se mira el progreso, así
  // que cerrar la pestaña ya no corta nada.
  const seguirProgreso = async (total: number, prefix: string) => {
    setProgreso(`Encolados ${total} envíos… el envío sigue aunque cierres esta página.`);
    for (let i = 0; i < 100000; i++) {
      await sleep(2000);
      const res = await fetch(`/api/campanias/${id}/progreso`);
      if (!res.ok) continue;
      const d = await res.json();
      const detalle = d.fallidos ? ` · fallidos ${d.fallidos}` : "";
      if (d.encolados === 0) {
        setProgreso(`✅ ${prefix} (${d.enviados}/${d.total})${detalle}`);
        break;
      }
      setProgreso(`${prefix} ${d.enviados}/${d.total} · restantes ${d.encolados}${detalle}${d.activo ? "" : " · esperando al worker…"}`);
    }
  };

  const enviarTodo = async () => {
    if (!destino) { setMsg("Elegí un destino primero"); return; }
    if (abActivo && !asuntoB.trim()) { setMsg("Completá el asunto B"); return; }
    const q = abActivo
      ? `¿Enviar el test A/B (asunto A y B) al ${abPct}% de la lista?`
      : "¿Enviar esta campaña a toda la lista (contactos que aceptan marketing)?";
    if (!confirm(q)) return;
    setEnviado(true);
    await guardarCampania(campData());
    const r = await enviarCampania(id);
    if (!r.ok) { setProgreso(`Error: ${r.error}`); setEnviado(false); return; }
    // En ensayo el destino real fue mucho más chico que la lista: decirlo, o el
    // "Enviados 4/4" se lee como si la campaña hubiera salido entera.
    if (r.modo === "ensayo") setMsg(`Modo ensayo: salió a ${r.total} casilla${r.total === 1 ? "" : "s"} habilitada${r.total === 1 ? "" : "s"}; se omitieron ${r.omitidos}.`);
    await seguirProgreso(r.total ?? 0, abActivo ? "Test enviado" : "Enviados");
    router.refresh();
  };

  const mandarGanador = async (letra: "A" | "B") => {
    if (!confirm(`¿Mandar el asunto ${letra} al resto de la lista (~${abInfo?.holdout ?? 0} contactos)?`)) return;
    setPromoviendo(true);
    const r = await promoverGanador(id, letra);
    if (!r.ok) { setProgreso(`Error: ${r.error}`); setPromoviendo(false); return; }
    await seguirProgreso(r.total ?? 0, `Ganador ${letra} enviado`);
    router.refresh();
  };

  // Fases de A/B (según lo que viene del server).
  const testEnviado = !!abInfo && abInfo.a.enviados + abInfo.b.enviados > 0;
  const esperandoGanador = testEnviado && !abInfo!.ganador;
  const ganadorResuelto = !!abInfo?.ganador;
  const mejorEsB = abInfo ? tasa(abInfo.b.aperturas, abInfo.b.enviados) > tasa(abInfo.a.aperturas, abInfo.a.enviados) : false;

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
            <span className="flex items-center justify-between gap-2 text-muted">
              <span className="flex items-center gap-2">
                Asunto{abActivo ? " A" : ""}
                <button
                  type="button"
                  onClick={() => setAbActivo((v) => !v)}
                  disabled={testEnviado || ganadorResuelto}
                  className={`rounded-md px-1.5 py-0.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                    abActivo ? "bg-accent-subtle text-accent-subtle-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {abActivo ? "A/B activo" : "+ Probar 2 asuntos"}
                </button>
              </span>
              <AISoonButton label="Sugerir asunto" />
            </span>
            <input className={inputClass} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del email" />
          </label>

          {abActivo && (
            <>
              <label className="block text-sm">
                <span className="text-muted">Asunto B</span>
                <input
                  className={inputClass}
                  value={asuntoB}
                  onChange={(e) => setAsuntoB(e.target.value)}
                  placeholder="Segundo asunto a probar"
                  disabled={testEnviado || ganadorResuelto}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Muestra del test</span>
                <select
                  className={inputClass}
                  value={abPct}
                  onChange={(e) => setAbPct(Number(e.target.value))}
                  disabled={testEnviado || ganadorResuelto}
                >
                  {PCT_OPCIONES.map((p) => (
                    <option key={p} value={p}>
                      {p}% de la lista (mitad A, mitad B)
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-subtle">
                  Se manda A y B a esa muestra; el resto espera a que elijas el ganador.
                </span>
              </label>
            </>
          )}

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
        <BloquesList bloques={bloques} onChange={setBloques} nombreCuenta={nombreCuenta} />
        <TemaSelector
          tema={tema}
          onChange={setTema}
          temaMarca={temaMarca}
          ayuda="Solo para esta campaña. Sin tocar nada, usa el de la marca."
        />

        {/* Acciones */}
        {soloLectura ? (
          <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-muted">
            Estás viendo esta campaña en modo lectura.
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <Button variant="primary" onClick={guardar} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const n = prompt("Nombre de la plantilla:", nombre);
              if (n === null) return;
              // Con el tema adentro: una plantilla guardada sin él se veía de
              // un color en la campaña y de otro al reusarla.
              await guardarComoPlantilla(n, contenido());
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
        )}

        {/* Panel de resultados A/B — elegir ganador */}
        {esperandoGanador && (
          <div className="space-y-3 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
            <div className="text-sm font-medium text-accent-subtle-foreground">Resultado del test A/B</div>
            <p className="text-xs text-muted">
              Elegí el asunto que mejor rindió y mandalo al resto de la lista (~{abInfo!.holdout.toLocaleString("es-AR")} contactos).
              Las aperturas se van cargando con el tiempo — recargá para ver el dato actualizado.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((v) => {
                const d = v === "A" ? abInfo!.a : abInfo!.b;
                const t = tasa(d.aperturas, d.enviados);
                const esMejor = v === "A" ? !mejorEsB : mejorEsB;
                return (
                  <div key={v} className="space-y-2 rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Asunto {v}</span>
                      {esMejor && d.enviados > 0 && (
                        <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-subtle-foreground">
                          mejor
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted" title={v === "A" ? asunto : asuntoB}>
                      {(v === "A" ? asunto : asuntoB) || "—"}
                    </div>
                    <div className="text-2xl font-semibold tabular-nums text-foreground">{t}%</div>
                    <div className="text-xs text-subtle">
                      {d.aperturas.toLocaleString("es-AR")} / {d.enviados.toLocaleString("es-AR")} aperturas
                    </div>
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => mandarGanador(v)}
                      disabled={promoviendo || !puedeEnviar}
                      title={puedeEnviar ? undefined : motivo("enviar")}
                      className="w-full"
                    >
                      Mandar {v} al resto
                    </Button>
                  </div>
                );
              })}
            </div>
            {progreso && <div className="text-sm text-foreground">{progreso}</div>}
          </div>
        )}

        {/* Ganador ya promovido */}
        {ganadorResuelto && (
          <div className="space-y-2 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
            <div className="text-sm font-medium text-accent-subtle-foreground">
              Ganador: Asunto {abInfo!.ganador} —{" "}
              {estado === "ENVIADA" ? "enviado al resto de la lista" : "enviando al resto…"}
            </div>
            {progreso && <div className="text-sm text-foreground">{progreso}</div>}
          </div>
        )}

        {/* Envío inicial (o test A/B) — antes de mandar */}
        {!testEnviado && !ganadorResuelto && (
          <div className="space-y-2 rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4">
            <div className="text-sm font-medium text-accent-subtle-foreground">
              {abActivo ? "Enviar test A/B" : "Enviar a la lista"}
            </div>
            <p className="text-xs text-muted">
              {!puedeEnviar
                ? "La campaña queda lista. El envío a la lista lo dispara un administrador."
                : abActivo
                  ? `Se manda el asunto A y B al ${abPct}% de la lista. Después elegís el ganador y se manda al resto.`
                  : "Se envía solo a los contactos de la lista que aceptan marketing y están activos."}
            </p>
            <Button
              variant="accent"
              onClick={enviarTodo}
              disabled={enviado || !puedeEnviar}
              title={puedeEnviar ? undefined : motivo("enviar")}
            >
              {enviado ? "Enviada / en curso" : abActivo ? "Enviar test A/B" : "Enviar a la lista"}
            </Button>
            {progreso && <div className="text-sm text-foreground">{progreso}</div>}
          </div>
        )}
      </div>

      {/* Columna preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-muted">Vista previa</div>
        <iframe title="preview" sandbox="" srcDoc={previewHtml} className="h-[70vh] w-full rounded-xl border border-border bg-white" />
      </div>
    </div>
  );
}
