-- ============================================================
-- ClinicPilot — Migration v5
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Add end_time to appointments, alongside the existing start time ──
-- Nullable — existing appointments without an end time keep working fine.
alter table appointments add column if not exists end_time time;

-- ── 2. Add patient_phone to billing, for the New Billing Entry form ──
alter table billing add column if not exists patient_phone text;
