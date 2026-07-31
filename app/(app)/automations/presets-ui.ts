import { type Trigger } from "@/lib/automations";

/**
 * Las tarjetas de `/automations`: qué automations ofrece armar la pantalla.
 *
 * Vive en su propio archivo —y sin los iconos— para que `probar-automations.ts`
 * pueda importarlo sin arrastrar la página entera (que trae Prisma y lucide).
 * Lo que ese script fija es que acá estén **los cuatro triggers del enum y nada
 * más**: uno de menos es una automation que no se puede crear, uno de más es un
 * botón que revienta al apretarlo.
 *
 * El icono de cada una está en `page.tsx`, en un `Record<Trigger, …>` completo,
 * así que un trigger nuevo tampoco puede quedarse sin él.
 */
export const TRIGGERS_UI: { trigger: Trigger; titulo: string; texto: string }[] = [
  {
    trigger: "NUEVO_CLIENTE",
    titulo: "Bienvenida",
    texto: "Se envía cuando un cliente nuevo se registra en tu tienda.",
  },
  // Se anotó ≠ compró. Son dos públicos distintos y por eso son dos tarjetas: el
  // de arriba dejó su nombre en el checkout, el de acá escribió solo su mail en
  // un pop-up y trae un cupón que ya ganó.
  {
    trigger: "NUEVO_SUSCRIPTOR",
    titulo: "Bienvenida a la lista",
    texto: "Se envía cuando alguien se anota en un pop-up o formulario, con el cupón que ganó.",
  },
  {
    trigger: "COMPRA",
    titulo: "Post-compra",
    texto: "Se envía cuando se paga un pedido (agradecimiento).",
  },
  {
    trigger: "CARRITO_ABANDONADO",
    titulo: "Carrito abandonado",
    texto: "Recupera ventas: incluye el link al carrito y los productos que dejó.",
  },
];
