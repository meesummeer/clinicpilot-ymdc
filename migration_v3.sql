-- ============================================================
-- ClinicPilot — Migration v3
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Restrict billing DELETE to meesummir@icloud.com specifically ──
-- (previously any 'admin' role could delete; now it's locked to one person)
drop policy if exists "billing_delete" on billing;
create policy "billing_delete" on billing for delete
  using ((auth.jwt() ->> 'email') = 'meesummir@icloud.com');

-- Appointments stay deletable by any admin (unchanged) — only billing/invoice
-- deletion is restricted. If you want appointment deletion locked the same
-- way, uncomment below:
-- drop policy if exists "appointments_delete" on appointments;
-- create policy "appointments_delete" on appointments for delete
--   using ((auth.jwt() ->> 'email') = 'meesummir@icloud.com');

-- ── 2. Set up the 3 real staff accounts ─────────────────────────
-- These INSERT ... SELECT statements only work if the person has already
-- been created in Authentication → Users with that exact email.
-- If an email doesn't exist yet as an Auth user, create it first, then
-- re-run this migration — it's safe to run multiple times.

insert into staff_profiles (id, full_name, role)
select id, 'Admin', 'admin' from auth.users where email = 'meesummir@icloud.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into staff_profiles (id, full_name, role)
select id, 'CEO', 'ceo' from auth.users where email = 'moizshakeel14@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into staff_profiles (id, full_name, role)
select id, 'CSR', 'csr' from auth.users where email = 'ymdc.karachi@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

-- ── 3. Sanity check — confirm all 3 landed correctly ────────────
select u.email, p.full_name, p.role
from staff_profiles p
join auth.users u on u.id = p.id
order by p.role;
