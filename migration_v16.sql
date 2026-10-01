-- ============================================================
-- ClinicPilot — Migration v16
-- Exposes billing.split_percentage_override through billing_analytics.
--
-- Per the ticket, billing.split_percentage_override already exists
-- (added outside this repo's checked-in migrations, same gap as v7-v15).
-- This migration only updates the view so Hub.jsx / DoctorRevenue.jsx can
-- read each row's own override for per-invoice split calculations,
-- instead of only the doctor's flat split_percentage. Run this in the
-- Supabase SQL Editor.
-- ============================================================

create or replace view billing_analytics as
select
  b.id,
  b.billing_date,
  b.doctor_id,
  d.name as doctor_name,
  d.color_hex as doctor_color,
  d.is_service_category,
  d.split_percentage,
  b.split_percentage_override,
  b.service,
  b.payment_method,
  b.amount,
  b.billed_amount
from billing b
join doctors d on d.id = b.doctor_id;

grant select on billing_analytics to authenticated;
