"use client";

import type { Bloque } from "@/lib/email/render";
import { ProductosBlock } from "@/components/ProductosBlock";
import { ProductosDinamicosBlock } from "@/components/editor/ProductosDinamicosBlock";
import { ImagenDrop } from "@/components/editor/ImagenDrop";
import { Rango } from "@/components/editor/Rango";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Marca } from "@/lib/marca";
import { REDES, redConIcono } from "@/lib/email/redes";
import { X } from "lucide-react";

/**
 * El formulario de UN bloque: lo que antes vivía adentro de cada fila de la
 * lista y ahora se dibuja en el panel de la derecha.
 *
 * Es solo la pestaña **Contenido**. El estilo (colores, tamaños, espaciados)
 * tiene su propia pestaña y su propio control de tres estados, porque el orden
 * en que se ofrecen las opciones es lo que decide si la gente clava un hex o usa
 * el color de su marca.
 */


function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}

function Alineacion({
  value,
  onChange,
}: {
  value: "left" | "center";
  onChange: (v: "left" | "center") => void;
}) {
  return (
    <Select label="Alineación" fullWidth value={value} onChange={(e) => onChange(e.target.value as "left" | "center")}>
      <option value="left">Izquierda</option>
      <option value="center">Centro</option>
    </Select>
  );
}

export function FormBloque({
  bloque: b,
  onChange,
  marca,
}: {
  bloque: Bloque;
  /** Parche sobre el bloque. Nunca reemplaza el bloque entero: perdería el `id`. */
  onChange: (patch: Partial<Bloque>) => void;
  /**
   * Solo para los placeholders del encabezado: el nombre y el logo los resuelve
   * el render, no se copian adentro del bloque.
   */
  marca: Marca;
}) {
  const set = onChange;
  const nombreCuenta = marca.nombreCuenta ?? "";
  const logoTienda = marca.logoCuenta ?? "";

  switch (b.tipo) {
    case "encabezado":
      return (
        <div className="space-y-3">
          {/* "Automático" es la ausencia de `variante`, no un valor: así el
              bloque no decide por una marca que todavía no conoce y una
              plantilla sirve igual en una tienda con logo y en una sin. */}
          <Select
            label="Qué se muestra arriba"
            fullWidth
            value={b.variante ?? "auto"}
            onChange={(e) => {
              const v = e.target.value;
              set({ variante: v === "auto" ? undefined : (v as "texto" | "logo") });
            }}
          >
            <option value="auto">Automático{logoTienda ? " (el logo de tu tienda)" : " (el nombre de la marca)"}</option>
            <option value="texto">Nombre de la marca</option>
            <option value="logo">Otro logo</option>
          </Select>

          {b.variante === "logo" ? (
            <>
              <ImagenDrop value={b.logo ?? ""} onChange={(logo) => set({ logo })} placeholder="URL del logo (https://…)" />
              <Rango label="Ancho del logo" value={b.logoAncho ?? 140} onChange={(logoAncho) => set({ logoAncho })} min={40} max={400} step={10} />
              <p className="text-xs text-subtle">
                {logoTienda ? "Sin cargar ninguno se usa el logo de tu tienda." : "Sin logo cargado se muestra el nombre."}
              </p>
            </>
          ) : (
            <>
              {b.variante === undefined && logoTienda && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoTienda} alt="Logo de tu tienda" className="h-9 w-auto max-w-40 object-contain" />
              )}
              <Input
                label="Texto"
                fullWidth
                value={b.texto ?? ""}
                placeholder={nombreCuenta}
                onChange={(e) => set({ texto: e.target.value })}
                hint="Vacío = el nombre de la marca. Dejalo así para que la plantilla sirva en cualquier tienda."
              />
            </>
          )}

          <Input
            label="Link al tocarlo"
            fullWidth
            value={b.url ?? ""}
            placeholder={marca.urlCuenta || "https://… (opcional)"}
            onChange={(e) => set({ url: e.target.value })}
          />
          <Check label="Barrita de color debajo" checked={b.linea !== false} onChange={(linea) => set({ linea })} />
          {b.variante !== "logo" && (
            <Check label="En mayúsculas" checked={b.mayusculas !== false} onChange={(mayusculas) => set({ mayusculas })} />
          )}
        </div>
      );

    case "titulo":
    case "texto":
      return (
        <div className="space-y-3">
          <Textarea
            label={b.tipo === "titulo" ? "Título" : "Texto"}
            fullWidth
            rows={b.tipo === "texto" ? 6 : 2}
            value={b.texto}
            onChange={(e) => set({ texto: e.target.value })}
            hint="Podés usar ${contacto.nombre}."
          />
          <Alineacion value={b.align ?? "left"} onChange={(align) => set({ align })} />
        </div>
      );

    case "boton":
      return (
        <div className="space-y-3">
          <Input label="Texto del botón" fullWidth value={b.texto} onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Link" fullWidth value={b.url} placeholder="https://…" onChange={(e) => set({ url: e.target.value })} />
          <Alineacion value={b.align ?? "left"} onChange={(align) => set({ align })} />
          <Check label="Ancho completo" checked={!!b.full} onChange={(full) => set({ full })} />
        </div>
      );

    case "hero": {
      const conFondo = !!b.fondoImagen;
      return (
        <div className="space-y-3">
          <Select
            label="Cómo va la imagen"
            fullWidth
            value={conFondo ? "fondo" : "arriba"}
            onChange={(e) => {
              // 🔴 El velo arranca en 55 SOLO acá, en el momento en que alguien
              // elige poner la foto de fondo. En el documento el default es 0
              // (ver `bloques.ts`): si el default viviera allá, toda portada con
              // foto ya guardada cambiaría de aspecto sola el día del deploy.
              // La opinión va en el editor, el dato en el Json.
              if (e.target.value === "fondo") {
                set({ fondoImagen: b.fondoImagen || b.imagen || "", imagen: "", velo: b.velo ?? 55 });
              } else set({ imagen: b.imagen || b.fondoImagen || "", fondoImagen: undefined });
            }}
          >
            <option value="arriba">Arriba del texto</option>
            <option value="fondo">De fondo, con el texto encima</option>
          </Select>
          {conFondo ? (
            <>
              <ImagenDrop value={b.fondoImagen ?? ""} onChange={(fondoImagen) => set({ fondoImagen })} placeholder="URL de la imagen de fondo" />
              <Rango label="Alto aproximado" value={b.alto ?? 280} onChange={(alto) => set({ alto })} min={120} max={500} step={10} />
              <Rango label="Cuánto se tapa la foto" value={b.velo ?? 0} onChange={(velo) => set({ velo })} min={0} max={90} step={5} />
              <p className="text-xs text-subtle">
                Pinta encima el color de &ldquo;Fondo del texto&rdquo;, para que el título se lea: con un
                fondo oscuro la <b>oscurece</b>, con uno claro la <b>aclara</b>. En 0 el texto va
                directo sobre la foto.
              </p>
              <p className="text-xs text-subtle">
                Outlook no puede medir cuánto ocupa el texto: si es largo, puede quedar apretado.
                Subí el alto si hace falta.
              </p>
            </>
          ) : (
            <ImagenDrop value={b.imagen} onChange={(imagen) => set({ imagen })} placeholder="URL de la imagen (banner)" />
          )}
          <Input label="Título principal" fullWidth value={b.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          <Input label="Subtítulo" fullWidth value={b.subtitulo} onChange={(e) => set({ subtitulo: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
          <ColorFijo label="Fondo del texto" value={b.bg} onChange={(bg) => set({ bg })} />
        </div>
      );
    }

    case "seccion":
      return (
        <div className="space-y-3">
          <Input label="Título de la sección" fullWidth value={b.titulo} onChange={(e) => set({ titulo: e.target.value })} />
          <Textarea label="Texto" fullWidth rows={4} value={b.texto} onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
          <ColorFijo label="Fondo de la sección" value={b.bg} onChange={(bg) => set({ bg })} />
        </div>
      );

    case "cupon":
      return (
        <div className="space-y-3">
          <Input label="Texto" fullWidth value={b.texto} placeholder="Usá este código en el checkout" onChange={(e) => set({ texto: e.target.value })} />
          <Input label="Código" fullWidth value={b.codigo} placeholder="DESCUENTO10" onChange={(e) => set({ codigo: e.target.value })} />
          <Input label="Texto del botón" fullWidth value={b.botonTexto} placeholder="Opcional" onChange={(e) => set({ botonTexto: e.target.value })} />
          <Input label="Link del botón" fullWidth value={b.botonUrl} placeholder="https://…" onChange={(e) => set({ botonUrl: e.target.value })} />
        </div>
      );

    case "imagen":
      return (
        <div className="space-y-3">
          <ImagenDrop value={b.url} onChange={(url) => set({ url })} />
          <Input
            label="Texto alternativo"
            fullWidth
            value={b.alt ?? ""}
            onChange={(e) => set({ alt: e.target.value })}
            hint="Lo que se lee cuando el cliente de mail bloquea las imágenes — que es el caso por defecto en Outlook."
          />
        </div>
      );

    case "productos":
      return <ProductosBlock items={b.items} onChange={(items) => set({ items })} />;

    case "productos-dinamicos":
      return (
        <ProductosDinamicosBlock
          fuente={b.fuente}
          categoriaId={b.categoriaId}
          n={b.n}
          // `items` no se toca nunca desde acá: el bloque guarda la consulta y
          // los productos los pone quien envía. Si el editor los escribiera, una
          // plantilla compartida saldría con los productos de otra tienda.
          onChange={(cambio) => set(cambio as Partial<Bloque>)}
        />
      );

    case "espaciador":
      return <Rango label="Alto" value={b.alto ?? 24} onChange={(alto) => set({ alto })} min={4} max={120} step={4} />;

    case "carrito":
      return (
        <p className="text-sm leading-relaxed text-muted">
          Se completa solo con lo que la persona dejó en el carrito: foto, nombre, variante,
          cantidad y precio. Movelo para elegir en qué parte del mail aparece.
          <br />
          <br />
          Solo tiene efecto en la automation de <strong>carrito abandonado</strong>. En una
          campaña común no hay carrito, así que el bloque no se dibuja.
        </p>
      );

    case "columnas": {
      const variante = b.variante ?? "imagenes";
      // Qué campo se edita en cada lado, según la variante elegida.
      const campo = (lado: "izq" | "der"): "imagen" | "texto" => {
        if (variante === "imagenes") return "imagen";
        if (variante === "textos") return "texto";
        if (variante === "imagen-texto") return lado === "izq" ? "imagen" : "texto";
        return lado === "izq" ? "texto" : "imagen"; // texto-imagen
      };
      return (
        <div className="space-y-4">
          <Select
            label="Formato"
            fullWidth
            value={variante}
            onChange={(e) => {
              const v = e.target.value;
              set({ variante: v === "imagenes" ? undefined : (v as "textos" | "imagen-texto" | "texto-imagen") });
            }}
          >
            <option value="imagenes">Dos imágenes</option>
            <option value="textos">Dos textos</option>
            <option value="imagen-texto">Imagen + texto</option>
            <option value="texto-imagen">Texto + imagen</option>
          </Select>
          <Select
            label="Proporción"
            fullWidth
            value={String(b.proporcion ?? 50)}
            onChange={(e) => {
              const v = e.target.value;
              set({ proporcion: v === "50" ? undefined : (Number(v) as 40 | 60) });
            }}
          >
            <option value="50">Pareja (50 / 50)</option>
            <option value="40">Angosta a la izquierda (40 / 60)</option>
            <option value="60">Angosta a la derecha (60 / 40)</option>
          </Select>
          {(["izq", "der"] as const).map((lado) => (
            <div key={lado} className="space-y-2">
              <div className="text-xs font-semibold text-muted">{lado === "izq" ? "Izquierda" : "Derecha"}</div>
              {campo(lado) === "imagen" ? (
                <>
                  <ImagenDrop
                    value={b[lado].imagen}
                    onChange={(imagen) => set({ [lado]: { ...b[lado], imagen } } as Partial<Bloque>)}
                    placeholder="URL de la imagen"
                  />
                  <Input
                    fullWidth
                    value={b[lado].url}
                    placeholder="Link"
                    onChange={(e) => set({ [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)}
                  />
                </>
              ) : (
                <>
                  <Input
                    fullWidth
                    value={b[lado].titulo ?? ""}
                    placeholder="Título"
                    onChange={(e) => set({ [lado]: { ...b[lado], titulo: e.target.value } } as Partial<Bloque>)}
                  />
                  <Textarea
                    fullWidth
                    rows={3}
                    value={b[lado].texto ?? ""}
                    placeholder="Texto"
                    onChange={(e) => set({ [lado]: { ...b[lado], texto: e.target.value } } as Partial<Bloque>)}
                  />
                  <Input
                    fullWidth
                    value={b[lado].url}
                    placeholder="Link (opcional)"
                    onChange={(e) => set({ [lado]: { ...b[lado], url: e.target.value } } as Partial<Bloque>)}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      );
    }

    case "video":
      return (
        <div className="space-y-3">
          <ImagenDrop value={b.imagen} onChange={(imagen) => set({ imagen })} placeholder="URL de la miniatura (imagen)" />
          <Input
            label="URL del video"
            fullWidth
            value={b.url}
            placeholder="https://youtube.com/…"
            onChange={(e) => set({ url: e.target.value })}
            hint="Ningún cliente de mail reproduce video adentro: se dibuja la miniatura con el ▶ y el click abre el link."
          />
        </div>
      );

    case "redes":
      return (
        <div className="space-y-2">
          {b.links.map((l, k) => (
            <div key={k} className="flex items-end gap-2">
              {/* Selector y no texto libre: el icono se resuelve por el nombre,
                  así que "IG" o "insta" quedarían sin dibujar. La opción "Otra"
                  deja escribir una red sin icono — sale en texto, como antes. */}
              {redConIcono(l.red) || !l.red ? (
                <Select
                  label={k === 0 ? "Red" : undefined}
                  className="w-32"
                  value={redConIcono(l.red)?.nombre ?? ""}
                  onChange={(e) =>
                    set({ links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })
                  }
                >
                  <option value="">Elegí una…</option>
                  {REDES.map((r) => (
                    <option key={r.slug} value={r.nombre}>
                      {r.nombre}
                    </option>
                  ))}
                  <option value="Otra">Otra (sin icono)</option>
                </Select>
              ) : (
                <Input
                  label={k === 0 ? "Red" : undefined}
                  className="w-32"
                  value={l.red}
                  placeholder="Nombre"
                  hint={k === b.links.length - 1 ? "Sin icono: sale el nombre en texto." : undefined}
                  onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, red: e.target.value } : x)) })}
                />
              )}
              <Input
                label={k === 0 ? "URL" : undefined}
                fullWidth
                value={l.url}
                placeholder="https://…"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })}
              />
              <button
                type="button"
                onClick={() => set({ links: b.links.filter((_, j) => j !== k) })}
                aria-label={`Quitar ${l.red || "la red"}`}
                className="mb-2.5 text-danger-foreground transition-opacity hover:opacity-70"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...b.links, { red: "", url: "" }] })}
            className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted"
          >
            + Agregar red
          </button>
        </div>
      );

    case "menu":
      return (
        <div className="space-y-2">
          {b.links.map((l, k) => (
            <div key={k} className="flex items-end gap-2">
              <Input
                label={k === 0 ? "Texto" : undefined}
                className="w-28"
                value={l.texto}
                placeholder="Inicio"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)) })}
              />
              <Input
                label={k === 0 ? "URL" : undefined}
                fullWidth
                value={l.url}
                placeholder="https://…"
                onChange={(e) => set({ links: b.links.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)) })}
              />
              <button
                type="button"
                onClick={() => set({ links: b.links.filter((_, j) => j !== k) })}
                aria-label={`Quitar ${l.texto || "el link"}`}
                className="mb-2.5 text-danger-foreground transition-opacity hover:opacity-70"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...b.links, { texto: "", url: "" }] })}
            className="rounded-lg border border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-muted"
          >
            + Agregar link
          </button>
        </div>
      );

    case "divisor":
      return <p className="text-sm text-muted">Una línea horizontal para separar secciones. No tiene nada que configurar acá; el color y el grosor van en la pestaña Estilo.</p>;

    case "html":
      return (
        <div className="space-y-2">
          <Textarea
            label="HTML"
            fullWidth
            rows={10}
            className="font-mono text-xs"
            value={b.contenido}
            onChange={(e) => set({ contenido: e.target.value })}
            hint="Se pega tal cual, sin ningún chequeo. Es una escotilla de administrador: rompe fácil y sale desde tu dominio."
          />
          <p className="text-xs text-subtle">
            Si la cuenta no tiene este bloque habilitado (Remitentes → Bloque HTML avanzado), no
            se dibuja en el envío aunque quede guardado acá.
          </p>
        </div>
      );
  }
}

/**
 * Color propio del bloque, de los que NO pasan por la cascada.
 *
 * Son los dos `bg` que existen desde antes del motor de estilos (`hero` y
 * `seccion`) y que el renderer usa para calcular la legibilidad del texto de
 * adentro. Quedan como color libre a propósito: moverlos a la cascada es cambiar
 * la forma del Json de todo mail guardado, y eso tiene su propia migración.
 */
function ColorFijo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-border-strong bg-background"
        />
        <span className="w-16 text-xs tabular-nums text-muted">{value}</span>
      </span>
    </label>
  );
}
