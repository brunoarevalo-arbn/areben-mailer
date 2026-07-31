import { Sidebar } from "@/components/Sidebar";
import { PermisosProvider } from "@/components/PermisosProvider";
import { getCuentas } from "@/lib/cuenta";
import { getAuth } from "@/lib/auth";

// Layout de la app autenticada. getAuth() redirige a /login si no hay sesión (o
// si el usuario ya no existe), así que este layout protege todas las rutas (app).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ cuenta, rol, interno, nombre, email }, cuentas] = await Promise.all([
    getAuth(),
    getCuentas(),
  ]);

  return (
    <PermisosProvider rol={rol} interno={interno}>
      <div className="flex min-h-screen">
        <Sidebar
          // El selector de marcas es solo para el equipo de Areben. Un comerciante
          // recibe únicamente su tienda, así el switcher muestra el nombre sin
          // ofrecerle saltar a otra cuenta.
          cuentas={interno ? cuentas : cuentas.filter((c) => c.id === cuenta.id)}
          cuentaActivaId={cuenta.id}
          usuario={{ nombre, email }}
          rol={rol}
        />
        {/* `pt-14` deja lugar a la barra fija de celular, que en `lg` no existe. */}
        <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </PermisosProvider>
  );
}
