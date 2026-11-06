-- Login (create_app_session) closes the user's older sessions so one account is
-- signed in on one device. The Android app often sends the login twice within a
-- few seconds (double tap / retry); the second call closed the first session, and
-- when the app kept the first token every later call failed with SESSION_INVALID
-- (e.g. ยืนยันตัวตนพนักงาน → compensation-api 401). 273 of 1,934 logins in the
-- week to 2026-11-06 were closed this way within 10 seconds.
-- Sessions created in the last 30 seconds are now left active, so either token
-- from a double submit works; older sessions are still closed as before.
create or replace function public.create_app_session(p_username text, p_password text)
returns table(user_id bigint, username text, role text, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_user_id bigint;
    v_username text;
    v_role text;
    v_token text;
    v_user_expires_at timestamptz;
    v_expires_at timestamptz;
begin

    select
        u.id,
        u.username::text,
        u.role::text,
        u.expires_at
    into
        v_user_id,
        v_username,
        v_role,
        v_user_expires_at
    from public.app_users u
    where lower(u.username) = lower(p_username)
      and u.password_hash = extensions.crypt(
            p_password,
            u.password_hash
          )
      and u.is_active = true
      and (
          u.expires_at is null
          or u.expires_at > now()
      )
    limit 1;

    if v_user_id is null then
        return;
    end if;

    -- ปิด Session เก่าของ User นี้ (เว้น Session ที่เพิ่งสร้างใน 30 วินาที กันกดเข้าสู่ระบบซ้ำ)
    update public.app_sessions s
    set is_active = false
    where s.user_id = v_user_id
      and s.is_active = true
      and s.created_at < now() - interval '30 seconds';

    -- สร้าง Token ใหม่
    v_token := encode(
        extensions.gen_random_bytes(32),
        'hex'
    );

    v_expires_at := now() + interval '30 days';

    if v_user_expires_at is not null
       and v_user_expires_at < v_expires_at then
        v_expires_at := v_user_expires_at;
    end if;

    insert into public.app_sessions(
        user_id,
        token,
        expires_at,
        is_active
    )
    values(
        v_user_id,
        v_token,
        v_expires_at,
        true
    );

    return query
    select
        v_user_id,
        v_username,
        v_role,
        v_token,
        v_expires_at;

end;
$$;
