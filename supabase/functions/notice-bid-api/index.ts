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
// ---- LINE alert to the admin in ALERT_USERNAMES: only the sites whose price auction (bid_date) is today.
// pg_cron sends a summary at 07:00 and repeats on auction days (header x-cron-key, checked against the vault); admins also have a 📣 button.
const ALERT_USERNAMES = ["admin"];   // who gets the alert (app_users.username, must be an active admin with LINE linked)
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const bkkDay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const thDate = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(2)}`; };
const baht = (v: unknown) => v == null ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
export function alertText(rows: any[], today: string) {
  const live = rows.filter((r) => r.bid_date === today && !String(r.status || "").includes("ยกเลิก"));
  if (!live.length) return "";
  const line = (r: any) => `• ${r.site}${r.bid_time ? ` (${r.bid_time})` : ""}${r.office ? ` – ${r.office}` : ""}${r.budget != null ? ` งบ ${baht(r.budget)}` : ""}${r.price_bid != null ? ` เสนอ ${r.price_bid}` : ""}`;
  const t = [`🔔 ตารางประมูลแจ้งเตือน (${thDate(today)})`, `🔴 เคาะราคาวันนี้ ${live.length} ไซด์`, ...live.map(line)].join("\n");
  return t.length > 4900 ? t.slice(0, 4880) + "\n…(ดูต่อในเว็บ)" : t;
}
// on an auction day the cron calls every 30 min; only 09:00-12:00 and 13:00-16:00 (Bangkok) send, today's sites only
export const inRepeatWindow = (hhmm: string) => (hhmm >= "09:00" && hhmm <= "12:00") || (hhmm >= "13:00" && hhmm <= "16:00");
export function todayText(rows: any[], today: string, hhmm: string) {
  const live = rows.filter((r) => r.bid_date === today && !String(r.status || "").includes("ยกเลิก"));
  if (!live.length) return "";
  const line = (r: any) => `• ${r.site}${r.bid_time ? ` (${r.bid_time})` : ""}${r.office ? ` – ${r.office}` : ""}`;
  return [`⏰ ${hhmm} น. วันนี้เคาะราคา ${live.length} ไซด์`, ...live.map(line)].join("\n").slice(0, 4900);
}
async function bidsOn(day: string) {
  const { data, error } = await db.from("notice_bids").select("site,office,bid_date,bid_time,budget,price_bid,status")
    .eq("bid_date", day).order("bid_time").limit(300);
  if (error) throw error;
  return data || [];
}
async function sendToday() {
  const hhmm = new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 16);
  if (!inRepeatWindow(hhmm)) return { ok: true, sent: 0, reason: "OUTSIDE_WINDOW" };
  const today = bkkDay();
  const text = todayText(await bidsOn(today), today, hhmm);
  return text ? push(text) : { ok: true, sent: 0, reason: "NOTHING_DUE" };
}
async function sendAlert(force: boolean) {
  const today = bkkDay();
  let text = alertText(await bidsOn(today), today);
  if (!text) { if (!force) return { ok: true, sent: 0, reason: "NOTHING_DUE" }; text = `🔔 ตารางประมูลแจ้งเตือน (${thDate(today)})\nวันนี้ไม่มีไซด์ที่เคาะราคา`; }
  return push(text);
}
async function push(text: string) {
  const { data: admins, error: ae } = await db.from("app_users").select("line_user_id,expires_at").eq("is_active", true).ilike("role", "admin").in("username", ALERT_USERNAMES).not("line_user_id", "is", null);
  if (ae) throw ae;
  const to = [...new Set((admins || []).filter((u) => !u.expires_at || Date.parse(u.expires_at) > Date.now()).map((u) => u.line_user_id))];
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (!token) return { ok: false, sent: 0, reason: "LINE_CHANNEL_ACCESS_TOKEN_MISSING", text };
  if (!to.length) return { ok: false, sent: 0, reason: "NO_ADMIN_LINKED_LINE", text };
  const r = await fetch("https://api.line.me/v2/bot/message/multicast", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ to, messages: [{ type: "text", text }] }) });
  if (!r.ok) { console.error("notice alert push failed", r.status, await r.text().catch(() => "")); return { ok: false, sent: 0, reason: "LINE_PUSH_FAILED", status: r.status, text }; }
  return { ok: true, sent: to.length, text };
}
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
    const cronKey = req.headers.get("x-cron-key");
    if (cronKey) {
      const { data: ok, error } = await db.rpc("notice_alert_key_ok", { k: cronKey });
      if (error) throw error;
      if (ok !== true) return json({ error: "CRON_KEY_INVALID" }, 403);
      const b = await req.json().catch(() => ({}));
      return json(b?.action === "cron_today" ? await sendToday() : await sendAlert(false));
    }
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

    if (action === "line_alert") return json(await sendAlert(true));

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
