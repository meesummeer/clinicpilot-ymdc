-- ============================================================
-- ClinicPilot — Migration v15
-- Adds has_hub_access on staff_profiles, mirroring the existing
-- has_expenses_access flag, so a non-admin/non-ceo staff member can be
-- individually granted access to the Hub finance dashboard.
--
-- NOTE: this repo is missing migration files v7–v14 (including whichever
-- one added has_expenses_access) — they were applied directly to Supabase
-- and never checked in. This file is numbered v15 on the assumption v14
-- (the Historical P&L archive / monthly_pnl_archive migration) was the
-- last one actually run; if that's not accurate, rename accordingly
-- before running. Run this in the Supabase SQL Editor.
-- ============================================================

alter table staff_profiles add column if not exists has_hub_access boolean not null default false;
