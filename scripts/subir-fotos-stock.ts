// Sube el pack de fotos de las plantillas a Vercel Blob, bajo `stock/v1/`.
//
// El catálogo de qué fotos son vive en `lib/plantillas/fotos.ts` y es la ÚNICA
// fuente de verdad: este script no decide nada, solo materializa esa tabla.
//
// ⚠️ El token de Blob está en `.env.local`, NO en `.env` (que es el que usan el
// resto de los scripts del repo). Correr:
//
//   node --env-file=.env.local --import tsx scripts/subir-fotos-stock.ts [flags]
//
//   --seco            imprime el plan y no sube nada
//   --bajar           guarda una copia en docs/fotos-stock/ (el respaldo del pack)
//   --forzar          re-sube aunque ya exista (allowOverwrite)
//   --solo <clave>    una sola foto
//
// Es IDEMPOTENTE: la segunda corrida no sube nada y re-verifica las 36 URLs.
//
// 🔑 Y NUNCA borra. Una clave que se saque del catálogo deja el blob huérfano a
// propósito: hay mails ya enviados que la referencian, y esa URL vive en la
// casilla de otra persona.
//
// 🔑 `addRandomSuffix: false` es lo que hace que el pathname sea determinístico, y
// eso es lo que permite RECUPERAR una foto borrada a mano: se re-corre el script,
// vuelve a existir con la misma URL, y hasta los mails viejos se curan solos.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { list, put } from '@vercel/blob';
import {
  CLAVES_FOTO, SLOTS, foto, origenDe, ruta, slotDe, type ClaveFoto,
} from '../lib/plantillas/fotos.ts';

const args = process.argv.slice(2);
const seco = args.includes('--seco');
const bajar = args.includes('--bajar');
const forzar = args.includes('--forzar');
// ⚠️ `indexOf` devuelve -1 cuando la flag no está, y `args[-1 + 1]` es args[0]:
// sin esta guarda, correr `--seco` a secas se leía como `--solo --seco`.
const iSolo = args.indexOf('--solo');
const solo = iSolo === -1 ? undefined : args[iSolo + 1];

const RESPALDO = 'docs/fotos-stock';

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

/**
 * De dónde salen los bytes. El orden importa: el respaldo local le gana a
 * Unsplash. Es lo que hace que el pack sobreviva a que Unsplash despublique una
 * foto — y que dos corridas den byte por byte lo mismo, que es lo que permite
 * comparar el store contra el repo.
 */
async function bytesDe(clave: ClaveFoto): Promise<Buffer> {
  const local = `${RESPALDO}/${clave}.jpg`;
  const tope = SLOTS[slotDe(clave)].tope;

  // ⚠️ El tope se controla ANTES de escribir el respaldo, y también sobre el
  // respaldo que ya existe. La primera versión validaba después de guardar: al
  // recalibrar SLOTS, la copia local pesada le ganaba a Unsplash y el script
  // seguía fallando con el número viejo, sin manera obvia de darse cuenta.
  const pesa = (buf: Buffer) => {
    if (buf.byteLength > tope) {
      throw new Error(
        `${clave} pesa ${kb(buf.byteLength)} y el tope del slot "${slotDe(clave)}" es ${kb(tope)}. ` +
          `Bajá la q en SLOTS (y borrá ${local} si existe) o elegí otra foto.`
      );
    }
    return buf;
  };

  if (existsSync(local)) return pesa(readFileSync(local));

  const res = await fetch(origenDe(clave));
  if (!res.ok) throw new Error(`Unsplash devolvió ${res.status} para ${clave}`);

  const tipo = res.headers.get('content-type') ?? '';
  // ⛔ Si Unsplash devolviera WEBP (pasa cuando se cuela un `auto=format`), lo
  // frenamos acá: Outlook 2016 no dibuja WEBP y la foto sale rota en el mail.
  if (!tipo.startsWith('image/jpeg')) {
    throw new Error(`${clave}: esperaba image/jpeg y vino "${tipo}"`);
  }

  const buf = pesa(Buffer.from(await res.arrayBuffer()));
  if (bajar) {
    mkdirSync(RESPALDO, { recursive: true });
    writeFileSync(local, buf);
  }
  return buf;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'Falta BLOB_READ_WRITE_TOKEN. Ojo: vive en .env.local, no en .env — ' +
        'corré con --env-file=.env.local'
    );
  }

  const claves = solo ? [solo as ClaveFoto] : CLAVES_FOTO;
  if (solo && !CLAVES_FOTO.includes(solo as ClaveFoto)) {
    throw new Error(`"${solo}" no está en el catálogo de lib/plantillas/fotos.ts`);
  }

  // Una sola llamada, no 36 `head()`.
  const { blobs } = await list({ prefix: 'stock/v1/', limit: 1000 });
  const yaEstan = new Map(blobs.map((b) => [b.pathname, b.url]));
  console.log(`En el store hay ${blobs.length} foto(s) bajo stock/v1/.\n`);

  const problemas: string[] = [];
  let subidas = 0;
  let saltadas = 0;

  for (const clave of claves) {
    const path = ruta(clave);
    const esperada = foto(clave);
    const existente = yaEstan.get(path);

    if (existente && !forzar) {
      // Ya está: lo único que queda por verificar es que la URL que el código
      // arma sea la que el store realmente sirve.
      if (existente !== esperada) {
        problemas.push(
          `${clave}: el store la sirve en\n    ${existente}\n  y el código la pide en\n    ${esperada}`
        );
      }
      saltadas++;
      continue;
    }

    if (seco) {
      console.log(`· ${clave.padEnd(22)} ${existente ? 're-subiría' : 'subiría'}  ${path}`);
      continue;
    }

    // Falla ruidoso si se pasa del tope: NO se re-baja con menos calidad. Una
    // foto pesada no cuesta store, cuesta una descarga por destinatario — y el
    // que la manda es un comerciante que no eligió esa foto, la heredó de la
    // plantilla.
    const buf = await bytesDe(clave);

    const blob = await put(path, buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: forzar,
      contentType: 'image/jpeg',
      // Un año. El default de Blob es un mes, y estas fotos no cambian nunca:
      // la miniatura de la galería se baja una vez y no molesta más.
      cacheControlMaxAge: 31_536_000,
    });

    if (blob.url !== esperada) {
      problemas.push(
        `${clave}: Blob la publicó en\n    ${blob.url}\n  y el código la pide en\n    ${esperada}`
      );
    }

    console.log(`✓ ${clave.padEnd(22)} ${kb(buf.byteLength).padStart(7)}  ${blob.url}`);
    subidas++;
  }

  if (seco) {
    console.log('\n(--seco: no se subió nada)');
    return;
  }

  console.log(`\n${subidas} subida(s), ${saltadas} ya estaban.`);

  // 🔴 Este es el chequeo que justifica que el script exista. Si BASE_FOTOS
  // tuviera el store id equivocado, se descubre acá y no con 21 plantillas
  // mostrando el ícono roto en la casilla de un cliente.
  if (problemas.length) {
    console.error(`\n✗ ${problemas.length} URL(s) no coinciden con BASE_FOTOS:\n`);
    problemas.forEach((p) => console.error(`  ${p}\n`));
    console.error('Corregí BASE_FOTOS en lib/plantillas/fotos.ts y volvé a correr.');
    process.exit(1);
  }

  console.log('✓ Las URLs del store coinciden con las que arma foto().');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
