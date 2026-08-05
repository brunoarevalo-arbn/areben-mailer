import { cookies } from "next/headers";
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
  const [{ cuenta, rol, interno, nombre, email }, cuentas, galletas] =
    await Promise.all([getAuth(), getCuentas(), cookies()]);

  // La misma cookie que el layout raíz convierte en la clase `menu-plegado`.
  // Se lee dos veces a propósito: el ancho lo resuelve una variable CSS (que
  // tiene que estar en <html> para que la herede también la barra de guardar),
  // pero QUÉ DIBUJA el sidebar plegado —iconos sin etiqueta— es estado de
  // React, y arrancarlo en `false` mostraría un cuadro con once etiquetas
  // desbordando 64px antes de hidratar.
  const menuPlegado = galletas.get("menu")?.value === "plegado";

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
          plegadoInicial={menuPlegado}
        />
        {/* `pt-14` deja lugar a la barra fija de celular, que en `lg` no existe. */}
        <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
          {/*
            🔑 El cap de 1152px SUBE (no se saca) en las pantallas de editor, que
            se marcan con `data-editor` (CampaniaEditor, AutomationEditor,
            PlantillaEditor). Medido el 5-ago-2026: el ancho útil del editor es
            `min(1152, ventana − menú) − 64`, así que arriba de ~1400px de
            ventana el cap ya está actuando y la columna del medio queda
            congelada en 398px por igual a 1440, 1512 y 1920. Plegar el menú sin
            esto no devuelve un solo pixel.
            El número está en `--ancho-editor` (globals.css) porque lo espeja la
            barra de guardar.
            ⚠️ Va por `:has()` y no por props porque el cap vive en el ancestro y
            quien sabe si es un editor es el hijo. Es CSS puro: sin JS, sin
            flash, y Safari lo soporta desde 15.4.
          */}
          <div className="mx-auto max-w-6xl px-4 py-6 has-[[data-editor]]:max-w-[var(--ancho-editor)] sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </PermisosProvider>
  );
}
