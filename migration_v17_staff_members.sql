-- ============================================================
-- ClinicPilot — Migration v17
-- Moves the Salary expense "Staff Member" roster out of code
-- (STAFF_ROSTER in src/pages/Expenses.jsx) into a table, so admins can add
-- staff and set default base salaries from the app.
--
-- expenses.staff_name is NOT touched: salary expenses keep storing the
-- staff member's name as text, so historical rows, Hub and PDFs read
-- exactly as before. Staff are deactivated (is_active = false), never
-- deleted — there is deliberately no delete policy.
--
-- RLS mirrors who can use the Expenses page in the app:
--   select          admin, or anyone with has_expenses_access
--   insert / update admin, or csr with has_expenses_access
-- (The expenses table's own policies were applied outside this repo — see
-- the note in migration_v15.sql — so compare the policies below against
-- `select * from pg_policies where tablename = 'expenses'` and adjust if
-- they differ.)
--
-- Safe to re-run. Run this in the Supabase SQL Editor BEFORE the new
-- front-end deploys.
-- ============================================================

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  role text,
  default_base_salary numeric,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Names are unique ignoring case too ("elza" and "Elza" are the same person).
create unique index if not exists staff_members_name_lower_key
  on public.staff_members (lower(name));

alter table public.staff_members enable row level security;

drop policy if exists "staff_members_select" on public.staff_members;
create policy "staff_members_select" on public.staff_members for select
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and (sp.role = 'admin' or sp.has_expenses_access = true)
    )
  );

drop policy if exists "staff_members_insert" on public.staff_members;
create policy "staff_members_insert" on public.staff_members for insert
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and (sp.role = 'admin' or (sp.role = 'csr' and sp.has_expenses_access = true))
    )
  );

drop policy if exists "staff_members_update" on public.staff_members;
create policy "staff_members_update" on public.staff_members for update
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and (sp.role = 'admin' or (sp.role = 'csr' and sp.has_expenses_access = true))
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and (sp.role = 'admin' or (sp.role = 'csr' and sp.has_expenses_access = true))
    )
  );
-- No delete policy on purpose.

grant select, insert, update on public.staff_members to authenticated;

-- Seed: the current roster plus Elza.
insert into public.staff_members (name, default_base_salary) values
  ('Warsha', 35000),
  ('Rashid', 55000),
  ('Rajesh', 25000),
  ('Gul Yar', 27000),
  ('Zubair', 25000),
  ('Elza', 35000)
on conflict (name) do nothing;
