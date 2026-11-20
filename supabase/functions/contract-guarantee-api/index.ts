// เมนูค้ำประกันสัญญา (admin only): สัญญาจ้างกับ กฟฟ. แต่ละแห่ง เงินค้ำประกัน (LG) และตราสาร (อากรแสตมป์).
// actions: list, save (เพิ่ม/แก้ไข), delete (ซ่อนรายการ ไม่ลบจริง)
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
const text = (v: unknown, max = 200) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };
const date = (v: unknown) => { const s = String(v ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null; };
const money = (v: unknown) => { if (v === null || v === undefined || String(v).trim() === "") return null; const n = Number(String(v).replace(/,/g, "")); return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : NaN; };
const cleanId = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
const COLS = "id,contract_year,seq,pea_office,tax_id,branch_no,address,contract_no,contract_date,wage_ex_vat,guarantee_amount,period_start,period_end,lg_done,lg_no,lg_bank,lg_date,stamp_done,stamp_date,note,updated_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const user = await authAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data, error } = await db.from("contract_guarantees").select(COLS).eq("is_active", true)
        .order("contract_year", { ascending: false }).order("seq", { ascending: true, nullsFirst: false }).order("id").limit(5000);
      if (error) throw error;
      return json({ ok: true, items: data || [] });
    }

    if (action === "save") {
      const src = body?.item && typeof body.item === "object" ? body.item : {};
      const id = cleanId(src.id);
      const year = Number(src.contract_year);
      if (!Number.isInteger(year) || year < 2500 || year > 2700) return json({ error: "YEAR_INVALID" }, 400);
      const wage = money(src.wage_ex_vat), lg = money(src.guarantee_amount);
      if (Number.isNaN(wage) || Number.isNaN(lg)) return json({ error: "AMOUNT_INVALID" }, 400);
      const seq = src.seq === "" || src.seq == null ? null : Number(src.seq);
      const row = {
        contract_year: year,
        seq: Number.isInteger(seq) && (seq as number) > 0 ? seq : null,
        pea_office: text(src.pea_office, 200),
        tax_id: text(src.tax_id, 20), branch_no: text(src.branch_no, 10), address: text(src.address, 400),
        contract_no: text(src.contract_no, 80), contract_date: date(src.contract_date),
        wage_ex_vat: wage, guarantee_amount: lg,
        period_start: date(src.period_start), period_end: date(src.period_end),
        lg_done: src.lg_done === true, lg_no: text(src.lg_no, 80), lg_bank: text(src.lg_bank, 120), lg_date: date(src.lg_date),
        stamp_done: src.stamp_done === true, stamp_date: date(src.stamp_date),
        note: text(src.note, 1000),
        updated_by: user.id, updated_at: new Date().toISOString(),
      };
      if (!row.pea_office) return json({ error: "OFFICE_REQUIRED" }, 400);
      if (id) {
        const { data, error } = await db.from("contract_guarantees").update(row).eq("id", id).eq("is_active", true).select(COLS).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "NOT_FOUND" }, 404);
        return json({ ok: true, item: data });
      }
      if (row.seq == null) {
        const { data: last } = await db.from("contract_guarantees").select("seq").eq("contract_year", year).eq("is_active", true).order("seq", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
        row.seq = (Number(last?.seq) || 0) + 1;
      }
      const { data, error } = await db.from("contract_guarantees").insert({ ...row, created_by: user.id }).select(COLS).single();
      if (error) throw error;
      return json({ ok: true, item: data, created: true });
    }

    if (action === "delete") {
      const id = cleanId(body?.id);
      if (!id) return json({ error: "ID_REQUIRED" }, 400);
      const { error } = await db.from("contract_guarantees").update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as any)?.message || e);
    const auth = ["SESSION_REQUIRED", "SESSION_INVALID", "USER_INACTIVE"].includes(msg);
    console.error("contract-guarantee-api", msg);
    return json({ error: msg }, auth ? 401 : msg === "ADMIN_ONLY" ? 403 : 500);
  }
});
