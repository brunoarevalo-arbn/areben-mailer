"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ContenidoCampania } from "@/lib/email/render";
import {
  guardarCampania,
  enviarPrueba,
  enviarCampania,
  programarCampania,
  cancelarProgramacion,
  guardarComoPlantilla,
  promoverGanador,
} from "@/app/(app)/campanias/actions";
import { EditorMail } from "@/components/editor/EditorMail";
import { useHistorial } from "@/components/editor/useHistorial";
import type { Marca } from "@/lib/marca";
import { Button } from "@/components/ui/Button";
import { BarraAcciones } from "@/components/ui/BarraAcciones";
import { usePermisos } from "@/components/PermisosProvider";
import { AISoonButton } from "@/components/ui/AISoonButton";
import { Desplegable } from "@/components/ui/Desplegable";
import { inputClass, campoBase } from "@/lib/ui";
import { Badge } from "@/components/ui/Badge";
import { diaLocal, horaLocal } from "@/lib/fechas";

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
  /** Nombre, logo, sitio, pie y tema de la marca (`marcaDe(cuenta)`). */
  marca: Marca;
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
  /** ISO del instante programado, si la campaña está PROGRAMADA. */
  programadaAt?: string | null;
  abInfo?: AbInfo;
}

const PCT_OPCIONES = [10, 20, 30, 50];
/**
 * La hora que se ofrece de fábrica al programar.
 *
 * No es un número al azar: la curva de aperturas del T01 de Zattia (2-ago-2026)
 * puso 74 de 112 aperturas entre las 20 y las 00. Sale a las 19 para estar
 * arriba en la bandeja cuando llega ese pico.
 */
const HORA_SUGERIDA = "19:00";
const tasa = (ap: number, env: number) => (env ? Math.round((ap / env) * 100) : 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CampaniaEditor({ id, marca, initial, listas, segmentos, emailPrueba, estado, programadaAt, abInfo }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [asuntoB, setAsuntoB] = useState(initial.asuntoB);
  const [abActivo, setAbActivo] = useState(initial.abTestPct != null);
  const [abPct, setAbPct] = useState(initial.abTestPct ?? 20);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [destino, setDestino] = useState(initial.destino ?? "");
  /**
   * El documento entero, con deshacer.
   *
   * Antes acá vivían `bloques` y `tema` sueltos y el guardado los volvía a
   * armar: eso perdía en cada guardado todo lo que el editor todavía no muestra
   * —la versión del esquema, los estilos de documento— y el mail salía distinto
   * de lo que se veía en pantalla. Es el mismo bug que ya se cerró del lado del
   * envío de automations. Con el contenido como una sola pieza no se puede
   * repetir.
   */
  const [contenido, setContenido, historial] = useHistorial<ContenidoCampania>(initial.contenido);
  const [pruebaEmail, setPruebaEmail] = useState(emailPrueba);
  const { puede, motivo, soloLectura } = usePermisos();
  const puedeEnviar = puede("enviar");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  const campData = () => ({
    id,
    nombre,
    asunto,
    preheader,
    destino,
    contenido,
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

  // ⚠️ `PROGRAMADA` NO entra acá: una campaña programada no está enviada ni en
  // curso — todavía se puede editar, cancelar o mandar antes de hora.
  const [enviado, setEnviado] = useState(estado === "ENVIADA" || estado === "ENVIANDO");
  const [progreso, setProgreso] = useState<string | null>(null);
  const [promoviendo, setPromoviendo] = useState(false);

  /**
   * La programación, ya escrita en palabras ("lunes 3 de agosto, 19:00") o null.
   *
   * 🔑 El texto sale de `horaLocal`, que resuelve en la zona del **negocio**: el
   * panel dice la misma hora se abra desde donde se abra, y el servidor y el
   * cliente pintan el mismo string (si no, sería un mismatch de hidratación).
   */
  const [programada, setProgramada] = useState<string | null>(
    programadaAt ? horaLocal(new Date(programadaAt)) : null,
  );
  // Mismo motivo para el día de fábrica: `diaLocal` y no `toISOString()`, que a
  // partir de las 21:00 propondría mañana.
  const [dia, setDia] = useState(() => diaLocal(new Date()));
  const [hora, setHora] = useState(HORA_SUGERIDA);
  const [programando, setProgramando] = useState(false);

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

  /**
   * Deja la campaña agendada. Guarda primero: lo que se programa tiene que ser
   * lo que está en pantalla, no lo último que alguien guardó a mano.
   *
   * Las guardas de destino y asunto B se repiten acá y en el servidor a
   * propósito: acá para avisar sin viaje, allá porque es la que vale.
   */
  const programar = async () => {
    if (!destino) { setMsg("Elegí un destino primero"); return; }
    if (abActivo && !asuntoB.trim()) { setMsg("Completá el asunto B"); return; }
    setProgramando(true);
    await guardarCampania(campData());
    const r = await programarCampania(id, dia, hora);
    setProgramando(false);
    if (!r.ok) { setProgreso(`Error: ${r.error}`); return; }
    setProgreso(null);
    setProgramada(r.texto);
    router.refresh();
  };

  const desprogramar = async () => {
    setProgramando(true);
    const r = await cancelarProgramacion(id);
    setProgramando(false);
    if (!r.ok) { setProgreso(`Error: ${r.error}`); return; }
    setProgramada(null);
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

  /**
   * 🔴 Congelado en el MONTAJE, no calculado en cada render.
   *
   * `Desplegable` pasa esto al `open` del `<details>`, y React reasigna el
   * atributo cuando el valor cambia: con `!asunto` derecho, la caja se cerraría
   * de golpe al escribir la primera letra del asunto. Acá lo único que decide es
   * cómo NACE la pantalla — abierta si falta algo para poder enviar.
   */
  const [ajustesAbiertos] = useState(() => !initial.asunto || !initial.destino);

  const nombreDestino = destino.startsWith("lista:")
    ? listas.find((l) => `lista:${l.id}` === destino)?.nombre
    : destino.startsWith("seg:")
      ? segmentos.find((s) => `seg:${s.id}` === destino)?.nombre
      : null;

  // Plegar el asunto no puede convertirse en mandar una campaña sin asunto: lo
  // que falta se ve en rojo desde afuera, sin abrir nada.
  const falta = (t: string) => <span className="font-medium text-danger-foreground">{t}</span>;
  const resumenEnvio = (
    <>
      {asunto ? `«${asunto}»` : falta("sin asunto")}
      {" · "}
      {nombreDestino ?? falta("sin destino")}
      {abActivo && " · A/B"}
    </>
  );

  // Fases de A/B (según lo que viene del server).
  const testEnviado = !!abInfo && abInfo.a.enviados + abInfo.b.enviados > 0;
  const esperandoGanador = testEnviado && !abInfo!.ganador;
  const ganadorResuelto = !!abInfo?.ganador;
  const mejorEsB = abInfo ? tasa(abInfo.b.aperturas, abInfo.b.enviados) > tasa(abInfo.a.aperturas, abInfo.a.enviados) : false;

  return (
    <div className="space-y-4 pb-24">
      {/* Los datos de envío arriba, a lo ancho: el editor de abajo necesita las
          tres columnas enteras y antes estaba metido en media pantalla.

          🔑 Y PLEGADOS: son cinco campos que se escriben una vez y después no se
          vuelven a mirar, ocupando el arriba de la pantalla mientras se diseña el
          mail —que es donde se pasa el 95% del tiempo—. El resumen del summary es
          la contracara: cerrada, la caja igual dice el asunto y a quién va. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Desplegable
          titulo="Datos del envío"
          resumen={resumenEnvio}
          abiertoDeFabrica={ajustesAbiertos}
          className="rounded-xl border border-border bg-surface p-4 shadow-sm"
        >
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
        </Desplegable>
      </div>

      <EditorMail
        contenido={contenido}
        onChange={setContenido}
        historial={historial}
        marca={marca}
        preheader={preheader}
        ayudaTema="Solo para esta campaña. Sin tocar nada, usa el de la marca."
        soloLectura={soloLectura}
      />

      <div className="space-y-4">
        {/* Acciones */}
        {soloLectura ? (
          <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm text-muted">
            Estás viendo esta campaña en modo lectura.
          </div>
        ) : (
        // El Guardar y sus vecinos viven en la barra fija de abajo; esto es solo
        // el hueco donde estaban, que ya no dibuja nada.
        <BarraAcciones onGuardar={guardar} guardando={saving} mensaje={msg}>
          <Button
            variant="secondary"
            onClick={async () => {
              const n = prompt("Nombre de la plantilla:", nombre);
              if (n === null) return;
              // Con el tema adentro: una plantilla guardada sin él se veía de
              // un color en la campaña y de otro al reusarla.
              await guardarComoPlantilla(n, contenido);
              setMsg("Plantilla guardada ✓");
              setTimeout(() => setMsg(null), 2000);
            }}
          >
            Guardar como plantilla
          </Button>
          {/* En celular el campo se lleva la línea entera: con `max-w-56` fijo
              quedaba a media línea y "Enviar prueba" arrancaba a su lado, medio
              cortado. Arriba de `sm` vuelve a los 224px de siempre. */}
          <input className={`${inputClass} sm:max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} placeholder="email de prueba" />
          <Button variant="accent" onClick={prueba} disabled={sending}>
            {sending ? "Enviando…" : "Enviar prueba"}
          </Button>
        </BarraAcciones>
        )}

        {/* Panel de resultados A/B — elegir ganador.

            Se pliega, pero **nace abierto**: hay una decisión pendiente y el
            holdout está esperando. Plegarlo es para sacarlo del medio mientras se
            retoca el mail, no para esconder que falta elegir — por eso el resumen
            del summary lleva las dos tasas. */}
        {esperandoGanador && (
          <Desplegable
            titulo="Resultado del test A/B"
            resumen={`A ${tasa(abInfo!.a.aperturas, abInfo!.a.enviados)}% · B ${tasa(abInfo!.b.aperturas, abInfo!.b.enviados)}%`}
            abiertoDeFabrica
            className="rounded-xl border border-accent-subtle-foreground/30 bg-accent-subtle p-4"
          >
            <p className="text-xs text-muted">
              Elegí el asunto que mejor rindió y mandalo al resto de la lista (~{abInfo!.holdout.toLocaleString("es-AR")} contactos).
              Las aperturas se van cargando con el tiempo — recargá para ver el dato actualizado.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </Desplegable>
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
              {enviado
                ? "Enviada / en curso"
                : programada
                  ? "Enviar ahora"
                  : abActivo
                    ? "Enviar test A/B"
                    : "Enviar a la lista"}
            </Button>

            {/* Programar. Solo para quien puede enviar: programar ES enviar, más
                tarde. Y no se ofrece cuando la campaña ya salió. */}
            {puedeEnviar && !enviado && (
              programada ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
                  <Badge variant="amber">Programada</Badge>
                  <span className="text-sm text-foreground">para el {programada}</span>
                  <Button variant="secondary" size="sm" onClick={desprogramar} disabled={programando}>
                    {programando ? "…" : "Cancelar programación"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2 border-t border-accent-subtle-foreground/20 pt-3">
                  <label className="text-xs text-muted">
                    Día
                    <input
                      type="date"
                      className={`${campoBase} mt-1 block`}
                      value={dia}
                      min={diaLocal(new Date())}
                      onChange={(e) => setDia(e.target.value)}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Hora
                    <input
                      type="time"
                      className={`${campoBase} mt-1 block`}
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                    />
                  </label>
                  <Button variant="secondary" onClick={programar} disabled={programando}>
                    {programando ? "Programando…" : "Programar"}
                  </Button>
                  {/* La letra chica es honesta a propósito: el cron corre cada 15
                      minutos, así que prometer la hora exacta sería prometer algo
                      que el sistema no puede cumplir. */}
                  <p className="w-full text-xs text-subtle">
                    Sale a esa hora o hasta 15 minutos después. Si a esa hora algo lo impide, reintenta
                    durante 2 horas y después se cancela — nunca sale a una hora que no elegiste.
                  </p>
                </div>
              )
            )}
            {progreso && <div className="text-sm text-foreground">{progreso}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
