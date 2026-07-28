"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, KeyRound, Power, Globe, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROL_LABEL, ROL_DESCRIPCION, type Rol } from "@/lib/permisos";
import {
  crearUsuario,
  cambiarRol,
  toggleActivo,
  toggleInterno,
  resetearPassword,
  eliminarUsuario,
} from "@/app/(app)/usuarios/actions";

interface Usuario {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  interno: boolean;
  activo: boolean;
  ultimoLoginAt: Date | null;
}

const ROLES: Rol[] = ["ADMIN", "EDITOR", "VIEWER"];

/**
 * La contraseña temporal se muestra UNA sola vez, acá, con botón de copiar.
 * No se manda por mail a propósito: el mailer manda marketing, y meterle un
 * flujo de credenciales mezcla dos cosas que conviene tener separadas.
 */
function PasswordTemporal({ valor, email }: { valor: string; email: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Card className="border-accent-subtle-foreground/30 bg-accent-subtle">
      <div className="text-sm font-medium text-accent-subtle-foreground">
        Contraseña temporal de {email}
      </div>
      <p className="mt-1 text-xs text-muted">
        Anotala ahora: no se vuelve a mostrar. Pasásela por un canal privado y pedile que la
        cambie desde “Mi contraseña”.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-sm text-foreground">
          {valor}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(valor);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </Button>
      </div>
    </Card>
  );
}

export function UsuariosManager({
  usuarios,
  marca,
  yoId,
  soyInterno,
}: {
  usuarios: Usuario[];
  marca: string;
  yoId: string;
  soyInterno: boolean;
}) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("EDITOR");
  const [interno, setInterno] = useState(false);
  const [temporal, setTemporal] = useState<{ email: string; valor: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const aviso = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(null), 4000);
  };

  const crear = () =>
    start(async () => {
      const r = await crearUsuario({ email, nombre, rol, interno });
      if (r.ok && r.passwordTemporal) {
        setTemporal({ email: email.trim().toLowerCase(), valor: r.passwordTemporal });
        setEmail("");
        setNombre("");
        setInterno(false);
      } else {
        aviso(r.error ?? "Error");
      }
    });

  return (
    <div className="space-y-6">
      {temporal && <PasswordTemporal valor={temporal.valor} email={temporal.email} />}

      {/* Alta */}
      <Card>
        <div className="text-sm font-medium text-foreground">Sumar a alguien a {marca}</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            label="Email"
            placeholder="nombre@arebensrl.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Nombre"
            placeholder="Opcional"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Select label="Rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button variant="accent" onClick={crear} disabled={pending || !email.trim()} className="w-full">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {pending ? "Creando…" : "Crear"}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{ROL_DESCRIPCION[rol]}</p>
        {soyInterno && (
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={interno}
              onChange={(e) => setInterno(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong accent-[var(--color-accent)]"
            />
            <span>
              Equipo Areben — puede cambiar entre las marcas
              <span className="ml-1 text-muted">(su rol se aplica igual en cada una)</span>
            </span>
          </label>
        )}
        {msg && <div className="mt-2 text-sm text-muted">{msg}</div>}
      </Card>

      {/* Listado */}
      <div className="space-y-2">
        {usuarios.map((u) => {
          const soyYo = u.id === yoId;
          return (
            <Card key={u.id} padding="compact">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {u.nombre ?? u.email}
                    </span>
                    {soyYo && <Badge size="sm" variant="info">vos</Badge>}
                    {!u.activo && <Badge size="sm" variant="danger">inactivo</Badge>}
                    {u.interno && (
                      <Badge size="sm" variant="violet">
                        <Globe className="mr-1 inline h-3 w-3" aria-hidden />
                        todas las marcas
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted truncate">
                    {u.nombre ? `${u.email} · ` : ""}
                    {u.ultimoLoginAt
                      ? `último ingreso ${new Date(u.ultimoLoginAt).toLocaleDateString("es-AR")}`
                      : "nunca ingresó"}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={u.rol}
                    disabled={soyYo || pending}
                    title={soyYo ? "No podés cambiarte el rol a vos mismo" : undefined}
                    onChange={(e) =>
                      start(async () => {
                        const r = await cambiarRol(u.id, e.target.value as Rol);
                        if (!r.ok) aviso(r.error ?? "Error");
                      })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROL_LABEL[r]}
                      </option>
                    ))}
                  </Select>

                  {soyInterno && !soyYo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title={u.interno ? "Dejar solo en esta marca" : "Dar acceso a todas las marcas"}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await toggleInterno(u.id);
                          if (!r.ok) aviso(r.error ?? "Error");
                        })
                      }
                    >
                      <Globe className="h-4 w-4" aria-hidden />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    title="Generar una contraseña nueva"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (!confirm(`¿Generar una contraseña nueva para ${u.email}? La actual deja de servir.`)) return;
                        const r = await resetearPassword(u.id);
                        if (r.ok && r.passwordTemporal) setTemporal({ email: u.email, valor: r.passwordTemporal });
                        else aviso(r.error ?? "Error");
                      })
                    }
                  >
                    <KeyRound className="h-4 w-4" aria-hidden />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    title={u.activo ? "Desactivar (le corta el acceso ya)" : "Reactivar"}
                    disabled={soyYo || pending}
                    onClick={() =>
                      start(async () => {
                        const r = await toggleActivo(u.id);
                        if (!r.ok) aviso(r.error ?? "Error");
                      })
                    }
                  >
                    <Power className={`h-4 w-4 ${u.activo ? "" : "text-danger-foreground"}`} aria-hidden />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    title="Eliminar"
                    disabled={soyYo || pending}
                    onClick={() =>
                      start(async () => {
                        if (!confirm(`¿Eliminar a ${u.email}? Si solo querés cortarle el acceso, mejor desactivalo.`)) return;
                        const r = await eliminarUsuario(u.id);
                        if (!r.ok) aviso(r.error ?? "Error");
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
