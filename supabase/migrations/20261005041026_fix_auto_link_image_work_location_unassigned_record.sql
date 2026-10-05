-- Fix: auto_link_image_work_location() raised
--   ERROR 55000: record "m" is not assigned yet
-- whenever a row was inserted/updated WITHOUT source_batch_id/source_site_code,
-- because the CA+stem fallback assigned into fields of the never-initialised
-- record "m". The fallback now uses scalar variables. Matching logic is unchanged.
-- Applied to production (Location Finder) on 2026-10-05 as migration 20261005041026.

CREATE OR REPLACE FUNCTION public.auto_link_image_work_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m record;
  c integer;
  v_path text;
  v_batch text;
  v_site text;
begin
  -- Prefer the batch explicitly supplied by the location importer.
  if new.source_batch_id is not null and new.source_site_code is not null then
    select i.object_path,i.batch_id,i.site_code into m
    from public.image_search_index i
    where i.ca_number = new.ca_number
      and i.batch_id = new.source_batch_id
      and i.site_code = new.source_site_code
      and lower(regexp_replace(i.file_name,'\.[^.]+$','')) = lower(coalesce(new.source_photo_stem,regexp_replace(new.source_photo_name,'\.[^.]+$','')))
    order by i.object_path
    limit 1;
    if found then
      new.match_status := 'MATCHED';
      new.match_count := 1;
      new.matched_object_path := m.object_path;
      new.matched_batch_id := m.batch_id;
      new.matched_site_code := m.site_code;
      new.updated_at := now();
      return new;
    end if;
  end if;

  -- Otherwise link only when CA + photo stem identifies exactly one stored image.
  -- (Fix 2026-10-05: use scalar variables; assigning into fields of an unassigned
  --  record raised "record m is not assigned yet" when no batch was supplied.)
  select count(*),min(i.object_path),min(i.batch_id),min(i.site_code)
    into c,v_path,v_batch,v_site
  from public.image_search_index i
  where i.ca_number = new.ca_number
    and lower(regexp_replace(i.file_name,'\.[^.]+$','')) = lower(coalesce(new.source_photo_stem,regexp_replace(new.source_photo_name,'\.[^.]+$','')));

  if c = 1 then
    new.match_status := 'MATCHED';
    new.match_count := 1;
    new.matched_object_path := v_path;
    new.matched_batch_id := v_batch;
    new.matched_site_code := v_site;
  elsif c > 1 and coalesce(new.match_status,'') <> 'MATCHED' then
    new.match_status := 'MULTIPLE';
    new.match_count := c;
  elsif c = 0 and coalesce(new.match_status,'') = '' then
    new.match_status := 'NOT_FOUND';
    new.match_count := 0;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;
