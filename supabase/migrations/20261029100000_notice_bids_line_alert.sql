-- ตารางประมูลแจ้งเตือน: every morning 07:00 (Bangkok) push the sites whose auction is today / tomorrow / within 7 days
-- to every admin's LINE through notice-bid-api. The cron call proves itself with header x-cron-key, a random key kept
-- only in the vault; the function checks it through notice_alert_key_ok (service role only).
select vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'notice_alert_cron_key', 'notice-bid-api cron alert')
where not exists (select 1 from vault.secrets where name = 'notice_alert_cron_key');

create or replace function public.notice_alert_key_ok(k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'notice_alert_cron_key' and decrypted_secret = k)
$$;
revoke all on function public.notice_alert_key_ok(text) from public, anon, authenticated;
grant execute on function public.notice_alert_key_ok(text) to service_role;

select cron.unschedule('notice-bids-line-alert') where exists (select 1 from cron.job where jobname = 'notice-bids-line-alert');
select cron.schedule('notice-bids-line-alert', '0 0 * * *', $$
  select net.http_post(
    url := 'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'notice_alert_cron_key')),
    body := '{"action":"cron_alert"}'::jsonb,
    timeout_milliseconds := 20000)
$$);
