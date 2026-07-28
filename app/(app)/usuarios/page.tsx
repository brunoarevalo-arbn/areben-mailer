import { PageHeader } from "@/components/ui/PageHeader";
import { UsuariosManager } from "@/components/UsuariosManager";
import { CambiarMiPassword } from "@/components/CambiarMiPassword";
import { prisma } from "@/lib/prisma";
import { autorizar } from "@/lib/auth";
import type { Rol } from "@/lib/permisos";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const { cuenta, userId, interno } = await autorizar("usuarios");

  const usuarios = await prisma.usuario.findMany({
    where: { cuentaId: cuenta.id },
    orderBy: [{ activo: "desc" }, { email: "asc" }],
    // Nunca passwordHash: no tiene por qué salir de la base.
    select: {
      id: true,
      email: true,
      nombre: true,
      rol: true,
      interno: true,
      activo: true,
      ultimoLoginAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipo"
        title="Usuarios"
        subtitle={`Quién entra al panel de ${cuenta.nombre} y qué puede hacer.`}
      />
      <UsuariosManager
        usuarios={usuarios.map((u) => ({ ...u, rol: u.rol as Rol }))}
        marca={cuenta.nombre}
        yoId={userId}
        soyInterno={interno}
      />
      <CambiarMiPassword />
    </div>
  );
}
