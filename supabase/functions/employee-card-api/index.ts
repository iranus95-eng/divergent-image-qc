// เมนูทำบัตรพนักงาน (admin only): บัตรประจำตัวผู้รับจ้างการไฟฟ้าส่วนภูมิภาค ปฏิบัติงานเกี่ยวกับมิเตอร์ ตาม TOR ข้อ 4.1 (7).
// รายชื่อมาจากข้อมูลเงินเดือน (พนักงานภาคสนาม employee_payroll_profiles + สตาฟ staff_payroll_monthly_drafts เดือนล่าสุด);
// แต่ละบัตรมีเลขที่ XXX/ปี (เลขรันต่อปี พ.ศ.) และรูปถ่ายย่อเก็บใน employee_cards.photo_b64.
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
const cleanId = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
// typos in the payroll sheet: doubled vowel marks (ชุุมพวง, ภููเขียว) and ุ typed before ั (หนองบุัวระเหว)
export const fixThai = (s: unknown) => String(s ?? "").trim().replace(/ุั/g, "ั").replace(/([ั-ฺ็-๎])\1+/g, "$1");
const PHOTO_MAX = 400_000;   // base64 chars (~300 KB), the page sends ~30-60 KB
const CARD_COLS = "id,person_key,payroll_profile_id,card_year,card_no,full_name,contractor,pea_office,issue_date,expire_date,has_photo,is_active,created_at,updated_at";

async function people() {
  const { data: emp, error: e1 } = await db.from("employee_payroll_profiles").select("id,employee_name,site_name").eq("is_active", true).order("site_name").order("employee_name").limit(2000);
  if (e1) throw e1;
  const { data: last } = await db.from("staff_payroll_monthly_drafts").select("payroll_month").eq("is_active", true).order("payroll_month", { ascending: false }).limit(1).maybeSingle();
  let staff: any[] = [];
  if (last?.payroll_month) {
    const { data, error } = await db.from("staff_payroll_monthly_drafts").select("employee_name").eq("is_active", true).eq("payroll_month", last.payroll_month).limit(200);
    if (error) throw error;
    staff = data || [];
  }
  const out = (emp || []).map((r) => ({ key: "p:" + r.id, profile_id: r.id, name: fixThai(r.employee_name), site: fixThai(r.site_name), kind: "field" }));
  const seen = new Set<string>();
  for (const r of staff) {
    const n = fixThai(r.employee_name);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push({ key: "s:" + n, profile_id: null, name: n, site: "สตาฟ", kind: "staff" });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const user = await authAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const [ppl, cards, offices] = await Promise.all([
        people(),
        db.from("employee_cards").select(CARD_COLS).eq("is_active", true).order("card_year", { ascending: false }).order("card_no", { ascending: false }).limit(5000),
        db.from("employee_card_offices").select("office,signer_name,phone").limit(500),
      ]);
      if (cards.error) throw cards.error;
      if (offices.error) throw offices.error;
      // photos are not in the list (only has_photo); the page asks for them with action "photos"
      return json({ ok: true, people: ppl, cards: cards.data || [], offices: offices.data || [] });
    }

    if (action === "photos") {
      const ids = (Array.isArray(body?.ids) ? body.ids : []).map(cleanId).filter(Boolean).slice(0, 200);
      if (!ids.length) return json({ ok: true, photos: {} });
      const { data, error } = await db.from("employee_cards").select("id,photo_b64").in("id", ids);
      if (error) throw error;
      const photos: Record<string, string> = {};
      for (const r of data || []) if (r.photo_b64) photos[r.id] = r.photo_b64;
      return json({ ok: true, photos });
    }

    if (action === "save_card") {
      const src = body?.card && typeof body.card === "object" ? body.card : {};
      const id = cleanId(src.id);
      const row: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
      if ("full_name" in src) row.full_name = text(src.full_name, 160);
      if ("contractor" in src) row.contractor = text(src.contractor, 200) || "บริษัท ไดเวอร์เจนท์ คอร์ปอเรชั่น จำกัด";
      if ("pea_office" in src) row.pea_office = text(src.pea_office, 120);
      if ("issue_date" in src) row.issue_date = date(src.issue_date);
      if ("expire_date" in src) row.expire_date = date(src.expire_date);
      if ("photo_b64" in src) {
        const p = src.photo_b64 == null ? null : String(src.photo_b64).replace(/^data:image\/\w+;base64,/, "");
        if (p && (p.length > PHOTO_MAX || !/^[A-Za-z0-9+/=]+$/.test(p))) return json({ error: "PHOTO_INVALID" }, 400);
        row.photo_b64 = p || null;
      }
      if ("full_name" in row && !row.full_name) return json({ error: "NAME_REQUIRED" }, 400);
      if (id) {
        const { data, error } = await db.from("employee_cards").update(row).eq("id", id).select(CARD_COLS).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "NOT_FOUND" }, 404);
        return json({ ok: true, item: data });
      }
      // a new card: next running number of the issue year (พ.ศ.), retried if two cards race for it
      const key = text(src.person_key, 200);
      if (!key || !row.full_name) return json({ error: "NAME_REQUIRED" }, 400);
      const issue = (row.issue_date as string) || new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      const year = Number(issue.slice(0, 4)) + 543;
      const pid = key.startsWith("p:") ? cleanId(key.slice(2)) : null;
      for (let i = 0; i < 5; i++) {
        const { data: lastNo } = await db.from("employee_cards").select("card_no").eq("card_year", year).order("card_no", { ascending: false }).limit(1).maybeSingle();
        const no = (Number(lastNo?.card_no) || 0) + 1;
        const { data, error } = await db.from("employee_cards").insert({
          ...row, person_key: key, payroll_profile_id: pid, card_year: year, card_no: no, issue_date: issue,
          expire_date: row.expire_date || `${issue.slice(0, 4)}-12-31`, created_by: user.id,
        }).select(CARD_COLS).single();
        if (!error) return json({ ok: true, item: data, created: true });
        if (error.code !== "23505") throw error;
      }
      return json({ error: "CARD_NO_BUSY" }, 409);
    }

    if (action === "delete_card") {
      const id = cleanId(body?.id);
      if (!id) return json({ error: "ID_REQUIRED" }, 400);
      const { error } = await db.from("employee_cards").update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "save_office") {
      const office = text(body?.office, 120);
      if (!office) return json({ error: "OFFICE_REQUIRED" }, 400);
      const { data, error } = await db.from("employee_card_offices").upsert({
        office, signer_name: text(body?.signer_name, 160), phone: text(body?.phone, 60), updated_by: user.id, updated_at: new Date().toISOString(),
      }).select("office,signer_name,phone").single();
      if (error) throw error;
      return json({ ok: true, item: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as any)?.message || e);
    const auth = ["SESSION_REQUIRED", "SESSION_INVALID", "USER_INACTIVE"].includes(msg);
    console.error("employee-card-api", msg);
    return json({ error: msg }, auth ? 401 : msg === "ADMIN_ONLY" ? 403 : 500);
  }
});
