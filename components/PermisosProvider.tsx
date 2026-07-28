'use client';

import { createContext, useContext, useMemo } from 'react';
import { puede, MOTIVO, type Permiso, type Rol } from '@/lib/permisos';

// El rol, disponible en cualquier componente cliente sin pasarlo por props.
//
// La alternativa era hacer prop drilling desde 13 páginas hasta media docena de
// editores, cuando el layout ya tiene el dato. Como lee la MISMA función `puede`
// que usan las server actions, no puede pasar que la UI habilite algo que el
// servidor después rechaza.
//
// ⚠️ Esto es cosmética, no seguridad: el HTML se puede editar. Lo que protege de
// verdad son las llamadas a autorizar()/chequear() en cada action.

interface Valor {
  rol: Rol;
  interno: boolean;
}

const Ctx = createContext<Valor>({ rol: 'VIEWER', interno: false });

export function PermisosProvider({
  rol,
  interno,
  children,
}: Valor & { children: React.ReactNode }) {
  const valor = useMemo(() => ({ rol, interno }), [rol, interno]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** `const { puede } = usePermisos(); puede('enviar')` */
export function usePermisos() {
  const { rol, interno } = useContext(Ctx);
  return {
    rol,
    interno,
    puede: (p: Permiso) => puede(rol, p),
    /** Copy para el tooltip de un control apagado. */
    motivo: (p: Permiso) => MOTIVO[p],
    soloLectura: !puede(rol, 'editar'),
  };
}
