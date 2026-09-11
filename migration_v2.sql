-- ============================================================
-- ClinicPilot — Migration v2
-- Run this in Supabase SQL Editor (after the original schema.sql)
-- ============================================================

-- ── 1. Doctor working schedule ──────────────────────────────────
alter table doctors add column if not exists working_days int[] not null default '{1,2,3,4,5,6}';
-- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
alter table doctors add column if not exists start_time time not null default '09:00';
alter table doctors add column if not exists end_time time not null default '21:00';

-- Set actual schedules from YMDC's printed rate card
update doctors set working_days = '{1,2,3,4,5,6}', start_time = '18:30', end_time = '21:30' where name = 'Dr. Anwer Majeed';
update doctors set working_days = '{1,2,3,4,5,6}', start_time = '15:00', end_time = '17:00' where name = 'Dr. Aneela Shaikh';
update doctors set working_days = '{1,2,3,4,5}',   start_time = '15:30', end_time = '18:00' where name = 'Dr. Salman Ali Ahmad'; -- Mon-Fri only, not Sat
update doctors set working_days = '{1,2,3,4,5,6}', start_time = '15:00', end_time = '21:00' where name = 'Dr. Yusra Ali';
update doctors set working_days = '{1,2,3,4,5,6}', start_time = '15:00', end_time = '21:00' where name = 'Dr. Ali Moiz';
update doctors set working_days = '{1,2,3,4,5,6}', start_time = '17:00', end_time = '22:00' where name = 'Dr. Rashid Ali';
update doctors set working_days = '{1,2,3,4,5,6}', start_time = '17:00', end_time = '22:00' where name = 'Dr. Hafiza Sundas';

-- ── 2. Billing: add service + patient age (for invoice printing) ──
alter table billing add column if not exists service text;
alter table billing add column if not exists patient_age int;
alter table billing add column if not exists invoice_ref text unique;

-- ── 3. Invoice reference number generator ───────────────────────
-- Format matches YMDC's existing receipts: YY-##### (e.g. 25-10913)
create sequence if not exists invoice_ref_seq start 10000;

create or replace function generate_invoice_ref()
returns text as $$
declare
  yy text := to_char(current_date, 'YY');
  n bigint := nextval('invoice_ref_seq');
begin
  return yy || '-' || n::text;
end;
$$ language plpgsql;

create or replace function set_invoice_ref()
returns trigger as $$
begin
  if new.invoice_ref is null then
    new.invoice_ref := generate_invoice_ref();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_billing_invoice_ref on billing;
create trigger trg_billing_invoice_ref
  before insert on billing
  for each row execute function set_invoice_ref();

-- ── 4. Allow admin + csr to UPDATE and DELETE appointments/billing ──
-- (appointments_update / delete policies already exist from schema.sql —
--  this just confirms csr can update status, admin can delete)
-- No change needed if schema.sql v1 was already run as-is.
