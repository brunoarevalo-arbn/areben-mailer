// Cliente de la API de Tiendanube.
// Docs: https://tiendanube.github.io/api-documentation/
const TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';
const API_BASE = 'https://api.tiendanube.com/v1';
const USER_AGENT = 'Areben Mailer (brunoarevalo@arebensrl.com)';

export interface TnToken {
  access_token: string;
  token_type: string;
  scope: string;
  user_id: number; // = store_id
}

/** Canjea el `code` del OAuth por un access token (los tokens de TN no expiran). */
export async function exchangeCode(code: string): Promise<TnToken> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.TN_CLIENT_ID,
      client_secret: process.env.TN_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`TN token exchange falló: ${res.status} ${JSON.stringify(json)}`);
  return json as TnToken;
}

/**
 * El endpoint `store`, con los campos que usamos. Hay más (redes, plan, tema).
 *
 * ⚠️ `name` y `description` son multiidioma (`{"es":"ZATTIA CO"}`) y `logo`
 * viene **sin protocolo** (`//d1a9….cloudfront.net/…`). Ver `leerStore`.
 */
export interface TnStore {
  name?: string | Record<string, string>;
  email?: string;
  contact_email?: string;
  logo?: string | null;
  /** "https://zattia.com.ar" — el dominio propio si lo hay, con protocolo. */
  url_with_protocol?: string;
  /** "zattiaco.mitiendanube.com" — el de siempre, sin protocolo. */
  original_domain?: string;
  main_language?: string;
  business_name?: string;
  /** Domicilio legal de la empresa ("PJE HUTCHINSON 3869"). */
  business_address?: string | null;
  /** Domicilio del local ("Santa Fe 1671"). */
  address?: string | null;
}

/** Los datos de la tienda que le sirven al mailer, ya normalizados. */
export interface DatosTienda {
  nombre: string;
  email: string;
  /** URL absoluta y con `https:`. Vacío si TN no tiene logo cargado. */
  logo: string;
  /** Sitio público, sin barra final. */
  url: string;
  /** Idioma principal ("es"), para el `lang` del mail. */
  idioma: string;
  /** Razón social + domicilio, para el pie del mail. */
  direccion: string;
}

/**
 * Trae y normaliza `/store`. Devuelve `null` si TN no contesta.
 *
 * Es **una sola** llamada: antes el callback pedía `store` dos veces (una para
 * el nombre y otra para el mail) y se quedaba igual con dos de los diez campos
 * que TN manda. El límite de la API de TN se comparte con el monitor y con
 * Resorty, así que una llamada de menos no es un detalle.
 */
export async function leerStore(storeId: string, token: string): Promise<DatosTienda | null> {
  try {
    const { data } = await tnGet<TnStore>(storeId, token, 'store');
    return normalizarStore(data);
  } catch {
    return null; // sin datos de tienda se sigue igual: son todos opcionales
  }
}

/** La parte pura de `leerStore`: lo que TN devuelve → lo que el mailer usa. */
export function normalizarStore(data: TnStore | null | undefined): DatosTienda {
  const n = data?.name;
  const nombre = (typeof n === 'string' ? n : n ? Object.values(n)[0] : '')?.trim() ?? '';

  // El logo llega protocolo-relativo. En un `<img>` de mail eso es una imagen
  // rota: el cliente de correo no tiene página desde la cual heredar el `https:`.
  const logoCrudo = (data?.logo ?? '').trim();
  const logo = logoCrudo.startsWith('//') ? `https:${logoCrudo}` : logoCrudo;

  const url = (data?.url_with_protocol?.trim() || (data?.original_domain?.trim() ? `https://${data.original_domain.trim()}` : ''))
    .replace(/\/+$/, '');

  // Razón social y domicilio legal, que es lo que corresponde en el pie de un
  // mail comercial. `address` (el del local) es el respaldo.
  const direccion = [data?.business_name?.trim(), (data?.business_address ?? data?.address ?? '').trim()]
    .filter(Boolean)
    .join(' · ');

  return {
    nombre,
    email: (data?.email ?? data?.contact_email ?? '').trim().toLowerCase(),
    logo,
    url,
    idioma: (data?.main_language ?? '').trim().toLowerCase(),
    direccion,
  };
}

/** GET a la API de una tienda. */
export async function tnGet<T = unknown>(
  storeId: string,
  token: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<{ data: T; res: Response }> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${API_BASE}/${storeId}/${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authentication: `bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TN GET ${path} → ${res.status}: ${text}`);
  }
  return { data: (await res.json()) as T, res };
}

/** POST a la API de una tienda. */
export async function tnPost<T = unknown>(
  storeId: string,
  token: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}/${storeId}/${path}`, {
    method: "POST",
    headers: {
      Authentication: `bearer ${token}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TN POST ${path} → ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** DELETE a la API de una tienda. */
export async function tnDelete(storeId: string, token: string, path: string): Promise<void> {
  await fetch(`${API_BASE}/${storeId}/${path}`, {
    method: "DELETE",
    headers: { Authentication: `bearer ${token}`, "User-Agent": USER_AGENT },
  });
}

/** Itera todas las páginas de un recurso (customers, orders, products…). */
export async function* tnPaginate<T = unknown>(
  storeId: string,
  token: string,
  path: string,
  params: Record<string, string | number> = {},
  perPage = 200,
): AsyncGenerator<T[]> {
  let page = 1;
  while (true) {
    const { data } = await tnGet<T[]>(storeId, token, path, {
      ...params,
      page,
      per_page: perPage,
    });
    if (!Array.isArray(data) || data.length === 0) break;
    yield data;
    if (data.length < perPage) break;
    page += 1;
  }
}

/**
 * URL de instalación/autorización para que el dueño de la tienda conecte la app.
 * `cuentaId` viaja en `state` para vincular la tienda a una cuenta que todavía no
 * tiene ninguna (ver `app/api/tn/callback`). Sin él, la instalación crea su cuenta.
 */
export function authorizeUrl(cuentaId?: string): string {
  const base = `https://www.tiendanube.com/apps/${process.env.TN_CLIENT_ID}/authorize`;
  return cuentaId ? `${base}?state=${encodeURIComponent(cuentaId)}` : base;
}
