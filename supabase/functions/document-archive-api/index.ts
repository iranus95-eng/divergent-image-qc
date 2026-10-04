// Document archive for the web document menus (ใบตั้งหนี้ / ใบแจ้งหนี้-ใบวางบิล / ใบเสร็จ-ใบกำกับภาษี).
// Saves a rendered snapshot (html) + form state per (doc_type, doc_no), lists and returns them for viewing.
// Large data: images (logos) are stored once in document_archive_assets and referenced as arch-asset:<sha256>.
import { createClient } from "npm:@supabase/supabase-js@2";

const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: H });
const TYPES = ["invoice", "billing", "receipt"] as const;
type DocType = typeof TYPES[number];
const MAX_HTML = 3_000_000;

async function authUser(req: Request) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error("SESSION_REQUIRED");
  const { data: s, error: se } = await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token", m[1].trim()).maybeSingle();
  if (se) throw se;
  if (!s || s.is_active !== true || !s.expires_at || new Date(s.expires_at).getTime() <= Date.now()) throw new Error("SESSION_INVALID");
  const { data: u, error: ue } = await db.from("app_users").select("id,username,role,is_active,expires_at,can_access_invoice,can_access_billing").eq("id", s.user_id).maybeSingle();
  if (ue) throw ue;
  if (!u || u.is_active !== true || (u.expires_at && new Date(u.expires_at).getTime() <= Date.now())) throw new Error("USER_INACTIVE");
  return u;
}
function allowedTypes(u: any): DocType[] {
  if (String(u.role || "").toLowerCase() === "admin") return [...TYPES];
  const t: DocType[] = [];
  if (u.can_access_invoice === true) t.push("invoice");
  if (u.can_access_billing === true) t.push("billing", "receipt");
  return t;
}
function docType(v: unknown, allowed: DocType[]): DocType {
  const t = String(v || "") as DocType;
  if (!TYPES.includes(t)) throw new Error("INVALID_DOC_TYPE");
  if (!allowed.includes(t)) throw new Error("DOC_ACCESS_DENIED");
  return t;
}
function cleanDate(v: unknown) { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
function cleanNum(v: unknown) { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; }

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// replace big data: URIs with arch-asset:<hash>, storing each image once
async function extractAssets(html: string) {
  const re = /data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]{2000,}/g;
  const found = new Map<string, string>();
  for (const m of html.match(re) || []) if (!found.has(m)) found.set(m, await sha256(m));
  if (found.size) {
    const rows = [...found.entries()].map(([data, hash]) => ({ hash, data }));
    const { error } = await db.from("document_archive_assets").upsert(rows, { onConflict: "hash", ignoreDuplicates: true });
    if (error) throw error;
    for (const [data, hash] of found) html = html.split(data).join("arch-asset:" + hash);
  }
  return html;
}
async function inlineAssets(html: string) {
  const hashes = [...new Set((html.match(/arch-asset:[0-9a-f]{64}/g) || []).map((x) => x.slice(11)))];
  if (!hashes.length) return html;
  const { data, error } = await db.from("document_archive_assets").select("hash,data").in("hash", hashes);
  if (error) throw error;
  for (const a of data || []) html = html.split("arch-asset:" + a.hash).join(a.data);
  return html;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const user = await authUser(req);
    const allowed = allowedTypes(user);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const types = body?.doc_type ? [docType(body.doc_type, allowed)] : allowed;
      if (!types.length) return json({ ok: true, documents: [] });
      let q = db.from("document_archive").select("id,doc_type,doc_no,doc_date,customer_name,total_amount,created_at,updated_at,created_by,updated_by")
        .in("doc_type", types).order("doc_date", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(Math.min(Number(body?.limit) || 300, 1000));
      const search = String(body?.search || "").trim().replace(/[%,()"\\*]/g, " ").slice(0, 100);
      if (search) q = q.or(`doc_no.ilike."%${search}%",customer_name.ilike."%${search}%"`);
      if (cleanDate(body?.from)) q = q.gte("doc_date", cleanDate(body.from));
      if (cleanDate(body?.to)) q = q.lte("doc_date", cleanDate(body.to));
      const { data, error } = await q;
      if (error) throw error;
      const ids = [...new Set((data || []).flatMap((d: any) => [d.created_by, d.updated_by]).filter(Boolean))];
      const names = new Map<number, string>();
      if (ids.length) {
        const { data: us } = await db.from("app_users").select("id,username").in("id", ids);
        for (const x of us || []) names.set(Number(x.id), String(x.username || ""));
      }
      return json({ ok: true, documents: (data || []).map((d: any) => ({ ...d, created_by_name: names.get(Number(d.created_by)) || null, updated_by_name: names.get(Number(d.updated_by)) || null })) });
    }

    if (action === "get") {
      const id = Number(body?.id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: "INVALID_ID" }, 400);
      const { data, error } = await db.from("document_archive").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);
      docType(data.doc_type, allowed);
      return json({ ok: true, document: { ...data, html: await inlineAssets(String(data.html || "")) } });
    }

    if (action === "save") {
      const t = docType(body?.doc_type, allowed);
      const docNo = String(body?.doc_no || "").trim().slice(0, 120);
      if (!docNo) return json({ error: "DOC_NO_REQUIRED" }, 400);
      const rawHtml = String(body?.html || "");
      if (!rawHtml) return json({ error: "HTML_REQUIRED" }, 400);
      if (rawHtml.length > MAX_HTML) return json({ error: "DOCUMENT_TOO_LARGE" }, 413);
      const html = await extractAssets(rawHtml);
      const { data: existing, error: ee } = await db.from("document_archive").select("id,updated_at").eq("doc_type", t).eq("doc_no", docNo).maybeSingle();
      if (ee) throw ee;
      if (existing && body?.overwrite !== true) return json({ error: "DOC_NO_EXISTS", existing }, 409);
      const row = {
        doc_type: t, doc_no: docNo, doc_date: cleanDate(body?.doc_date), customer_name: String(body?.customer_name || "").trim().slice(0, 500) || null,
        total_amount: cleanNum(body?.total_amount), state: body?.state && typeof body.state === "object" ? body.state : {}, html,
        updated_by: user.id, updated_at: new Date().toISOString(),
      };
      const q = existing
        ? db.from("document_archive").update(row).eq("id", existing.id).select("id,doc_type,doc_no,updated_at").single()
        : db.from("document_archive").insert({ ...row, created_by: user.id }).select("id,doc_type,doc_no,updated_at").single();
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, document: data, replaced: !!existing });
    }

    if (action === "delete") {
      const id = Number(body?.id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: "INVALID_ID" }, 400);
      const { data: d, error: ge } = await db.from("document_archive").select("id,doc_type").eq("id", id).maybeSingle();
      if (ge) throw ge;
      if (!d) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);
      docType(d.doc_type, allowed);
      const { error } = await db.from("document_archive").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true, id });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const status = ["SESSION_REQUIRED", "SESSION_INVALID"].includes(m) ? 401 : ["USER_INACTIVE", "DOC_ACCESS_DENIED"].includes(m) ? 403 : m === "INVALID_DOC_TYPE" ? 400 : 500;
    console.error("document-archive-api", m, e);
    return json({ error: status === 500 ? "SERVER_ERROR" : m }, status);
  }
});
