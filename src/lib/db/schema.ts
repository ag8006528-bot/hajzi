/**
 * The PostgreSQL schema (source of truth). Applied automatically on first start by ensureSchema() in sql.ts,
 * and by `npm run db:setup`. Bump SCHEMA_VERSION whenever SCHEMA_SQL changes so running sites re-apply it.
 */
export const SCHEMA_VERSION = '1';

export const SCHEMA_SQL = String.raw`-- ═════════════════════════════════════════════════════════════════════════════
-- HAJZI — PostgreSQL schema (Supabase, Neon, Vercel Postgres or any Postgres 14+)
--
-- Applied AUTOMATICALLY by the app on first start (and by npm run db:setup). Safe to run again: everything
-- is "if not exists" / "create or replace". Bump SCHEMA_VERSION when you change it.
--
-- Security model
--  • Only the Next.js SERVER talks to the database, through DATABASE_URL (kept in server env vars).
--  • Row Level Security is ON for every table and NO policies/grants exist for the public
--    anon / authenticated roles, so Supabase's public REST API exposes nothing.
--  • Double booking is impossible at the database level: an exclusion constraint on bookings,
--    plus per-slot advisory locks so bookings and admin "blocked" slots can't overlap either.
--  • Phone-number limits are checked under a per-phone lock, so they can't be raced.
--  • The booking price is computed INSIDE the database from the stored field price.
-- Key columns are real typed columns (used by constraints and indexes); the remaining
-- attributes live in doc (jsonb) with exactly the shape the app uses.
-- ═════════════════════════════════════════════════════════════════════════════

-- Only one server instance runs the setup at a time (the lock is released when this script's transaction ends).
select pg_advisory_xact_lock(724001);

create extension if not exists btree_gist;

create table if not exists hajzi_meta (
  key    text primary key,
  value  text not null
);

create table if not exists fields (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  doc         jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists bookings (
  id                text primary key,
  ref               text not null unique check (ref ~ '^HZ-[A-Z0-9]{8}$'),
  field_id          text not null,                 -- no FK: a booking keeps its snapshot if a field is removed
  booking_date      date not null,
  start_minutes     int  not null check (start_minutes between 0 and 2880),
  duration_minutes  int  not null check (duration_minutes between 30 and 600),
  status            text not null check (status in ('confirmed', 'cancelled')),
  phone             text not null default '',
  customer_id       text,
  doc               jsonb not null,
  created_at        timestamptz not null default now(),
  -- ★ Two confirmed bookings for the same field and day can never overlap, even in the same millisecond.
  constraint bookings_no_overlap exclude using gist (
    field_id with =,
    booking_date with =,
    int4range(start_minutes, start_minutes + duration_minutes) with &&
  ) where (status = 'confirmed')
);
create index if not exists bookings_date_idx      on bookings (booking_date);
create index if not exists bookings_customer_idx  on bookings (customer_id) where customer_id is not null;
create index if not exists bookings_phone_idx     on bookings (phone, booking_date) where status = 'confirmed';

create table if not exists blocks (
  id                text primary key,
  field_id          text not null references fields(id) on delete cascade,
  block_date        date not null,
  start_minutes     int  not null check (start_minutes between 0 and 2880),
  duration_minutes  int  not null check (duration_minutes between 30 and 600),
  created_at        timestamptz not null default now(),
  constraint blocks_no_overlap exclude using gist (
    field_id with =, block_date with =, int4range(start_minutes, start_minutes + duration_minutes) with &&
  )
);

create table if not exists users (          -- staff / admin accounts
  id     text primary key,
  email  text not null unique,
  doc    jsonb not null
);

create table if not exists customers (
  id     text primary key,
  email  text not null unique,
  doc    jsonb not null
);

create table if not exists sessions (       -- id = SHA-256 of the cookie token (the token itself is never stored)
  id          text primary key,
  user_id     text not null,
  kind        text not null default 'staff' check (kind in ('staff', 'customer')),
  expires_at  timestamptz not null,
  doc         jsonb not null
);
create index if not exists sessions_user_idx    on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists audit_log (
  id   text primary key,
  at   timestamptz not null,
  doc  jsonb not null
);
create index if not exists audit_at_idx on audit_log (at desc);

create table if not exists contact_messages (
  id          text primary key,
  created_at  timestamptz not null,
  doc         jsonb not null
);
create index if not exists messages_created_idx on contact_messages (created_at desc);

create table if not exists uploads (        -- field photos, already re-encoded to WebP and stripped of metadata
  name        text primary key check (name ~ '^[a-f0-9]{32}\.webp$'),
  data        bytea not null check (octet_length(data) <= 6000000),
  created_at  timestamptz not null default now()
);

create table if not exists rate_limits (
  key       text primary key,
  count     int not null,
  reset_at  timestamptz not null
);

-- ───────────── Lock down Supabase's public API ─────────────
alter table hajzi_meta       enable row level security;
alter table fields           enable row level security;
alter table bookings         enable row level security;
alter table blocks           enable row level security;
alter table users            enable row level security;
alter table customers        enable row level security;
alter table sessions         enable row level security;
alter table audit_log        enable row level security;
alter table contact_messages enable row level security;
alter table uploads          enable row level security;
alter table rate_limits      enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on functions from anon, authenticated';
  end if;
end $$;

-- ───────────── Atomic operations ─────────────

-- Create a booking. Everything that must not race happens here, in one transaction.
create or replace function hajzi_create_booking(
  p_doc jsonb, p_max_per_day int, p_max_active int, p_today date
) returns jsonb
language plpgsql as $$
declare
  f        jsonb;
  v_field  text := p_doc->>'fieldId';
  v_date   date := (p_doc->>'date')::date;
  v_start  int  := (p_doc->>'startMinutes')::int;
  v_dur    int  := (p_doc->>'durationMinutes')::int;
  v_phone  text := coalesce(p_doc->>'phone', '');
  v_price  numeric;
  v_doc    jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('slot:' || v_field || ':' || v_date::text));
  perform pg_advisory_xact_lock(hashtext('phone:' || v_phone));

  select doc into f from fields where id = v_field;
  if f is null then raise exception 'FIELD_NOT_FOUND'; end if;
  if coalesce((f->>'onlineBooking')::boolean, true) = false or coalesce((f->>'pricePerHour')::numeric, 0) <= 0 then
    raise exception 'FIELD_NOT_BOOKABLE';
  end if;
  if (f->>'closeMinutes') is not null and v_start + v_dur > (f->>'closeMinutes')::int then
    raise exception 'OUTSIDE_HOURS';
  end if;

  if exists (select 1 from blocks where field_id = v_field and block_date = v_date
               and int4range(start_minutes, start_minutes + duration_minutes) && int4range(v_start, v_start + v_dur))
     or exists (select 1 from bookings where field_id = v_field and booking_date = v_date and status = 'confirmed'
               and int4range(start_minutes, start_minutes + duration_minutes) && int4range(v_start, v_start + v_dur)) then
    raise exception 'SLOT_TAKEN';
  end if;

  if (select count(*) from bookings where status = 'confirmed' and phone = v_phone and booking_date = v_date) >= p_max_per_day
     or (select count(*) from bookings where status = 'confirmed' and phone = v_phone and booking_date >= p_today) >= p_max_active then
    raise exception 'PHONE_LIMIT';
  end if;

  v_price := round((f->>'pricePerHour')::numeric * v_dur / 60.0, 2);   -- price ALWAYS from the database
  v_doc := p_doc || jsonb_build_object(
    'fieldName', f->'name', 'fieldType', f->'type', 'fieldAddress', f->'address',
    'totalPrice', v_price, 'status', 'confirmed');

  insert into bookings (id, ref, field_id, booking_date, start_minutes, duration_minutes, status, phone, customer_id, doc)
  values (v_doc->>'id', v_doc->>'ref', v_field, v_date, v_start, v_dur, 'confirmed', v_phone, v_doc->>'customerId', v_doc);
  return v_doc;
exception
  when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;

-- Change a booking's status; restoring a cancelled booking must not create a double booking.
create or replace function hajzi_set_booking_status(p_id text, p_status text) returns jsonb
language plpgsql as $$
declare
  b  bookings%rowtype;
begin
  select * into b from bookings where id = p_id;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtext('slot:' || b.field_id || ':' || b.booking_date::text));
  if p_status = 'confirmed' and b.status <> 'confirmed' and exists (
       select 1 from blocks where field_id = b.field_id and block_date = b.booking_date
          and int4range(start_minutes, start_minutes + duration_minutes) && int4range(b.start_minutes, b.start_minutes + b.duration_minutes)) then
    raise exception 'SLOT_TAKEN';
  end if;
  update bookings set status = p_status, doc = doc || jsonb_build_object('status', p_status)
   where id = p_id returning * into b;
  return b.doc;
exception
  when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;

-- Block a slot (admin), never over a confirmed booking.
create or replace function hajzi_add_block(p_id text, p_field text, p_date date, p_start int, p_duration int) returns void
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('slot:' || p_field || ':' || p_date::text));
  if exists (select 1 from bookings where field_id = p_field and booking_date = p_date and status = 'confirmed'
               and int4range(start_minutes, start_minutes + duration_minutes) && int4range(p_start, p_start + p_duration)) then
    raise exception 'SLOT_TAKEN';
  end if;
  insert into blocks (id, field_id, block_date, start_minutes, duration_minutes) values (p_id, p_field, p_date, p_start, p_duration);
exception
  when exclusion_violation then raise exception 'SLOT_TAKEN';
end $$;

-- Fixed-window rate limit counter shared by every server instance.
create or replace function hajzi_rate_hit(p_key text, p_window int) returns table (hits int, reset_seconds int)
language sql as $$
  insert into rate_limits as r (key, count, reset_at) values (p_key, 1, now() + make_interval(secs => p_window))
  on conflict (key) do update set
    count    = case when r.reset_at <= now() then 1 else r.count + 1 end,
    reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window) else r.reset_at end
  returning count, greatest(1, ceil(extract(epoch from (reset_at - now())))::int);
$$;

-- Privacy: anonymise old bookings and delete old logs/messages (called lazily by the app once a day).
create or replace function hajzi_run_retention(p_cutoff date) returns jsonb
language plpgsql as $$
declare nb int; na int; nm int;
begin
  update bookings
     set phone = '',
         doc = (doc - 'notes' - 'players')
               || jsonb_build_object('customerName', '—', 'phone', '', 'accessTokenHash', '', 'anonymized', true)
   where booking_date < p_cutoff and coalesce((doc->>'anonymized')::boolean, false) = false;
  get diagnostics nb = row_count;
  delete from audit_log where at < p_cutoff;
  get diagnostics na = row_count;
  delete from contact_messages where created_at < p_cutoff;
  get diagnostics nm = row_count;
  delete from sessions where expires_at < now();
  delete from rate_limits where reset_at < now();
  return jsonb_build_object('bookings', nb, 'audit', na, 'messages', nm);
end $$;

insert into hajzi_meta (key, value) values ('schema_version', '__SCHEMA_VERSION__')
on conflict (key) do update set value = excluded.value;
`.replace('__SCHEMA_VERSION__', SCHEMA_VERSION);
