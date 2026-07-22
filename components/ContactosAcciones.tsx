"use client";

import { useState, useTransition } from "react";
import { sincronizarContactosTN, importarCSV } from "@/app/contactos/actions";

interface Lista {
  id: string;
  nombre: string;
}

export function ContactosAcciones({ listas }: { listas: Lista[] }) {
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

  const btn = "rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50";
  const input = "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={sync} disabled={syncing} className={btn}>
          {syncing ? "Sincronizando…" : "↻ Sincronizar TN"}
        </button>
        <button onClick={() => setShowCsv((v) => !v)} className={btn}>
          Importar CSV
        </button>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
      </div>

      {showCsv && (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-sm text-neutral-500">
            Pegá un email por línea (o <code>email,nombre</code>). Se marcan como que aceptan marketing.
          </div>
          <textarea className={`${input} w-full font-mono`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="juan@mail.com,Juan Pérez&#10;ana@mail.com" />
          <div className="flex items-center gap-2">
            <select className={input} value={listaId} onChange={(e) => setListaId(e.target.value)}>
              <option value="">Sin lista (solo crear)</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <button onClick={importar} disabled={importing || !csv.trim()} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {importing ? "Importando…" : "Importar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
