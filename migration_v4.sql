-- ============================================================
-- ClinicPilot — Migration v4
-- Run this BEFORE the September data import
-- ============================================================

-- ── 1. Add billed_amount for partial-payment / receivable tracking ──
-- amount = what was actually collected (cash-basis revenue)
-- billed_amount = total invoice value, only set when it differs from amount
-- (i.e. when there's an outstanding balance). NULL means fully paid —
-- amount already represents the whole bill.
alter table billing add column if not exists billed_amount numeric(10,2);

-- ── 2. Add the 5 real doctors referenced in September billing data ──
-- Schedules pulled from YMDC's printed rate card.
insert into doctors (name, specialty, color_hex, working_days, start_time, end_time) values
  ('Dr. A.J Panhwar', 'Family Physician', '#D97706', '{1,2,3,4,5,6}', '10:00', '13:00'),
  ('Farrukh', 'Optometrist, Vision Scientist', '#64748B', '{1,2,3,4,5,6}', '13:00', '15:00'),
  ('Dr. Maqbool Hussain', 'Eye Surgeon', '#92400E', '{2}', '18:00', '20:00'),
  ('Dr. Sheikh Imran', 'Orthopaedic Consultant', '#0EA5E9', '{1,3,5}', '18:30', '19:30'),
  ('Dr. Tara Chand', 'Sonologist (Ultrasound)', '#DB2777', '{1,2,3,4,5,6}', '18:00', '21:00')
on conflict do nothing;

-- ── 3. Add 4 non-doctor service categories as placeholder "doctors" ──
-- so billing can still categorize them (grey = visually distinct from
-- real doctors; these won't make sense to "book an appointment" with).
insert into doctors (name, specialty, color_hex, working_days, start_time, end_time) values
  ('Vitals Checkup', 'Service category — not a doctor', '#9CA3AF', '{1,2,3,4,5,6}', '09:00', '21:00'),
  ('Bandage Dressing', 'Service category — not a doctor', '#A8A29E', '{1,2,3,4,5,6}', '09:00', '21:00'),
  ('IV Procedure', 'Service category — not a doctor', '#78716C', '{1,2,3,4,5,6}', '09:00', '21:00'),
  ('X-Ray', 'Service category — not a doctor', '#57534E', '{1,2,3,4,5,6}', '09:00', '21:00')
on conflict do nothing;
