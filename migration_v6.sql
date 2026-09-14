-- ============================================================
-- ClinicPilot — Migration v6
-- Adds the Hub finance/analytics dashboard (admin + ceo only)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Revenue split + service-category flag on doctors ────────
-- split_percentage = YMDC's (centre's) percentage share of that doctor's
-- net revenue after costs. Default 30 (i.e. standard 70/30, doctor gets 70%).
alter table doctors add column if not exists split_percentage numeric(5,2) not null default 30;
alter table doctors add column if not exists is_service_category boolean not null default false;

-- The 4 non-doctor placeholder entries are 100% centre revenue — no split.
update doctors set is_service_category = true
  where name in ('Vitals Checkup', 'Bandage Dressing', 'IV Procedure', 'X-Ray');

-- ── 2. doctor_costs — costs deducted from a doctor's gross revenue
-- before the revenue split is calculated ────────────────────────
create table doctor_costs (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id),
  cost_date date not null default current_date,
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  created_by uuid references staff_profiles(id),
  created_at timestamptz not null default now()
);
create index idx_doctor_costs_date on doctor_costs(cost_date);
create index idx_doctor_costs_doctor on doctor_costs(doctor_id);

-- RLS: admin has full CRUD, ceo can only view, csr has no access at all.
alter table doctor_costs enable row level security;
create policy "doctor_costs_select" on doctor_costs for select
  using (current_role_name() in ('admin', 'ceo'));
create policy "doctor_costs_admin_write" on doctor_costs for all
  using (current_role_name() = 'admin')
  with check (current_role_name() = 'admin');

-- ── 3. billing_analytics — privacy-safe aggregate view for Hub ──
-- Deliberately excludes patient_name, patient_phone, patient_age, notes,
-- and invoice_ref, so CEO's role continues to never see identifiable
-- patient data anywhere in the app, consistent with the rest of this
-- system's design.
create view billing_analytics as
select
  b.id,
  b.billing_date,
  b.doctor_id,
  d.name as doctor_name,
  d.color_hex as doctor_color,
  d.is_service_category,
  d.split_percentage,
  b.service,
  b.payment_method,
  b.amount,
  b.billed_amount
from billing b
join doctors d on d.id = b.doctor_id;

grant select on billing_analytics to authenticated;
