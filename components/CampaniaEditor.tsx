"use client";

import { useState, useTransition } from "react";
import { renderEmailHtml, type Bloque, type ContenidoCampania } from "@/lib/email/render";
import { guardarCampania, enviarPrueba, enviarCampania, guardarComoPlantilla } from "@/app/(app)/campanias/actions";
import { ProductosBlock } from "@/components/ProductosBlock";
import { Button } from "@/components/ui/Button";
import { ChevronUp, ChevronDown, X } from "lucide-react";

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
    case "columnas": return { tipo, izq: { imagen: "", url: "" }, der: { imagen: "", url: "" } };
    case "video": return { tipo, imagen: "", url: "" };
    case "redes": return { tipo, links: [{ red: "Instagram", url: "" }] };
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

  const input = "w-full rounded-lg border border-border-strong bg-background text-foreground placeholder:text-subtle px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Columna editor */}
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <label className="block text-sm">
            <span className="text-muted">Nombre interno</span>
            <input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Asunto</span>
            <input className={input} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Asunto del email" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Preheader</span>
            <input className={input} value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto de vista previa" />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Destino</span>
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
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-sm font-medium text-foreground">Contenido</div>
          {bloques.map((b, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-subtle">{b.tipo}</span>
                <div className="flex gap-1 text-muted">
                  <button onClick={() => moveBloque(i, -1)} className="px-1 hover:text-foreground"><ChevronUp className="h-4 w-4" aria-hidden /></button>
                  <button onClick={() => moveBloque(i, 1)} className="px-1 hover:text-foreground"><ChevronDown className="h-4 w-4" aria-hidden /></button>
                  <button onClick={() => delBloque(i)} className="px-1 text-danger-foreground hover:opacity-70"><X className="h-4 w-4" aria-hidden /></button>
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
              {b.tipo === "columnas" && (
                <div className="grid grid-cols-2 gap-2">
                  {(["izq", "der"] as const).map((lado) => (
                    <div key={lado} className="space-y-1">
                      <input className={input} value={b[lado].imagen} placeholder="URL imagen" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], imagen: e.target.value } } as Partial<Bloque>)} />
                      <input className={input} value={b[lado].url} placeholder="Link" onChange={(e) => setBloque(i, { [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)} />
                    </div>
                  ))}
                </div>
              )}
              {b.tipo === "video" && (
                <div className="space-y-2">
                  <input className={input} value={b.imagen} placeholder="URL de la miniatura (imagen)" onChange={(e) => setBloque(i, { imagen: e.target.value })} />
                  <input className={input} value={b.url} placeholder="URL del video (YouTube, etc.)" onChange={(e) => setBloque(i, { url: e.target.value })} />
                </div>
              )}
              {b.tipo === "redes" && (
                <div className="space-y-2">
                  {b.links.map((l, k) => (
                    <div key={k} className="flex gap-2">
                      <input className={`${input} w-32`} value={l.red} placeholder="Red" onChange={(e) => setBloque(i, { links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })} />
                      <input className={`${input} flex-1`} value={l.url} placeholder="URL" onChange={(e) => setBloque(i, { links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })} />
                      <button onClick={() => setBloque(i, { links: b.links.filter((_, j) => j !== k) })} className="px-2 text-danger-foreground hover:opacity-70"><X className="h-4 w-4" aria-hidden /></button>
                    </div>
                  ))}
                  <button onClick={() => setBloque(i, { links: [...b.links, { red: "", url: "" }] })} className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted hover:bg-surface-muted">+ red</button>
                </div>
              )}
              {b.tipo === "divisor" && <div className="text-xs text-subtle">— línea divisoria —</div>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {(["titulo", "texto", "boton", "imagen", "productos", "columnas", "video", "redes", "divisor"] as const).map((t) => (
              <button key={t} onClick={() => addBloque(t)} className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted hover:bg-surface-muted">
                + {t}
              </button>
            ))}
          </div>
        </div>

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
          <input className={`${input} max-w-56`} value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} placeholder="email de prueba" />
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
