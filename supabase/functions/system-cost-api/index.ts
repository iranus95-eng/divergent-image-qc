import { createClient } from 'npm:@supabase/supabase-js@2.95.3';

const headers = {
  'Access-Control-Allow-Origin': 'https://divergent-image-qc.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

async function authAdmin(req: Request) {
  const token = (req.headers.get('Authorization') || '')
    .match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!token) throw new Error('SESSION_REQUIRED');
  const { data: session, error } = await db
    .from('app_sessions')
    .select('user_id,is_active,expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  if (
    !session?.is_active ||
    !session.expires_at ||
    Date.parse(session.expires_at) <= Date.now()
  )
    throw new Error('SESSION_INVALID');
  const { data: user, error: userError } = await db
    .from('app_users')
    .select('id,role,is_active,expires_at')
    .eq('id', session.user_id)
    .maybeSingle();
  if (userError) throw userError;
  if (
    !user?.is_active ||
    (user.expires_at && Date.parse(user.expires_at) <= Date.now())
  )
    throw new Error('USER_INACTIVE');
  if (String(user.role).toLowerCase() !== 'admin')
    throw new Error('ADMIN_ONLY');
  return user;
}

const validKey = (key: unknown): key is string =>
  typeof key === 'string' &&
  /^(?:site-(?:bid-prices|bid-draft|operating|monthly-buys|equipment)-[a-z]+|epc:electricity-notice:v1(?::site:[a-z0-9-]+)?|scenario:[a-zA-Z0-9_-]+)$/.test(
    key,
  );

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const user = await authAdmin(req);
    const text = await req.text();
    if (text.length > 200_000) return json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
    const body = JSON.parse(text);
    if (body.action === 'list') {
      const { data, error } = await db
        .from('system_cost_records')
        .select('key,value,revision,updated_at')
        .order('key')
        .limit(1000);
      if (error) throw error;
      return json({ items: data });
    }
    if (body.action === 'save') {
      if (
        !validKey(body.key) ||
        !Number.isSafeInteger(body.revision) ||
        body.revision < 0 ||
        !('value' in body) ||
        JSON.stringify(body.value).length > 100_000
      )
        return json({ error: 'INVALID_RECORD' }, 400);
      const { data, error } = await db.rpc('save_system_cost_record', {
        p_key: body.key,
        p_value: body.value,
        p_revision: body.revision,
        p_user: user.id,
      });
      if (error) throw error;
      if (!data?.length) return json({ error: 'REVISION_CONFLICT' }, 409);
      return json({ item: data[0] });
    }
    return json({ error: 'UNKNOWN_ACTION' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = ['SESSION_REQUIRED', 'SESSION_INVALID'].includes(message)
      ? 401
      : ['USER_INACTIVE', 'ADMIN_ONLY'].includes(message)
        ? 403
        : e instanceof SyntaxError
          ? 400
          : 500;
    if (status === 500) console.error('system-cost-api request failed');
    return json({ error: status === 500 ? 'SERVER_ERROR' : message }, status);
  }
});
