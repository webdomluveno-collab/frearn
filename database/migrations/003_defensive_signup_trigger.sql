-- Migration 003: defensive signup trigger for profiles.country (char(2))
-- Idempotent: safe to run multiple times. Run AFTER 002_cpx_provider.sql.
--
-- Background: the registration form now submits ISO 3166-1 alpha-2 codes, but
-- raw_user_meta_data.country is ultimately user-controlled input. This trigger
-- normalizes to uppercase and only accepts exactly two ASCII letters;
-- anything else (missing, full names, wrong length) falls back to 'XX' so a
-- bad value can NEVER abort auth user creation (Postgres 22001).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'country', '')), '');
  v_country text := 'XX';
begin
  if v_raw is not null and upper(v_raw) ~ '^[A-Z]{2}$' then
    v_country := upper(v_raw);
  end if;

  insert into public.profiles (id, email, country)
  values (new.id, new.email, v_country)
  on conflict (id) do nothing;
  return new;
exception
  when others then
    -- Profile creation must never break signup: fall back and continue.
    -- (The unique violation path is already handled by ON CONFLICT above;
    -- this guards against any other unexpected failure.)
    begin
      insert into public.profiles (id, email, country)
      values (new.id, new.email, 'XX')
      on conflict (id) do nothing;
    exception
      when others then
        -- Last resort: let the auth user exist even without a profile row.
        null;
    end;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
