import { createClient } from "npm:@supabase/supabase-js@2";

// v5 (2026-10-15): one row per photo (CA + photo name). Sending the same photo again always
// replaces its coordinates with the new ones, but never drops a link to an uploaded image that
// was already found (MATCHED stays MATCHED when the new lookup finds nothing).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}

function stem(name: string) {
  return String(name || "").replace(/\.[^.]+$/, "");
}

function validDateTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s) ? s.replace("T", " ") : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const records = Array.isArray(body?.records) ? body.records : [];
    const sourceSiteCode = typeof body?.site_code === "string" ? body.site_code.trim() : null;
    const sourceBatchId = typeof body?.batch_id === "string" ? body.batch_id.trim() : null;
    const batchConfirmed = body?.batch_confirmed === true;

    if (records.length === 0 || records.length > 1000) return json({ error: "INVALID_RECORD_COUNT" }, 400);
    if (batchConfirmed && (!sourceSiteCode || !sourceBatchId)) return json({ error: "BATCH_CONFIRM_REQUIRES_SITE_AND_BATCH" }, 400);

    // the same photo twice in one request: the last one wins
    const byPhoto = new Map<string, any>();
    for (const r of records) {
      const ca = String(r?.ca_number ?? "").replace(/\D/g, "");
      const photoName = String(r?.photo_name ?? "").trim();
      const photoStem = stem(photoName);
      const lat = Number(r?.latitude);
      const lng = Number(r?.longitude);
      if (!/^\d{12}$/.test(ca)) continue;
      if (!/^INSx\d{12}_\d{8}_\d{6}$/i.test(photoStem)) continue;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) continue;

      byPhoto.set(`${ca}|${photoStem}`.toLowerCase(), {
        ca_number: ca,
        source_photo_name: photoName,
        source_photo_stem: photoStem,
        actual_latitude: lat,
        actual_longitude: lng,
        photo_datetime: validDateTime(r?.photo_datetime),
        event_datetime: validDateTime(r?.event_datetime),
        source_file: String(r?.source_file ?? "").slice(0, 255) || null,
        job_ref: String(r?.job_ref ?? "").slice(0, 100) || null,
        cycle_code: String(r?.cycle_code ?? "").slice(0, 50) || null,
        secondary_ref: String(r?.secondary_ref ?? "").slice(0, 100) || null,
        subdistrict: String(r?.subdistrict ?? "").slice(0, 255) || null,
        district: String(r?.district ?? "").slice(0, 255) || null,
        province: String(r?.province ?? "").slice(0, 255) || null,
        raw_parameter: String(r?.raw_parameter ?? "").slice(0, 4000) || null,
        source_site_code: sourceSiteCode,
        source_batch_id: sourceBatchId,
        updated_at: new Date().toISOString()
      });
    }
    const normalized = [...byPhoto.values()];

    if (normalized.length === 0) return json({ error: "NO_VALID_RECORDS" }, 400);

    const caList = [...new Set(normalized.map(r => r.ca_number))];
    const indexRows: any[] = [];
    const existingRows: any[] = [];
    for (let i = 0; i < caList.length; i += 50) {
      const chunk = caList.slice(i, i + 50);
      const { data, error } = await supabase
        .from("image_search_index")
        .select("object_path,file_name,ca_number,site_code,batch_id")
        .in("ca_number", chunk);
      if (error) throw error;
      indexRows.push(...(data ?? []));
      const old = await supabase
        .from("image_work_locations")
        .select("ca_number,source_photo_stem,match_status,match_count,matched_object_path,matched_batch_id,matched_site_code,source_site_code,source_batch_id")
        .in("ca_number", chunk)
        .in("source_photo_stem", normalized.filter(r => chunk.includes(r.ca_number)).map(r => r.source_photo_stem));
      if (old.error) throw old.error;
      existingRows.push(...(old.data ?? []));
    }
    const existingByKey = new Map<string, any>();
    for (const e of existingRows) existingByKey.set(`${e.ca_number}|${e.source_photo_stem}`.toLowerCase(), e);

    const byKey = new Map<string, any[]>();
    for (const row of indexRows) {
      const key = `${row.ca_number}|${stem(String(row.file_name ?? ""))}`.toLowerCase();
      const arr = byKey.get(key) ?? [];
      arr.push(row);
      byKey.set(key, arr);
    }

    // If the app already knows site + batch, resolve the real storage filename by stem.
    const storageByStem = new Map<string, string>();
    if (sourceSiteCode && sourceBatchId) {
      const { data: batchRow } = await supabase.from("image_batches").select("raw_date").eq("batch_id", sourceBatchId).eq("site_code", sourceSiteCode).maybeSingle();
      const rawDate = String(batchRow?.raw_date || "").trim();
      if (rawDate) {
        const folder = `${sourceSiteCode}/${rawDate}/${sourceBatchId}`;
        const { data: files, error: listErr } = await supabase.storage.from("insx-images").list(folder, { limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } });
        if (listErr) throw listErr;
        for (const f of files || []) {
          const n = String(f?.name || "").trim();
          if (!n || n.endsWith("/")) continue;
          storageByStem.set(stem(n).toLowerCase(), `${folder}/${n}`);
        }
      }
    }

    const rowsToUpsert = normalized.map(r => {
      const key = `${r.ca_number}|${r.source_photo_stem}`.toLowerCase();
      const matches = byKey.get(key) ?? [];
      const directStoragePath = storageByStem.get(String(r.source_photo_stem).toLowerCase()) || null;
      const prev = existingByKey.get(key);
      // keep where the photo came from when this sender does not know it
      const base = { ...r, source_site_code: r.source_site_code ?? prev?.source_site_code ?? null, source_batch_id: r.source_batch_id ?? prev?.source_batch_id ?? null };

      if (batchConfirmed || (sourceBatchId && sourceSiteCode && directStoragePath)) {
        const exactBatchMatch = matches.find(m => String(m.batch_id ?? "") === sourceBatchId && String(m.site_code ?? "") === sourceSiteCode);
        return {
          ...base,
          match_count: 1,
          match_status: "MATCHED",
          matched_object_path: directStoragePath ?? exactBatchMatch?.object_path ?? prev?.matched_object_path ?? null,
          matched_batch_id: sourceBatchId,
          matched_site_code: sourceSiteCode
        };
      }

      if (matches.length !== 1 && prev?.match_status === "MATCHED") {
        // new coordinates, same already-linked image
        return {
          ...base,
          match_count: prev.match_count ?? 1,
          match_status: "MATCHED",
          matched_object_path: prev.matched_object_path,
          matched_batch_id: prev.matched_batch_id,
          matched_site_code: prev.matched_site_code
        };
      }

      return {
        ...base,
        match_count: matches.length,
        match_status: matches.length === 1 ? "MATCHED" : matches.length > 1 ? "MULTIPLE" : "NOT_FOUND",
        matched_object_path: matches.length === 1 ? matches[0].object_path : null,
        matched_batch_id: matches.length === 1 ? matches[0].batch_id : null,
        matched_site_code: matches.length === 1 ? matches[0].site_code : null
      };
    });

    const { data: saved, error: saveError } = await supabase
      .from("image_work_locations")
      .upsert(rowsToUpsert, { onConflict: "ca_number,source_photo_stem" })
      .select("id,ca_number,source_photo_name,match_status,match_count,matched_object_path,matched_batch_id,matched_site_code,source_batch_id,source_site_code");
    if (saveError) throw saveError;

    const summary = { imported: saved?.length ?? 0, matched: 0, multiple: 0, not_found: 0, linked: 0, replaced: 0 };
    for (const r of rowsToUpsert) if (existingByKey.has(`${r.ca_number}|${r.source_photo_stem}`.toLowerCase())) summary.replaced++;
    for (const r of saved ?? []) {
      if (r.match_status === "MATCHED") summary.matched++;
      else if (r.match_status === "MULTIPLE") summary.multiple++;
      else summary.not_found++;
      if (sourceBatchId && sourceSiteCode && r.matched_batch_id === sourceBatchId && r.matched_site_code === sourceSiteCode) summary.linked++;
    }

    return json({ ok: true, version: 5, batch_confirmed: batchConfirmed, summary, rows: saved ?? [] });
  } catch (e) {
    console.error("image-location-import", e);
    return json({ error: "SERVER_ERROR", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
