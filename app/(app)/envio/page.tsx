import { AlertTriangle, CheckCircle2, CircleSlash, FlaskConical, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { autorizar } from "@/lib/auth";
import { getDiagnosticoEnvio } from "@/lib/email/diagnostico";
import type { ModoEnvio } from "@/lib/email/proveedor";

// El estado real del envío, leído del servidor que manda.
//
// `force-dynamic` no es opcional: una versión cacheada de esta página diría que
// el gate está cerrado cuando ya se abrió, que es la mentira más cara posible.
export const dynamic = "force-dynamic";

const MODO: Record<
  ModoEnvio,
  { label: string; detalle: string; variant: "danger" | "info" | "default"; caja: string }
> = {
  real: {
    label: "Envío real",
    detalle: "Las campañas salen a la lista completa. Cualquier envío llega a gente de verdad.",
    variant: "danger",
    caja: "border-danger-border bg-danger",
  },
  ensayo: {
    label: "Ensayo",
    detalle: "El motor corre entero, pero solo llega a las casillas de abajo. El resto queda FALLIDO.",
    variant: "info",
    caja: "border-info-border bg-info",
  },
  bloqueado: {
    label: "Bloqueado",
    detalle: "No sale nada. Es el default: si la env falta o está mal escrita, la app se queda muda.",
    variant: "default",
    caja: "border-border bg-surface-muted",
  },
};

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

export default async function EnvioPage() {
  // Mismo permiso que mandar una campaña: quien puede abrir el grifo es quien
  // tiene que poder ver en qué posición está.
  const { cuenta } = await autorizar("enviar");
  const d = await getDiagnosticoEnvio(cuenta.id);
  const modo = MODO[d.modo];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        title="Estado del envío"
        subtitle={`Por dónde sale el mail de ${cuenta.nombre} y a quién puede llegarle, ahora mismo.`}
      />

      {/* El gate primero y grande: es lo único que decide si esto llega a alguien. */}
      <Card padding="loose" className={`border-2 ${modo.caja}`}>
        <div className="flex items-start gap-4">
          {d.modo === "real" ? (
            <AlertTriangle className="h-6 w-6 shrink-0 text-danger-foreground" aria-hidden />
          ) : d.modo === "ensayo" ? (
            <FlaskConical className="h-6 w-6 shrink-0 text-info-foreground" aria-hidden />
          ) : (
            <CircleSlash className="h-6 w-6 shrink-0 text-muted" aria-hidden />
          )}
          <div className="min-w-0">
            <div className="text-lg font-semibold text-foreground">{modo.label}</div>
            <p className="text-sm text-muted mt-1">{modo.detalle}</p>
          </div>
        </div>

        {d.modo === "ensayo" && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
              Solo reciben estas casillas
            </div>
            {d.listaEnsayo.length === 0 ? (
              <p className="text-sm text-muted">
                La lista está vacía. Sin ella el modo sería «bloqueado».
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {d.listaEnsayo.map((e) => (
                  <li key={e}>
                    <Badge variant={e.startsWith("@") ? "violet" : "blue"}>{e}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted mt-3">
              Las que empiezan con <code>@</code> son dominios enteros: habilitan todas sus casillas.
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Proveedor + rebotes: van juntos porque el camino de rebotes es distinto
            en cada proveedor, y leerlos separados invita a mirar el que no es. */}
        <Card padding="loose">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-3">Proveedor</h2>

          {d.proveedor ? (
            <>
              <Dato label="Activo">
                <Badge variant="amber">{d.proveedor}</Badge>
              </Dato>
              <div className="border-t border-border mt-2 pt-2">
                <Dato label="Rebotes y quejas">
                  {d.rebotes.cerrado ? (
                    <span className="inline-flex items-center gap-1.5 text-success-foreground">
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Se limpian solos
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-danger-foreground">
                      <XCircle className="h-4 w-4" aria-hidden /> Sin cerrar
                    </span>
                  )}
                </Dato>
                {!d.rebotes.cerrado && (
                  <p className="text-xs text-muted mt-1">
                    {d.rebotes.falta.length > 0 && (
                      <>
                        Falta cargar{" "}
                        {d.rebotes.falta.map((f, i) => (
                          <span key={f}>
                            {i > 0 && ", "}
                            <code className="text-foreground">{f}</code>
                          </span>
                        ))}
                        .{" "}
                      </>
                    )}
                    Se configura en {d.rebotes.donde}. Hasta entonces un rebote permanente no quema
                    el contacto.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm text-danger-foreground">
              <div className="font-medium">EMAIL_PROVIDER no resuelve.</div>
              <p className="text-xs text-muted mt-1">
                Vale <code className="text-foreground">{d.proveedorInvalido}</code>, que no es
                ninguno de <code>ses</code>, <code>resend</code> o <code>sendgrid</code>. Con esto no
                sale ni un mail.
              </p>
            </div>
          )}
        </Card>

        {/* Remitente de la marca activa. */}
        <Card padding="loose">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent mb-3">
            Remitente de {cuenta.nombre}
          </h2>
          {d.remitente ? (
            <>
              <Dato label="Nombre">{d.remitente.nombre}</Dato>
              <Dato label="Dirección">{d.remitente.email}</Dato>
              <Dato label="Responder a">{d.remitente.responderA ?? "—"}</Dato>
            </>
          ) : (
            <div className="text-sm text-danger-foreground">
              <div className="font-medium">Esta marca no puede enviar.</div>
              <p className="text-xs text-muted mt-1">
                No tiene remitente propio, y no hay default: un mail sin remitente de la marca
                saldría firmado por otra. Se carga en <code className="text-foreground">/remitentes</code>{" "}
                y con eso queda habilitada.
              </p>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted">
        Todo esto se lee del servidor que efectivamente manda. Un cambio de variable en Vercel se
        aplica recién en el próximo deploy: si acabás de tocar una y acá sigue igual, falta
        redeployar.
      </p>
    </div>
  );
}
