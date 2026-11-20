// เมนูค้ำประกันสัญญา (admin only): ไซด์ที่ชนะประมูล (notice_bids) + ข้อมูลสัญญาใน won_contracts
// ตามไฟล์ LG-ตราสาร2570.xlsx (ชีต LG2570 และ ตราสาร2570)
import { createClient } from "npm:@supabase/supabase-js@2";

const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: H });

async function authAdmin(req: Request) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m || m[1].length > 4096) throw new Error("SESSION_REQUIRED");
  const { data: s, error: se } = await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token", m[1].trim()).maybeSingle();
  if (se) throw se;
  if (!s || s.is_active !== true || !s.expires_at || new Date(s.expires_at).getTime() <= Date.now()) throw new Error("SESSION_INVALID");
  const { data: u, error: ue } = await db.from("app_users").select("id,role,is_active,expires_at").eq("id", s.user_id).maybeSingle();
  if (ue) throw ue;
  if (!u || u.is_active !== true || (u.expires_at && new Date(u.expires_at).getTime() <= Date.now())) throw new Error("USER_INACTIVE");
  if (String(u.role || "").toLowerCase() !== "admin") throw new Error("ADMIN_ONLY");
  return u;
}
const text = (v: unknown, max: number) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };
const money = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1e11) throw new Error("INVALID_AMOUNT");
  return Math.round(n * 100) / 100;
};
const date = (v: unknown) => {
  if (v == null || v === "") return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s)) || s < "2000-01-01" || s > "2100-12-31") throw new Error("INVALID_DATE");
  return s;
};
export const CLEAN: Record<string, (v: unknown) => unknown> = {
  pea_name: (v) => text(v, 200), tax_id: (v) => text(v, 20), branch_no: (v) => text(v, 10), address: (v) => text(v, 400),
  contract_no: (v) => text(v, 80), contract_date: date, wage_ex_vat: money, guarantee: money, period: (v) => text(v, 80),
  lg_done: (v) => v === true, stamp_done: (v) => v === true, note: (v) => text(v, 1000),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const user = await authAdmin(req);
    if (Number(req.headers.get("content-length")) > 32768) return json({ error: "INVALID_INPUT" }, 400);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");
    if (action === "list") {
      const year = Number(body?.fiscal_year) || 2570;
      const { data: bids, error } = await db.from("notice_bids").select("id,fiscal_year,seq,zone,site,office,project_no,budget,qty,mid_price,price_bid,bid_date,doc_no,status,note")
        .eq("fiscal_year", year).ilike("status", "%ชนะ%").order("seq", { ascending: true, nullsFirst: false }).order("id").limit(2000);
      if (error) throw error;
      const won = (bids || []).filter((b) => !/ไม่ชนะ|แพ้/.test(String(b.status || "")));
      let contracts: unknown[] = [];
      if (won.length) {
        const r = await db.from("won_contracts").select("*").in("notice_bid_id", won.map((b) => b.id));
        if (r.error) throw r.error;
        contracts = r.data || [];
      }
      return json({ ok: true, items: won, contracts });
    }
    if (action === "save") {
      const id = Number(body?.notice_bid_id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: "INVALID_ID" }, 400);
      const src = body?.row && typeof body.row === "object" ? body.row : {};
      const row: Record<string, unknown> = { notice_bid_id: id, updated_by: user.id, updated_at: new Date().toISOString() };
      for (const k of Object.keys(CLEAN)) if (k in src) row[k] = CLEAN[k](src[k]);
      const { data: bid, error: be } = await db.from("notice_bids").select("id").eq("id", id).maybeSingle();
      if (be) throw be;
      if (!bid) return json({ error: "NOT_FOUND" }, 404);
      // ลำดับในตาราง: the order rows were first saved in, like the Excel file
      const { data: cur, error: ce } = await db.from("won_contracts").select("list_no").eq("notice_bid_id", id).maybeSingle();
      if (ce) throw ce;
      if (!cur?.list_no) {
        const { data: last, error: le } = await db.from("won_contracts").select("list_no").not("list_no", "is", null).order("list_no", { ascending: false }).limit(1).maybeSingle();
        if (le) throw le;
        row.list_no = (Number(last?.list_no) || 0) + 1;
      }
      const { data, error } = await db.from("won_contracts").upsert(row, { onConflict: "notice_bid_id" }).select("*").single();
      if (error) throw error;
      return json({ ok: true, item: data });
    }
    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const status = ["SESSION_REQUIRED", "SESSION_INVALID"].includes(m) ? 401 : ["USER_INACTIVE", "ADMIN_ONLY"].includes(m) ? 403 : ["INVALID_AMOUNT", "INVALID_DATE"].includes(m) ? 400 : 500;
    console.error("won-contract-api", m, e);
    return json({ error: status === 500 ? "SERVER_ERROR" : m }, status);
  }
});
