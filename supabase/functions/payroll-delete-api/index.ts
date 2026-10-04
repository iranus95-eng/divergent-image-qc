// Remove an employee from the payroll list (จัดการเงินเดือน, trash button). 2026-10-04
// Soft delete: the employee's active rows for that payroll month are set is_active=false (all areas),
// so they disappear from the list and from reports, but nothing is erased and it can be restored.
// Logged in payroll_change_log. Same permission rule as payroll-web-api "manage".
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "POST,OPTIONS" };
const J = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { ...H, "content-type": "application/json; charset=utf-8" } });

async function user(req: Request) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!t) throw Error("AUTH_REQUIRED");
  const { data: s, error: se } = await db.from("app_sessions").select("user_id,expires_at,is_active").eq("token", t).maybeSingle();
  if (se) throw se;
  if (!s || !s.is_active || !s.expires_at || new Date(s.expires_at).getTime() <= Date.now()) throw Error("AUTH_INVALID");
  const { data: u, error: ue } = await db.from("app_users").select("id,username,role,is_active,expires_at,can_access_payroll,can_manage_payroll").eq("id", s.user_id).maybeSingle();
  if (ue) throw ue;
  if (!u || !u.is_active || (u.expires_at && new Date(u.expires_at).getTime() <= Date.now())) throw Error("PAYROLL_ACCESS_DENIED");
  const role = String(u.role || "").toLowerCase();
  const manage = role === "admin" || role === "staff" || role === "user_creator" || u.can_manage_payroll === true;
  if (!manage) throw Error("PAYROLL_MANAGE_DENIED");
  return u;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return J({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const u = await user(req);
    const b = await req.json().catch(() => ({}));
    const action = String(b?.action || "");
    const id = Number(b?.id);
    if (!Number.isInteger(id) || id <= 0) return J({ error: "INVALID_ID" }, 400);
    const { data: row, error: re } = await db.from("payroll_master_rows").select("id,profile_id,source_month,employee_name,site_name,is_active").eq("id", id).maybeSingle();
    if (re) throw re;
    if (!row) return J({ error: "EMPLOYEE_NOT_FOUND" }, 404);

    if (action === "delete_employee") {
      let q = db.from("payroll_master_rows").update({ is_active: false, updated_at: new Date().toISOString() }).eq("is_active", true);
      q = row.profile_id ? q.eq("profile_id", row.profile_id).eq("source_month", row.source_month) : q.eq("id", id);
      const { data: done, error } = await q.select("id,site_name");
      if (error) throw error;
      await db.from("payroll_change_log").insert({
        changed_by_user_id: u.id, payroll_profile_id: row.profile_id || null, action: "DELETE_EMPLOYEE_FROM_PAYROLL", field_name: "is_active",
        old_value: { master_row_ids: (done || []).map((x: any) => x.id), employee_name: row.employee_name, source_month: row.source_month },
        new_value: { is_active: false }, note: "Removed from payroll list via web (soft delete)",
      });
      return J({ ok: true, removed_rows: (done || []).length, employee_name: row.employee_name });
    }
    if (action === "restore_employee") {
      let q = db.from("payroll_master_rows").update({ is_active: true, updated_at: new Date().toISOString() }).eq("is_active", false);
      q = row.profile_id ? q.eq("profile_id", row.profile_id).eq("source_month", row.source_month) : q.eq("id", id);
      const { data: done, error } = await q.select("id");
      if (error) throw error;
      await db.from("payroll_change_log").insert({ changed_by_user_id: u.id, payroll_profile_id: row.profile_id || null, action: "RESTORE_EMPLOYEE_TO_PAYROLL", field_name: "is_active", old_value: { is_active: false }, new_value: { master_row_ids: (done || []).map((x: any) => x.id) }, note: "Restored via web" });
      return J({ ok: true, restored_rows: (done || []).length });
    }
    return J({ error: "UNKNOWN_ACTION" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const status = m.includes("DENIED") ? 403 : m.startsWith("AUTH") ? 401 : 500;
    console.error("payroll-delete-api", m, e);
    return J({ error: status === 500 ? "SERVER_ERROR" : m }, status);
  }
});
