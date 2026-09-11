-- ============================================================
-- ClinicPilot — Migration 2: Doctor hours, billing service field,
-- invoice numbering
-- Run this in Supabase SQL Editor (your original schema.sql
-- already ran — this only ADDS to it, safe to run once).
-- ============================================================

-- ── Doctor working days & hours ─────────────────────────────
alter table doctors add column if not exists working_days text[] not null default '{Mon,Tue,Wed,Thu,Fri,Sat}';
alter table doctors add column if not exists start_time time not null default '15:00';
alter table doctors add column if not exists end_time time not null default '21:00';

-- Set each doctor's actual hours from the clinic's printed schedule
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri,Sat}', start_time = '18:30', end_time = '21:30' where name = 'Dr. Anwer Majeed';
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri,Sat}', start_time = '15:00', end_time = '17:00' where name = 'Dr. Aneela Shaikh';
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri}',     start_time = '15:30', end_time = '18:00' where name = 'Dr. Salman Ali Ahmad';
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri,Sat}', start_time = '15:00', end_time = '21:00' where name = 'Dr. Yusra Ali';
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri,Sat}', start_time = '15:00', end_time = '21:00' where name = 'Dr. Ali Moiz';
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri,Sat}', start_time = '17:00', end_time = '22:00' where name = 'Dr. Rashid Ali';
update doctors set working_days = '{Mon,Tue,Wed,Thu,Fri,Sat}', start_time = '17:00', end_time = '22:00' where name = 'Dr. Hafiza Sundas';

-- Admin needs to be able to edit doctor hours/days/colors from the app
drop policy if exists "doctors_admin_write" on doctors;
create policy "doctors_admin_write" on doctors for all
  using (current_role_name() = 'admin')
  with check (current_role_name() = 'admin');

-- ── Billing: service field + patient age (for invoices) ─────
alter table billing add column if not exists service text;
alter table billing add column if not exists patient_age int;

-- ── Invoice numbering (format: YY-##### e.g. 26-00001) ──────
create sequence if not exists invoice_seq start 1;

create or replace function generate_invoice_no()
returns text as $$
declare
  yr text := to_char(current_date, 'YY');
  n bigint := nextval('invoice_seq');
begin
  return yr || '-' || lpad(n::text, 5, '0');
end;
$$ language plpgsql;

alter table billing add column if not exists invoice_no text unique default generate_invoice_no();
