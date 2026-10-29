-- ตารางประมูลแจ้งเตือน: on an auction day repeat the alert (today's sites) every 30 min, 09:00-12:00 and 13:00-16:00 Bangkok.
-- Cron fires 09:00-16:30 Bangkok (02:00-09:30 UTC); notice-bid-api skips 12:30 and 16:30 and days with no auction.
select cron.unschedule('notice-bids-line-repeat') where exists (select 1 from cron.job where jobname = 'notice-bids-line-repeat');
select cron.schedule('notice-bids-line-repeat', '0,30 2-9 * * *', $$
  select net.http_post(
    url := 'https://neauzvqroaszvqffahkv.functions.supabase.co/notice-bid-api',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'notice_alert_cron_key')),
    body := '{"action":"cron_today"}'::jsonb,
    timeout_milliseconds := 20000)
$$);
