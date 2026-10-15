// เมนูเสนอราคาแจ้งเตือน (admin only): keeps the original quotation PDF and the quantities / unit prices typed,
// so finished work can be reopened, printed again or changed later.
import { createClient } from "npm:@supabase/supabase-js@2";

const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: H });
const MAX_PDF_B64 = 12_000_000;

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
const cleanNum = (v: unknown) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const cleanId = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const user = await authAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data, error } = await db.from("quote_notices").select("id,title,file_name,total_amount,created_at,updated_at,created_by,updated_by")
        .order("updated_at", { ascending: false }).limit(Math.min(Number(body?.limit) || 200, 1000));
      if (error) throw error;
      const ids = [...new Set((data || []).flatMap((d: any) => [d.created_by, d.updated_by]).filter(Boolean))];
      const names = new Map<number, string>();
      if (ids.length) {
        const { data: us } = await db.from("app_users").select("id,username").in("id", ids);
        for (const x of us || []) names.set(Number(x.id), String(x.username || ""));
      }
      return json({ ok: true, items: (data || []).map((d: any) => ({ ...d, updated_by_name: names.get(Number(d.updated_by)) || null })) });
    }

    if (action === "get") {
      const id = cleanId(body?.id);
      if (!id) return json({ error: "INVALID_ID" }, 400);
      const { data, error } = await db.from("quote_notices").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "NOT_FOUND" }, 404);
      return json({ ok: true, item: data });
    }

    if (action === "save") {
      const id = cleanId(body?.id);
      const row: Record<string, unknown> = {
        title: String(body?.title || "").trim().slice(0, 300) || "ใบเสนอราคา",
        state: body?.state && typeof body.state === "object" ? body.state : {},
        total_amount: cleanNum(body?.total_amount),
        updated_by: user.id, updated_at: new Date().toISOString(),
      };
      if (body?.file_name != null) row.file_name = String(body.file_name).slice(0, 300);
      if (body?.pdf_b64 != null) {
        const pdf = String(body.pdf_b64);
        if (!/^[A-Za-z0-9+/=]+$/.test(pdf) || !pdf.startsWith("JVBER")) return json({ error: "INVALID_PDF" }, 400);
        if (pdf.length > MAX_PDF_B64) return json({ error: "PDF_TOO_LARGE" }, 413);
        row.pdf_b64 = pdf;
      }
      if (id) {
        const { data, error } = await db.from("quote_notices").update(row).eq("id", id).select("id,updated_at").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "NOT_FOUND" }, 404);
        return json({ ok: true, item: data });
      }
      if (!row.pdf_b64) return json({ error: "PDF_REQUIRED" }, 400);
      const { data, error } = await db.from("quote_notices").insert({ ...row, created_by: user.id }).select("id,updated_at").single();
      if (error) throw error;
      return json({ ok: true, item: data, created: true });
    }

    if (action === "delete") {
      const id = cleanId(body?.id);
      if (!id) return json({ error: "INVALID_ID" }, 400);
      const { error } = await db.from("quote_notices").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true, id });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const status = ["SESSION_REQUIRED", "SESSION_INVALID"].includes(m) ? 401 : ["USER_INACTIVE", "ADMIN_ONLY"].includes(m) ? 403 : 500;
    console.error("quote-notice-api", m, e);
    return json({ error: status === 500 ? "SERVER_ERROR" : m }, status);
  }
});
