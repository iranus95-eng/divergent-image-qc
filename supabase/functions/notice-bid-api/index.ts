// เมนูตารางประมูลแจ้งเตือน (admin only): one row per office's notice-delivery job of the year,
// filled from the announcement / TOR PDFs in the browser and edited cell by cell.
import { createClient } from "npm:@supabase/supabase-js@2";

const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: H });

async function authAdmin(req: Request) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("SESSION_REQUIRED");
  const { data: s, error: se } = await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token", m[1].trim()).maybeSingle();
  if (se) throw se;
  if (!s || s.is_active !== true || !s.expires_at || new Date(s.expires_at).getTime() <= Date.now()) throw new Error("SESSION_INVALID");
  const { data: u, error: ue } = await db.from("app_users").select("id,username,role,is_active,expires_at").eq("id", s.user_id).maybeSingle();
  if (ue) throw ue;
  if (!u || u.is_active !== true || (u.expires_at && new Date(u.expires_at).getTime() <= Date.now())) throw new Error("USER_INACTIVE");
  if (String(u.role || "").toLowerCase() !== "admin") throw new Error("ADMIN_ONLY");
  return u;
}
const cleanId = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const num = (v: unknown, d = 4) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null;
};
const text = (v: unknown, max = 200) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };
const date = (v: unknown) => { const s = String(v ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null; };
// only the columns sent are changed, so typing one cell never clears another
const CLEAN: Record<string, (v: unknown) => unknown> = {
  zone: (v) => text(v, 20), site: (v) => text(v, 120), office: (v) => text(v, 160), project_no: (v) => text(v, 40),
  budget: (v) => num(v, 2), qty: (v) => { const n = num(v, 0); return n == null ? null : Math.max(0, Math.min(n, 2_000_000_000)); },
  mid_price: (v) => num(v), price_prev: (v) => num(v), price_bid: (v) => num(v),
  bid_date: date, announce_date: date, bid_time: (v) => text(v, 40), method: (v) => text(v, 40), doc_no: (v) => text(v, 80),
  status: (v) => text(v, 60), note: (v) => text(v, 1000), seq: (v) => num(v, 0), fiscal_year: (v) => num(v, 0),
  source: (v) => (v && typeof v === "object" ? v : {}),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const user = await authAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");
    const year = Number(body?.fiscal_year) || 2570;

    if (action === "list") {
      const { data, error } = await db.from("notice_bids").select("*").eq("fiscal_year", year)
        .order("seq", { ascending: true, nullsFirst: false }).order("id", { ascending: true }).limit(2000);
      if (error) throw error;
      return json({ ok: true, items: data || [] });
    }

    if (action === "save") {
      const id = cleanId(body?.id);
      const src = body?.row && typeof body.row === "object" ? body.row : {};
      const row: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
      for (const k of Object.keys(CLEAN)) if (k in src) row[k] = CLEAN[k](src[k]);
      if ("site" in row && !row.site) return json({ error: "SITE_REQUIRED" }, 400);
      if (id) {
        const { data, error } = await db.from("notice_bids").update(row).eq("id", id).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "NOT_FOUND" }, 404);
        return json({ ok: true, item: data });
      }
      if (!row.site) return json({ error: "SITE_REQUIRED" }, 400);
      if (row.seq == null) {
        const { data: last } = await db.from("notice_bids").select("seq").eq("fiscal_year", row.fiscal_year || year)
          .order("seq", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
        row.seq = (Number(last?.seq) || 0) + 1;
      }
      const { data, error } = await db.from("notice_bids").insert({ fiscal_year: year, ...row, created_by: user.id }).select("*").single();
      if (error) throw error;
      return json({ ok: true, item: data, created: true });
    }

    if (action === "delete") {
      const id = cleanId(body?.id);
      if (!id) return json({ error: "INVALID_ID" }, 400);
      const { error } = await db.from("notice_bids").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true, id });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const status = ["SESSION_REQUIRED", "SESSION_INVALID"].includes(m) ? 401 : ["USER_INACTIVE", "ADMIN_ONLY"].includes(m) ? 403 : 500;
    console.error("notice-bid-api", m, e);
    return json({ error: status === 500 ? "SERVER_ERROR" : m }, status);
  }
});
