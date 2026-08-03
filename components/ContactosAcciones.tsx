"use client";

import { useState, useTransition } from "react";
import { sincronizarContactosTN, importarCSV } from "@/app/(app)/contactos/actions";
import { Button } from "@/components/ui/Button";
import { usePermisos } from "@/components/PermisosProvider";
import { RefreshCw, Plug } from "lucide-react";
import { campoBase, tapTarget } from "@/lib/ui";

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
  // La declaración arranca SIN tildar a propósito: el default es el caso seguro
  // (entra apagado), no el que compromete la reputación de envío.
  const [declara, setDeclara] = useState(false);
  const [origen, setOrigen] = useState("");

  const sync = () =>
    startSync(async () => {
      setMsg("Sincronizando…");
      const r = await sincronizarContactosTN();
      setMsg(r.ok ? `Sync OK — ${r.nuevos} nuevos, ${r.actualizados} actualizados` : `Error: ${r.error}`);
    });

  const importar = () =>
    startImport(async () => {
      const r = await importarCSV(listaId, csv, declara ? { origen } : null);
      if (!r.ok) {
        setMsg(`Error: ${r.error}`);
        return;
      }
      setMsg(
        r.apagados
          ? `Importados: ${r.creados} nuevos de ${r.total}. Los ${r.apagados} quedaron sin recibir mails hasta que declares el origen.`
          : `Importados: ${r.creados} nuevos de ${r.total}`,
      );
      setCsv("");
      setOrigen("");
      setDeclara(false);
      setShowCsv(false);
    });

  const { puede } = usePermisos();
  const puedeIntegrar = puede("integrar");


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
              className={`inline-flex ${tapTarget} items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover`}
            >
              <Plug className="mr-1.5 h-4 w-4" aria-hidden />
              Conectar Tiendanube de {marca}
            </a>
          ))}
        {/* Importar es ADMIN: quien declara el consentimiento de una lista
            compromete la reputación de envío de todas las marcas. */}
        {puedeIntegrar && (
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
            Pegá un email por línea (o <code>email,nombre</code>).
          </div>
          <textarea className={`${campoBase} w-full font-mono`} rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="juan@mail.com,Juan Pérez&#10;ana@mail.com" />

          {/* Sin esto, lo importado entra APAGADO. El texto dice qué pasa en
              cada caso porque el default silencioso —"se marcan como que
              aceptan marketing"— era el que dejaba entrar una lista comprada. */}
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              checked={declara}
              onChange={(e) => setDeclara(e.target.checked)}
            />
            <span className="text-muted">
              Declaro que estas personas <b>pidieron</b> recibir mails de {marca}.
            </span>
          </label>
          {declara ? (
            <input
              className={`${campoBase} w-full`}
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              placeholder="¿De dónde salió esta lista? Ej: se anotaron en el local durante 2025"
            />
          ) : (
            <p className="text-xs text-subtle">
              Sin declarar, los contactos se guardan pero <b>no reciben ningún mail</b>. Podés
              volver a importar el mismo archivo con la declaración para activarlos.
            </p>
          )}
          {/* `flex-wrap` + `min-w-0`: el <select> de listas crece con el nombre
              más largo, y sin envolver empujaba a "Importar" fuera de la tarjeta
              a 343px. */}
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${campoBase} min-w-0 max-w-full`} value={listaId} onChange={(e) => setListaId(e.target.value)}>
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
