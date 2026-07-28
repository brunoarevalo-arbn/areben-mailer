"use client";

import { useState, useTransition } from "react";
import { sincronizarContactosTN, importarCSV } from "@/app/(app)/contactos/actions";
import { Button } from "@/components/ui/Button";
import { usePermisos } from "@/components/PermisosProvider";
import { RefreshCw, Plug } from "lucide-react";

interface Lista {
  id: string;
  nombre: string;
}

export function ContactosAcciones({
  listas,
  tnConectado,
  tnAuthUrl,
  marca,
}: {
  listas: Lista[];
  tnConectado: boolean;
  tnAuthUrl: string;
  marca: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [syncing, startSync] = useTransition();
  const [showCsv, setShowCsv] = useState(false);
  const [csv, setCsv] = useState("");
  const [listaId, setListaId] = useState("");
  const [importing, startImport] = useTransition();

  const sync = () =>
    startSync(async () => {
      setMsg("Sincronizando…");
      const r = await sincronizarContactosTN();
      setMsg(r.ok ? `Sync OK — ${r.nuevos} nuevos, ${r.actualizados} actualizados` : `Error: ${r.error}`);
    });

  const importar = () =>
    startImport(async () => {
      const r = await importarCSV(listaId, csv);
      setMsg(r.ok ? `Importados: ${r.creados} nuevos de ${r.total}` : "Error");
      if (r.ok) { setCsv(""); setShowCsv(false); }
    });

  const { puede, soloLectura } = usePermisos();
  const puedeIntegrar = puede("integrar");

  const input = "rounded-lg border border-border-strong bg-background text-foreground placeholder:text-subtle px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {puedeIntegrar &&
          (tnConectado ? (
            <Button variant="secondary" onClick={sync} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              {syncing ? "Sincronizando…" : "Sincronizar TN"}
            </Button>
          ) : (
            <a
              href={tnAuthUrl}
              className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              <Plug className="mr-1.5 h-4 w-4" aria-hidden />
              Conectar Tiendanube de {marca}
            </a>
          ))}
        {!soloLectura && (
          <Button variant="secondary" onClick={() => setShowCsv((v) => !v)}>
            Importar CSV
          </Button>
        )}
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>

      {!tnConectado && (
        <p className="text-xs text-subtle">
          Autorizá la app en la tienda de <b>{marca}</b>. Al volver, sus clientes
          se importan a esta marca.
        </p>
      )}

      {showCsv && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-sm text-muted">
            Pegá un email por línea (o <code>email,nombre</code>). Se marcan como que aceptan marketing.
          </div>
          <textarea className={`${input} w-full font-mono`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="juan@mail.com,Juan Pérez&#10;ana@mail.com" />
          <div className="flex items-center gap-2">
            <select className={input} value={listaId} onChange={(e) => setListaId(e.target.value)}>
              <option value="">Sin lista (solo crear)</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <Button variant="accent" onClick={importar} disabled={importing || !csv.trim()}>
              {importing ? "Importando…" : "Importar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
