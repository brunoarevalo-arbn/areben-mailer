"use client";

import { useState, useTransition } from "react";
import { renderEmailHtml, type Bloque, type ContenidoCampania } from "@/lib/email/render";
import { guardarCampania, enviarPrueba, enviarCampania } from "@/app/campanias/actions";
import { ProductosBlock } from "@/components/ProductosBlock";

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

const nuevoBloque = (tipo: Bloque["tipo"]): Bloque => {
  switch (tipo) {
    case "titulo": return { tipo, texto: "Título" };
    case "texto": return { tipo, texto: "Escribí tu mensaje acá. Podés usar ${contacto.nombre}." };
    case "boton": return { tipo, texto: "Ver más", url: "https://bdiaccesorios.com.ar" };
    case "imagen": return { tipo, url: "", alt: "" };
    case "productos": return { tipo, items: [] };
    case "divisor": return { tipo };
  }
};

export function CampaniaEditor({ id, nombreCuenta, initial, listas, segmentos, emailPrueba, estado }: Props) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [asunto, setAsunto] = useState(initial.asunto);
  const [preheader, setPreheader] = useState(initial.preheader);
  const [destino, setDestino] = useState(initial.destino ?? "");
  const [bloques, setBloques] = useState<Bloque[]>(initial.contenido?.bloques ?? []);
  const [pruebaEmail, setPruebaEmail] = useState(emailPrueba);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [sending, startSend] = useTransition();

  const setBloque = (i: number, patch: Partial<Bloque>) =>
    setBloques((bs) => bs.map((b, j) => (j === i ? ({ ...b, ...patch } as Bloque) : b)));
  const addBloque = (tipo: Bloque["tipo"]) => setBloques((bs) => [...bs, nuevoBloque(tipo)]);
  const delBloque = (i: number) => setBloques((bs) => bs.filter((_, j) => j !== i));
  const moveBloque = (i: number, dir: -1 | 1) =>
    setBloques((bs) => {
      const j = i + dir;
      if (j < 0 || j >= bs.length) return bs;
      const copy = [...bs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

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

  const input = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Columna editor */}
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="block text-sm">
            <span className="text-neutral-500">Nombre interno</span>
            <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Asunto</span>
            <input className={input} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del email" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Preheader</span>
            <input className={input} value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto de vista previa" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-500">Destino</span>
            <select className={input} value={destino} onChange={(e) => setDestino(e.target.value)}>
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
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-medium text-neutral-700">Contenido</div>
          {bloques.map((b, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{b.tipo}</span>
                <div className="flex gap-1 text-xs text-neutral-500">
                  <button onClick={() => moveBloque(i, -1)} className="px-1 hover:text-neutral-900">↑</button>
                  <button onClick={() => moveBloque(i, 1)} className="px-1 hover:text-neutral-900">↓</button>
                  <button onClick={() => delBloque(i)} className="px-1 text-red-500 hover:text-red-700">✕</button>
                </div>
              </div>
              {(b.tipo === "titulo" || b.tipo === "texto") && (
                <textarea className={input} rows={b.tipo === "texto" ? 3 : 1} value={b.texto} onChange={(e) => setBloque(i, { texto: e.target.value })} />
              )}
              {b.tipo === "boton" && (
                <div className="space-y-2">
                  <input className={input} value={b.texto} placeholder="Texto del botón" onChange={(e) => setBloque(i, { texto: e.target.value })} />
                  <input className={input} value={b.url} placeholder="https://…" onChange={(e) => setBloque(i, { url: e.target.value })} />
                </div>
              )}
              {b.tipo === "imagen" && (
                <input className={input} value={b.url} placeholder="URL de la imagen (https://…)" onChange={(e) => setBloque(i, { url: e.target.value })} />
              )}
              {b.tipo === "productos" && (
                <ProductosBlock items={b.items} onChange={(items) => setBloque(i, { items })} />
              )}
              {b.tipo === "divisor" && <div className="text-xs text-neutral-400">— línea divisoria —</div>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {(["titulo", "texto", "boton", "imagen", "productos", "divisor"] as const).map((t) => (
              <button key={t} onClick={() => addBloque(t)} className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
                + {t}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4">
          <button onClick={guardar} disabled={saving} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <input className={`${input} max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} placeholder="email de prueba" />
          <button onClick={prueba} disabled={sending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
            {sending ? "Enviando…" : "Enviar prueba"}
          </button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>

        {/* Envío a la lista */}
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="text-sm font-medium text-neutral-700">Enviar a la lista</div>
          <p className="text-xs text-neutral-500">
            Se envía solo a los contactos de la lista que <b>aceptan marketing</b> y están activos.
          </p>
          <button
            onClick={enviarTodo}
            disabled={enviado}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {enviado ? "Enviada / en curso" : "Enviar a la lista"}
          </button>
          {progreso && <div className="text-sm text-neutral-700">{progreso}</div>}
        </div>
      </div>

      {/* Columna preview */}
      <div className="lg:sticky lg:top-6 h-fit">
        <div className="mb-2 text-sm text-neutral-500">Vista previa</div>
        <iframe title="preview" srcDoc={previewHtml} className="h-[70vh] w-full rounded-xl border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
