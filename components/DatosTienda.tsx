"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CAMPOS_TIENDA, type ClaveTienda, type Tienda } from "@/lib/email/tienda";
import { guardarDatosTienda } from "@/app/(app)/remitentes/actions";

// Los datos duros del comercio, en UN lugar.
//
// 🔴 **De dónde salió** (22-ago-2026): el umbral de envío gratis estaba escrito
// a mano en 10 campañas de BDI y en la automation de Bienvenida, que estaba
// ACTIVA. Las once decían "$50.000" cuando el real es "$44.000". Cambiar el
// número obligaba a editar once documentos, y ningún proceso humano hace eso
// once veces sin fallar una.
//
// Vive en Remitentes por lo mismo que el tema y las redes: esta página ya
// contesta "con qué cara y desde qué dirección sale el mail"; esto contesta
// "qué dice de tu tienda", que es la misma clase de dato y se carga una vez.
//
// 🔑 **Los campos NO están enumerados acá.** Salen de `CAMPOS_TIENDA`, que es la
// misma lista que valida al guardar y la misma que lee el render. Escribirlos a
// mano en el formulario es cómo se llega a una pantalla que ofrece un campo que
// el mail no lee, o al revés.

export function DatosTienda({ inicial }: { inicial: Tienda }) {
  const [datos, setDatos] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_TIENDA.map((c) => [c.clave, inicial[c.clave] ?? ""])),
  );
  const [guardando, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const sucio = CAMPOS_TIENDA.some((c) => (datos[c.clave] ?? "").trim() !== (inicial[c.clave] ?? ""));
  const cargados = CAMPOS_TIENDA.filter((c) => (datos[c.clave] ?? "").trim()).length;

  const cambiar = (clave: ClaveTienda, v: string) => {
    setDatos((d) => ({ ...d, [clave]: v }));
    setMsg(null);
  };

  const guardar = () =>
    start(async () => {
      const r = await guardarDatosTienda(datos);
      setMsg(r.ok ? "Guardado. Los mails que usan estos datos ya salen con los nuevos." : r.error ?? "No se pudo guardar.");
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Datos de tu tienda</div>
          <p className="mt-1 text-xs text-muted">
            Lo que tus mails cuentan de vos: el envío, las cuotas, los plazos. Se escriben acá una
            vez y todos los mails los leen. Cambiar el número acá lo cambia en todos.
          </p>
        </div>
        <Button variant="secondary" onClick={guardar} disabled={!sucio || guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        {CAMPOS_TIENDA.map((c) => (
          <div key={c.clave}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <label className="text-xs font-medium text-foreground" htmlFor={`tienda-${c.clave}`}>
                {c.etiqueta}
              </label>
              {/* El tag a la vista: es lo que hay que escribir en el mail para
                  que este número aparezca. Sin esto, el dato queda cargado y
                  nadie sabe cómo pedirlo. */}
              <code className="font-mono text-[11px] text-subtle">{"${tienda." + c.clave + "}"}</code>
            </div>
            <Input
              id={`tienda-${c.clave}`}
              value={datos[c.clave] ?? ""}
              onChange={(e) => cambiar(c.clave, e.target.value)}
              placeholder={c.ejemplo}
              maxLength={c.max}
              disabled={guardando}
              fullWidth
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted">{c.ayuda}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted">
        {cargados === 0
          ? "Todavía no cargaste ninguno: los mails que los usen van a salir sin ese renglón."
          : `${cargados} de ${CAMPOS_TIENDA.length} cargados. Un campo vacío no rompe el mail: se cae el renglón que lo nombra, no el bloque.`}
      </p>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
