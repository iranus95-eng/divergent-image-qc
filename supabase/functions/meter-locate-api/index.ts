// ค้นหาพิกัดตำแหน่ง: หาตำแหน่งมิเตอร์จาก CA เมื่อไม่มีพิกัดรูปงาน
// 1) พิกัดมิเตอร์ใน customers  2) บ้านข้างเคียงในสาย MRU เดียวกัน (ลำดับเดินจด)  3) Longdo Geocoding จากที่อยู่
// แล้วเทียบระยะระหว่างแหล่งข้อมูล เพื่อเตือนเมื่อพิกัดหรือที่อยู่น่าจะไม่ตรงกับที่ตั้งมิเตอร์จริง
import { createClient } from "npm:@supabase/supabase-js@2";

const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: H });
let _db: any = null;
const db = () => _db ??= createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

import { FAR_M, type Pt, haversine, validPt, parseMru, hasMoo, cleanAddress, pickNeighbours } from "./lib.ts";

async function auth(req: Request) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("SESSION_REQUIRED");
  const { data: s, error: se } = await db().from("app_sessions").select("user_id,expires_at,is_active").eq("token", m[1].trim()).maybeSingle();
  if (se) throw se;
  if (!s || s.is_active !== true || !s.expires_at || new Date(s.expires_at).getTime() <= Date.now()) throw new Error("SESSION_INVALID");
  const { data: u, error: ue } = await db().from("app_users").select("id,is_active,expires_at").eq("id", s.user_id).maybeSingle();
  if (ue) throw ue;
  if (!u || u.is_active !== true || (u.expires_at && new Date(u.expires_at).getTime() <= Date.now())) throw new Error("USER_INACTIVE");
  return u;
}

async function longdo(address: string) {
  const key = Deno.env.get("LONGDO_API_KEY") || "";
  if (!key || !address) return null;
  const u = "https://search.longdo.com/addresslookup/api/addr/geocoding?key=" + encodeURIComponent(key) + "&text=" + encodeURIComponent(address);
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r || !r.ok) return { error: "LONGDO_FAILED" };
  const d = await r.json().catch(() => ({}));
  const it = (d?.data || [])[0];
  if (!it) return { error: "LONGDO_NO_RESULT" };
  const raw = Array.isArray(it.point) ? it.point[0] : (it.point || it.location?.point?.[0] || {});
  const pt = validPt(raw?.lat, raw?.lon);
  if (!pt) return { error: "LONGDO_NO_RESULT" };
  return { ...pt, confidence: it.confidence ?? null, houseno: it.location?.houseno || "", moo: it.location?.moo || "", has_moo: hasMoo(address) };
}

export async function locate(input: { ca?: string; mru?: string; address?: string }) {
  const ca = String(input.ca || "").replace(/\D/g, "");
  if (!/^\d{9,12}$/.test(ca)) throw new Error("CA_REQUIRED");
  const { data: cust, error } = await db().from("customers").select("ca,pea_no,mru,address,latitude,longitude").eq("ca", ca).limit(1).maybeSingle();
  if (error) throw error;
  const mruInfo = parseMru(input.mru) || parseMru(cust?.mru);
  const address = cleanAddress(String(input.address || "").trim() || cust?.address || "");
  const customerPt = cust ? validPt(cust.latitude, cust.longitude) : null;

  let neighbours = null;
  if (mruInfo) {
    const { data: rows, error: ne } = await db().from("customers").select("ca,mru,address,latitude,longitude").like("mru", mruInfo.route + "-%").limit(3000);
    if (ne) throw ne;
    neighbours = pickNeighbours(rows || [], mruInfo.seq, ca);
  }
  const geo = address ? await longdo(address) : null;
  const geoPt = geo && "lat" in geo ? geo as Pt : null;
  const est = neighbours?.estimate || null;
  const checks = {
    customer_vs_neighbours_m: customerPt && est ? haversine(customerPt, est) : null,
    longdo_vs_neighbours_m: geoPt && est ? haversine(geoPt, est) : null,
    longdo_vs_customer_m: geoPt && customerPt ? haversine(geoPt, customerPt) : null,
  };
  return {
    ca, mru: mruInfo?.mru || null, address,
    customer: cust ? { ca: cust.ca, pea_no: cust.pea_no, mru: cust.mru, address: cleanAddress(cust.address), lat: customerPt?.lat ?? null, lng: customerPt?.lng ?? null } : null,
    neighbours, longdo: geo, checks, far_m: FAR_M,
  };
}

if (import.meta.main) Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    await auth(req);
    const body = await req.json().catch(() => ({}));
    return json({ ok: true, result: await locate(body || {}) });
  } catch (e) {
    const msg = String((e as any)?.message || e);
    const status = /SESSION|USER_INACTIVE/.test(msg) ? 401 : msg === "CA_REQUIRED" ? 400 : 500;
    if (status === 500) console.error("meter-locate-api", e);
    return json({ error: msg }, status);
  }
});
