"use client";

import { useState, useTransition } from "react";
import { Star, RefreshCw, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { tapTarget } from "@/lib/ui";
import {
  crearRemitente,
  eliminarRemitente,
  hacerPrincipal,
  registrosDkim,
  verificarRemitente,
} from "@/app/(app)/remitentes/actions";

interface RegistroDkim {
  nombre: string;
  valor: string;
}

interface Remitente {
  id: string;
  nombre: string;
  email: string;
  dominio: string;
  responderA: string | null;
  estado: "PENDIENTE" | "AUTENTICADO" | "RECHAZADO";
  esPrincipal: boolean;
}

const ESTADO: Record<
  Remitente["estado"],
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  AUTENTICADO: { label: "Verificado", variant: "success" },
  PENDIENTE: { label: "Pendiente", variant: "warning" },
  RECHAZADO: { label: "Rechazado", variant: "danger" },
};

export function RemitentesManager({
  marca,
  remitentes,
}: {
  marca: string;
  remitentes: Remitente[];
}) {
  const [nombre, setNombre] = useState(marca);
  const [email, setEmail] = useState("");
  const [responderA, setResponderA] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const crear = () =>
    start(async () => {
      const r = await crearRemitente({ nombre, email, responderA });
      if (!r.ok) {
        setMsg(r.error ?? "Error");
        setTimeout(() => setMsg(null), 3000);
        return;
      }
      setEmail("");
      setResponderA("");
      setMsg(
        r.estado === "AUTENTICADO"
          ? "Remitente agregado ✓ El dominio ya estaba verificado."
          : "Remitente agregado ✓ Falta cargar los CNAME de abajo en tu DNS.",
      );
      setTimeout(() => setMsg(null), 6000);
    });

  return (
    <div className="space-y-6">
      {/* Alta */}
      <Card className="space-y-4">
        <div className="text-sm font-medium text-foreground">
          Agregar remitente
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Nombre visible"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={marca}
            fullWidth
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`info@${marca.toLowerCase().replace(/\s+/g, "")}.com`}
            fullWidth
          />
          <Input
            label="Responder a (opcional)"
            type="email"
            value={responderA}
            onChange={(e) => setResponderA(e.target.value)}
            placeholder="opcional"
            fullWidth
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="accent"
            onClick={crear}
            disabled={pending || !email.trim()}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Agregar
          </Button>
          {msg && <span className="text-sm text-muted">{msg}</span>}
        </div>
      </Card>

      {/* Lista */}
      {remitentes.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay remitentes para {marca}. Agregá el email desde el que
          querés que envíe esta marca (su dominio tiene que estar verificado en
          SES).
        </p>
      ) : (
        <div className="space-y-3">
          {remitentes.map((r) => (
            <RemitenteRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RemitenteRow({ r }: { r: Remitente }) {
  const [pending, start] = useTransition();
  const [nota, setNota] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RegistroDkim[] | null>(null);
  const [estado, setEstado] = useState(r.estado);
  const est = ESTADO[estado];

  // Se piden con un click y no al montar: son una llamada a SES por fila, y la
  // pantalla se abre muchas más veces de las que alguien carga un DNS.
  const verCnames = () =>
    start(async () => {
      const res = await registrosDkim(r.id);
      if (!res.ok) {
        setNota(res.error ?? "Error consultando SES");
        return;
      }
      setEstado(res.estado);
      setRegistros(res.registros);
      if (res.aviso) setNota(`SES devolvió: ${res.aviso}`);
      else if (res.estado === "AUTENTICADO") setNota("El dominio ya está verificado ✓");
      else if (!res.registros.length)
        setNota("SES todavía no devolvió los CNAME. Probá de nuevo en un minuto.");
    });

  return (
    <Card className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{r.nombre}</span>
          {r.esPrincipal && (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              principal
            </span>
          )}
        </div>
        <div className="text-sm text-muted truncate">
          {r.email}
          {r.responderA && (
            <span className="text-subtle"> · responder a {r.responderA}</span>
          )}
        </div>
        {nota && <div className="mt-1 text-xs text-muted">{nota}</div>}
      </div>

      {/* `flex-wrap`: a 343px el badge + "Verificar" + "Hacer principal" + el
          tacho suman más de una línea y sin envolver se comprimen hasta cortar
          el texto de los botones. */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={est.variant}>{est.label}</Badge>

        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await verificarRemitente(r.id);
              if (res.ok && res.estado) setEstado(res.estado);
              setNota(
                res.ok
                  ? res.estado === "AUTENTICADO"
                    ? "Dominio verificado en SES ✓"
                    : "Todavía no verificado. El DNS puede tardar hasta 48 h en propagar."
                  : "Error consultando SES"
              );
            })
          }
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden />
          Verificar
        </Button>

        {!r.esPrincipal && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => start(async () => void (await hacerPrincipal(r.id)))}
          >
            Hacer principal
          </Button>
        )}

        <form action={eliminarRemitente.bind(null, r.id)}>
          <button
            type="submit"
            aria-label="Eliminar"
            className={`flex ${tapTarget} h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-danger-foreground`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>

    {/* Mientras el dominio no esté verificado, esta marca NO manda: el envío lo
        exige (`getRemitenteEnvio`). Antes el estado era un badge y nada más, y
        el modo de falla quedaba mudo del otro lado. */}
    {estado !== "AUTENTICADO" && (
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <p className="text-foreground">
          <b>{r.dominio}</b> todavía no está verificado, así que esta marca no puede enviar.
          Cargá estos tres CNAME en tu DNS y volvé a apretar Verificar.
        </p>
        {registros === null ? (
          <Button variant="secondary" size="sm" className="mt-2" disabled={pending} onClick={verCnames}>
            Ver los CNAME
          </Button>
        ) : registros.length === 0 ? (
          <Button variant="secondary" size="sm" className="mt-2" disabled={pending} onClick={verCnames}>
            Reintentar
          </Button>
        ) : (
          <div className="mt-2 space-y-2">
            {registros.map((reg) => (
              <ParaCopiar key={reg.nombre} reg={reg} />
            ))}
            <p className="text-xs text-subtle">
              En Cloudflare van con la nube <b>gris</b> (DNS only): con la naranja, SES no verifica.
            </p>
          </div>
        )}
      </div>
    )}
    </Card>
  );
}

/** Un CNAME con su botón de copiar: escribirlo a mano es como se erra un token. */
function ParaCopiar({ reg }: { reg: RegistroDkim }) {
  const [copiado, setCopiado] = useState<"" | "nombre" | "valor">("");
  const copiar = (que: "nombre" | "valor", texto: string) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(que);
    setTimeout(() => setCopiado(""), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-1 rounded-lg bg-surface p-2 sm:grid-cols-2">
      {(["nombre", "valor"] as const).map((que) => (
        <button
          key={que}
          type="button"
          onClick={() => copiar(que, reg[que])}
          className="min-w-0 text-left"
          title="Copiar"
        >
          <span className="block text-[11px] uppercase tracking-wide text-subtle">
            {que === "nombre" ? "Nombre" : "Valor"}
            {copiado === que && <span className="ml-1 text-accent">copiado ✓</span>}
          </span>
          {/* `break-all`: un token de DKIM no tiene espacios y a 343px se sale
              de la tarjeta si no se lo deja cortar. */}
          <code className="block break-all font-mono text-xs text-foreground">{reg[que]}</code>
        </button>
      ))}
    </div>
  );
}
