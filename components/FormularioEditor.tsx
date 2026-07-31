"use client";

import { useState, useTransition } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { usePermisos } from "@/components/PermisosProvider";
import { Card } from "@/components/ui/Card";
import { guardarFormulario, eliminarFormulario } from "@/app/(app)/formularios/actions";

interface Lista {
  id: string;
  nombre: string;
}

interface Props {
  listas: Lista[];
  publicUrl: string;
  initial: {
    id: string;
    nombre: string;
    titulo: string;
    descripcion: string;
    botonTexto: string;
    exitoMensaje: string;
    pedirNombre: boolean;
    listaId: string;
    activo: boolean;
    submits: number;
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* noop */
        }
      }}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Copiado
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Copiar
        </>
      )}
    </Button>
  );
}

export function FormularioEditor({ listas, publicUrl, initial }: Props) {
  const [nombre, setNombre] = useState(initial.nombre);
  const [titulo, setTitulo] = useState(initial.titulo);
  const [descripcion, setDescripcion] = useState(initial.descripcion);
  const [botonTexto, setBotonTexto] = useState(initial.botonTexto);
  const [exitoMensaje, setExitoMensaje] = useState(initial.exitoMensaje);
  const [pedirNombre, setPedirNombre] = useState(initial.pedirNombre);
  const [listaId, setListaId] = useState(initial.listaId);
  const [activo, setActivo] = useState(initial.activo);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const { soloLectura } = usePermisos();

  const iframe = `<iframe src="${publicUrl}" width="100%" height="480" style="border:0;max-width:440px" title="${titulo.replace(/"/g, "&quot;")}"></iframe>`;

  const guardar = () =>
    startSave(async () => {
      const r = await guardarFormulario({
        id: initial.id,
        nombre,
        titulo,
        descripcion,
        botonTexto,
        exitoMensaje,
        pedirNombre,
        listaId,
        activo,
      });
      setMsg(r.ok ? "Guardado ✓" : `Error: ${r.error}`);
      setTimeout(() => setMsg(null), 2500);
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuración */}
      <div className="space-y-4">
        <Card className="space-y-4">
          <Input
            label="Nombre interno"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            fullWidth
          />
          <Input
            label="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            fullWidth
          />
          <Textarea
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            fullWidth
          />
          <Input
            label="Texto del botón"
            value={botonTexto}
            onChange={(e) => setBotonTexto(e.target.value)}
            fullWidth
          />
          <Textarea
            label="Mensaje de éxito"
            value={exitoMensaje}
            onChange={(e) => setExitoMensaje(e.target.value)}
            rows={2}
            hint="Se muestra tras suscribirse."
            fullWidth
          />
          <Select
            label="Lista destino"
            value={listaId}
            onChange={(e) => setListaId(e.target.value)}
            hint="A qué lista se agregan los suscriptores."
            fullWidth
          >
            <option value="">— sin lista —</option>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={pedirNombre}
                onChange={(e) => setPedirNombre(e.target.checked)}
                className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
              />
              Pedir nombre
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 rounded border-border-strong accent-[var(--accent)]"
              />
              Activo
            </label>
          </div>
        </Card>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={guardar} disabled={saving || soloLectura} title={soloLectura ? `Tu usuario es de solo lectura.` : undefined}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
          <form
            action={eliminarFormulario.bind(null, initial.id)}
            className="ml-auto"
          >
            <Button type="submit" variant="ghost" size="sm">
              Eliminar
            </Button>
          </form>
        </div>

        {/* Compartir */}
        <Card className="space-y-4">
          <div className="text-sm font-medium text-foreground">Compartir</div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Link público</span>
              <span className="text-xs text-subtle">
                {initial.submits.toLocaleString("es-AR")} suscripciones
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface-muted px-3 py-2 text-base text-foreground lg:text-sm"
              />
              <CopyButton text={publicUrl} />
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                aria-label="Abrir en nueva pestaña"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">
                Embeber en tu sitio
              </span>
              <CopyButton text={iframe} />
            </div>
            <textarea
              readOnly
              value={iframe}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 font-mono text-base text-foreground lg:text-xs"
            />
          </div>
        </Card>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 self-start w-full">
        <div className="text-xs font-semibold uppercase tracking-widest text-subtle mb-2">
          Vista previa
        </div>
        <div className="rounded-2xl border border-border bg-background p-6 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface shadow-md px-6 py-7">
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {titulo || "Suscribite a nuestro newsletter"}
            </h3>
            {descripcion && (
              <p className="mt-1 text-sm text-muted">{descripcion}</p>
            )}
            <div className="mt-4 space-y-3">
              {pedirNombre && (
                <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-subtle">
                  Nombre
                </div>
              )}
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-subtle">
                tu@email.com
              </div>
              <div className="rounded-xl bg-accent px-3 py-2.5 text-center text-sm font-medium text-accent-foreground">
                {botonTexto || "Suscribirme"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
