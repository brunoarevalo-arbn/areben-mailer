// Invariantes del reparto en tramos. Lógica pura: sin base ni red.
//
// Lo que se custodia acá es que **nadie se pierda y nadie se duplique**. Un tramo
// es una lista a la que después se le manda un mail de verdad: un contacto que
// aparece en dos tramos recibe dos mails, y uno que no aparece en ninguno queda
// invisible para siempre sin que nada se ponga rojo.
//
// Correr:  node --import tsx scripts/probar-tramos.ts
import {
  BUZONES,
  agruparPorBuzon,
  buzonDe,
  esNombreDeTramo,
  nombreTramo,
  planTramos,
  resumenPorBuzon,
} from '../lib/contactos/tramos.ts';

const errores: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) errores.push(msg);
};

// ─── 1. A qué buzón pega cada dominio ────────────────────────────────────────
{
  ok(buzonDe('pepe@gmail.com') === 'gmail', 'gmail.com → gmail');
  ok(buzonDe('pepe@googlemail.com') === 'gmail', 'googlemail.com → gmail');
  ok(buzonDe('PEPE@GMAIL.COM') === 'gmail', 'las mayúsculas no cambian el buzón');
  ok(buzonDe('pepe@hotmail.com') === 'microsoft', 'hotmail.com → microsoft');
  ok(buzonDe('pepe@hotmail.com.ar') === 'microsoft', 'hotmail.com.ar → microsoft (la variante de país cuenta)');
  ok(buzonDe('pepe@outlook.es') === 'microsoft', 'outlook.es → microsoft');
  ok(buzonDe('pepe@live.com.mx') === 'microsoft', 'live.com.mx → microsoft');
  ok(buzonDe('pepe@yahoo.com.ar') === 'yahoo', 'yahoo.com.ar → yahoo');
  ok(buzonDe('pepe@aol.com') === 'yahoo', 'AOL viaja con Yahoo: misma infraestructura, mismo filtro');
  ok(buzonDe('pepe@bdiaccesorios.com.ar') === 'otros', 'un dominio propio cae en otros');
  // La heurística es por dominio, no por MX: no adivina el Workspace ajeno y no
  // se deja engañar por un subdominio que se llama igual.
  ok(buzonDe('pepe@correo.gmail.empresa.com') === 'otros', 'un subdominio corporativo NO es Gmail');
  ok(buzonDe('sin-arroba') === 'otros', 'un mail roto no explota: cae en otros');
  ok(buzonDe('pepe@') === 'otros', 'un mail sin dominio no explota');
}

// ─── 2. El reparto no pierde ni duplica a nadie ──────────────────────────────
{
  const contactos = Array.from({ length: 1234 }, (_, i) => ({
    id: `c${i}`,
    email: `p${i}@${['gmail.com', 'hotmail.com', 'yahoo.com', 'empresa.com.ar'][i % 4]}`,
  }));
  const tramos = planTramos(contactos, { escalera: [200, 500, 1000] });
  const asignados = tramos.flatMap((t) => t.contactos.map((c) => c.id));

  ok(asignados.length === contactos.length, 'la suma de los tramos es la lista entera');
  ok(new Set(asignados).size === asignados.length, 'nadie aparece en dos tramos');
  ok(
    tramos.every((t) => t.contactos.every((c) => buzonDe(c.email) === t.buzon)),
    'un tramo tiene un solo buzón (si rebota, se sabe quién lo rechazó)',
  );
  ok(
    tramos.every((t, i) => t.n === i + 1),
    'los tramos se numeran corridos desde 1',
  );
}

// ─── 3. La escalera sube y el último peldaño se repite ───────────────────────
{
  const gmail = Array.from({ length: 4000 }, (_, i) => ({ id: `g${i}`, email: `p${i}@gmail.com` }));
  const tramos = planTramos(gmail, { escalera: [200, 500, 1000] });
  const tamanos = tramos.map((t) => t.contactos.length);
  ok(tamanos[0] === 200 && tamanos[1] === 500 && tamanos[2] === 1000, 'los primeros tres peldaños son los pedidos');
  ok(
    tamanos.slice(3, -1).every((n) => n === 1000),
    'pasado el último peldaño, el tamaño se sostiene (no vuelve a empezar)',
  );
  ok(tamanos.reduce((a, b) => a + b, 0) === 4000, 'el último tramo se queda con el resto, sea del tamaño que sea');
}

// ─── 4. El orden de envío es por buzón ───────────────────────────────────────
// 🔴 La razón de ser de todo el archivo: Gmail primero, Microsoft último. Al
// revés se estrena una IP fría contra el buzón que ya nos mandó a spam.
{
  const mezcla = [
    { id: 'm1', email: 'a@hotmail.com' },
    { id: 'g1', email: 'a@gmail.com' },
    { id: 'o1', email: 'a@empresa.com' },
    { id: 'y1', email: 'a@yahoo.com' },
  ];
  const tramos = planTramos(mezcla, { escalera: [1] });
  ok(
    tramos.map((t) => t.buzon).join(',') === 'gmail,yahoo,otros,microsoft',
    'el orden por defecto es gmail → yahoo → otros → microsoft',
  );
  ok(tramos.at(-1)!.buzon === 'microsoft', 'Microsoft es SIEMPRE el último tramo');
}

// ─── 5. Un buzón que no se nombra en --orden no desaparece ───────────────────
// Sin esto, `--orden=gmail` mandaría solo a Gmail y el resto de la lista quedaría
// sin tramo, en silencio: no se pierde por error, se pierde para siempre.
{
  const mezcla = [
    { id: 'g', email: 'a@gmail.com' },
    { id: 'm', email: 'a@hotmail.com' },
  ];
  const tramos = planTramos(mezcla, { escalera: [1], orden: ['gmail'] });
  ok(tramos.length === 2, 'el buzón que no se nombró igual recibe su tramo, al final');
}

// ─── 6. Correrlo de nuevo continúa; no vuelve a empezar ──────────────────────
// Es lo que hace seguro re-correr el script cuando la lista creció.
{
  const nuevos = Array.from({ length: 300 }, (_, i) => ({ id: `n${i}`, email: `n${i}@gmail.com` }));
  const tramos = planTramos(nuevos, { escalera: [10, 50, 200], desdeTramo: 4, desdePeldano: 3 });
  ok(tramos[0].n === 4, 'la numeración sigue donde quedó');
  ok(tramos[0].contactos.length === 200, 'la escalera sigue en su peldaño: la IP ya está caliente');
}

// ─── 7. El nombre ordena el envío y se puede reconocer después ───────────────
{
  ok(nombreTramo('Nuby', 3, 'gmail') === 'Nuby — T03 gmail', 'el número va en dos dígitos');
  const nombres = [nombreTramo('N', 10, 'gmail'), nombreTramo('N', 2, 'gmail')].sort();
  ok(nombres[0] === 'N — T02 gmail', 'el orden alfabético del panel es el orden de envío (T02 antes que T10)');
  ok(esNombreDeTramo('Nuby', 'Nuby — T03 gmail'), 'reconoce sus propias listas');
  ok(!esNombreDeTramo('Nuby', 'Nuby — suscriptores'), 'NO confunde la lista origen con un tramo suyo');
  ok(!esNombreDeTramo('Nuby', 'Otra — T03 gmail'), 'no se lleva puesto el tramo de otro prefijo');
  // El prefijo sale del nombre de una lista, que lo escribe una persona: un
  // punto o un paréntesis adentro no puede convertirse en un comodín.
  ok(esNombreDeTramo('BDI (2026)', 'BDI (2026) — T01 gmail'), 'un prefijo con paréntesis no rompe el regex');
  ok(!esNombreDeTramo('a.c', 'abc — T01 gmail'), 'el punto del prefijo no matchea cualquier letra');
}

// ─── 8. Agrupar y resumir hablan del mismo reparto ───────────────────────────
{
  const contactos = [
    { email: 'a@gmail.com' },
    { email: 'b@gmail.com' },
    { email: 'c@hotmail.com' },
  ];
  const resumen = resumenPorBuzon(contactos);
  ok(resumen.gmail === 2 && resumen.microsoft === 1 && resumen.yahoo === 0, 'el resumen cuenta por buzón');
  ok(
    BUZONES.every((b) => agruparPorBuzon(contactos).get(b)!.length === resumen[b]),
    'agrupar y resumir no se pueden contradecir',
  );
  ok(
    agruparPorBuzon(contactos).get('gmail')!.map((c) => c.email).join() === 'a@gmail.com,b@gmail.com',
    'el orden de entrada se preserva (dos corridas dan el mismo reparto)',
  );
}

console.log();
if (errores.length) {
  for (const e of errores) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log('✅ Invariantes de los tramos OK.\n');
