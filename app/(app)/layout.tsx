import { Sidebar } from "@/components/Sidebar";
import { getCuentaActiva, getCuentas } from "@/lib/cuenta";
import { getSessionUser } from "@/lib/dal";

// Layout de la app autenticada. getSessionUser() (vía verifySession) redirige
// a /login si no hay sesión, así que este layout protege todas las rutas (app).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cuenta, cuentas, usuario] = await Promise.all([
    getCuentaActiva(),
    getCuentas(),
    getSessionUser(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        // El selector de marcas es solo para el equipo de Areben. Un comerciante
        // recibe únicamente su tienda, así el switcher muestra el nombre sin
        // ofrecerle saltar a otra cuenta.
        cuentas={usuario?.interno ? cuentas : cuentas.filter((c) => c.id === cuenta.id)}
        cuentaActivaId={cuenta.id}
        usuario={
          usuario ? { nombre: usuario.nombre, email: usuario.email } : null
        }
      />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
