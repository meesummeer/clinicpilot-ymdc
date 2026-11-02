// ClinicPilot-YMDC cloud backup Worker.
// POST /upload (write-once) and GET /list, both admin-only. The admin check
// asks the database itself (rpc current_role_name, the same function the
// app's RLS uses) using the caller's own Supabase token. No secrets here.

const MAX_BYTES = 90 * 1024 * 1024;
const FILENAME_RE = /^ClinicPilot-YMDC-backup-(\d{4})-(\d{2})-(\d{2})_\d{4}\.zip$/;
const SHA256_RE = /^[0-9a-fA-F]{64}$/;

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}

async function isAdmin(env, token) {
  let res;
  try {
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/current_role_name`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch {
    return { status: 401 };
  }
  if (res.status !== 200) return { status: 401 };
  let role;
  try {
    role = await res.json();
  } catch {
    return { status: 401 };
  }
  return role === 'admin' ? { status: 200 } : { status: 403 };
}

async function handleUpload(request, env, cors) {
  const length = Number(request.headers.get('Content-Length'));
  if (!request.headers.get('Content-Length') || !Number.isFinite(length) || length <= 0 || length > MAX_BYTES) {
    return json({ error: 'Content-Length is required and must be at most 90 MB' }, 413, cors);
  }
  if ((request.headers.get('Content-Type') || '').split(';')[0].trim() !== 'application/zip') {
    return json({ error: 'Content-Type must be application/zip' }, 415, cors);
  }
  const sha256 = request.headers.get('X-Sha256') || '';
  if (!SHA256_RE.test(sha256)) {
    return json({ error: 'X-Sha256 must be 64 hex characters' }, 400, cors);
  }
  const filename = request.headers.get('X-Filename') || '';
  const m = FILENAME_RE.exec(filename);
  if (!m) {
    return json({ error: 'X-Filename is not a valid backup file name' }, 400, cors);
  }
  const key = `backups/${m[1]}/${m[2]}/${filename}`;

  // Never overwrite: check first, and also make the put itself conditional
  // so two simultaneous uploads can't both win.
  if (await env.BACKUPS.head(key)) {
    return json({ error: 'A backup with this name already exists' }, 409, cors);
  }

  let object;
  try {
    object = await env.BACKUPS.put(key, request.body, {
      sha256: sha256.toLowerCase(),
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: { uploadedAt: new Date().toISOString() },
      onlyIf: { etagDoesNotMatch: '*' },
    });
  } catch (err) {
    const msg = String((err && err.message) || '');
    if (/checksum|digest|sha-?256|did not match/i.test(msg)) {
      return json({ error: 'Checksum mismatch: the upload was not saved' }, 422, cors);
    }
    return json({ error: 'Upload failed' }, 500, cors);
  }
  if (object === null) {
    return json({ error: 'A backup with this name already exists' }, 409, cors);
  }
  return json({ key, size: object.size }, 201, cors);
}

async function handleList(env, cors) {
  const items = [];
  let cursor;
  do {
    const page = await env.BACKUPS.list({ prefix: 'backups/', cursor });
    page.objects.forEach((o) => items.push({ key: o.key, size: o.size, uploaded: o.uploaded.toISOString() }));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  items.sort((a, b) => (a.uploaded < b.uploaded ? 1 : a.uploaded > b.uploaded ? -1 : 0));
  return json(items, 200, cors);
}

export default {
  async fetch(request, env) {
    try {
      const origin = request.headers.get('Origin');
      const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
      let cors = {};
      if (origin) {
        if (!allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, {});
        cors = {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Sha256, X-Filename',
          'Access-Control-Max-Age': '600',
          Vary: 'Origin',
        };
      }

      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

      const auth = request.headers.get('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      if (!token) return json({ error: 'Authorization required' }, 401, cors);
      const who = await isAdmin(env, token);
      if (who.status === 401) return json({ error: 'Invalid or expired session' }, 401, cors);
      if (who.status === 403) return json({ error: 'Admins only' }, 403, cors);

      const { pathname } = new URL(request.url);
      if (request.method === 'POST' && pathname === '/upload') return await handleUpload(request, env, cors);
      if (request.method === 'GET' && pathname === '/list') return await handleList(env, cors);
      return json({ error: 'Not found' }, 404, cors);
    } catch {
      return json({ error: 'Internal error' }, 500, {});
    }
  },
};
