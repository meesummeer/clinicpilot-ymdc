import JSZip from 'jszip';
import { supabase, fetchAllRows } from './supabaseClient';

// The one place the backup Worker's address lives (see backup-worker/).
export const BACKUP_WORKER_URL = 'https://clinicpilot-backup.ymdc-clinic.workers.dev';

// Add new tables here when migrations add them.
// Listed in a restore-safe order (parents before children). Every table is
// paged by its "id" primary key so pagination is stable.
export const BACKUP_TABLES = [
  'doctors',
  'staff_profiles',
  'staff_members',
  'patients',
  'appointments',
  'billing',
  'billing_payments',
  'doctor_costs',
  'expenses',
  'monthly_pnl_archive',
];

const TIME_ZONE = 'Asia/Karachi';

// ── Time / size formatting (always Asia/Karachi) ──────────────────
function karachiParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

export function backupFileName(date = new Date()) {
  const { y, mo, d, h, mi } = karachiParts(date);
  return `ClinicPilot-YMDC-backup-${y}-${mo}-${d}_${h}${mi}.zip`;
}

export function formatKarachi(isoString) {
  return new Date(isoString).toLocaleString('en-GB', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('You are signed out. Sign in again.');
  return token;
}

// ── Last backup (GET /list, newest first) ─────────────────────────
export async function listBackups() {
  const token = await accessToken();
  const res = await fetch(`${BACKUP_WORKER_URL}/list`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  return res.json();
}

// ── CSV ───────────────────────────────────────────────────────────
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Spreadsheet formula-injection guard — CSV only (the JSON stays lossless).
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function toCsv(rows) {
  const columns = [];
  const seen = new Set();
  rows.forEach((row) => {
    Object.keys(row).forEach((c) => {
      if (!seen.has(c)) {
        seen.add(c);
        columns.push(c);
      }
    });
  });
  const lines = [columns.map(csvCell).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => csvCell(row[c])).join(',')));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const RESTORE_README = `ClinicPilot-YMDC cloud backup — how to restore
==============================================

Each table is in two files: <table>.json (lossless — use this to restore) and
<table>.csv (for looking at in a spreadsheet; text cells that start with = + - or @
have a leading ' added, so do not restore from the CSV).
manifest.json lists when the backup ran, who ran it, and the row count per table.

Restore order (parents before children, so foreign keys are satisfied):
${BACKUP_TABLES.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

Notes
- staff_profiles.id points at Supabase Auth users: re-create the Auth users first
  (same ids), or restore staff_profiles last and re-link.
- Skip generated columns. List them with:
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and is_generated = 'ALWAYS';
- Insert from the JSON files (e.g. via the SQL editor or a script using the service
  role). Triggers on billing (invoice_ref) only fill invoice_ref when it is null, so
  restored invoice references are kept.
- Views (billing_analytics, billing_summary, billing_summary_by_doctor_month,
  patient_last_visit) are not backed up; they rebuild themselves from the tables.
- Check the manifest counts against the database after restoring.
`;

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Fetches every row of one table, no filters (archived/inactive included),
// and proves it got them all: the exact server-side count must equal the
// number of rows received, and ids must be unique (a shifting page order
// would show up as a duplicate). One retry covers someone saving a record
// mid-backup.
async function fetchTableComplete(table) {
  let lastProblem = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { count, error: countError } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (countError) throw new Error(`${table}: ${countError.message}`);
    const { data, error } = await fetchAllRows(() =>
      supabase.from(table).select('*').order('id', { ascending: true })
    );
    if (error) throw new Error(`${table}: ${error.message}`);
    const ids = new Set(data.map((r) => r.id));
    if (data.length === count && ids.size === data.length) return data;
    lastProblem = `${table}: expected ${count} rows but got ${data.length}${ids.size !== data.length ? ' (duplicate ids)' : ''}`;
  }
  throw new Error(lastProblem);
}

// Runs the whole backup and returns { blob, fileName, counts, ... } WITHOUT
// uploading, so a failed upload can still offer the zip as a download.
// Throws on any problem — and then no file exists.
export async function buildBackup({ profile, session, onProgress }) {
  if (profile?.role !== 'admin') throw new Error('Only an admin can run a backup.');
  // expenses and staff_members are readable only with this flag (RLS); without
  // it they would silently come back empty and the backup would be incomplete.
  if (profile.has_expenses_access !== true) {
    throw new Error(
      'This admin account does not have Expenses access, so the expenses and staff_members tables cannot be read in full. Nothing was backed up.'
    );
  }

  const now = new Date();
  const zip = new JSZip();
  const counts = {};
  for (let i = 0; i < BACKUP_TABLES.length; i += 1) {
    const table = BACKUP_TABLES[i];
    onProgress?.({ table, index: i + 1, total: BACKUP_TABLES.length });
    const rows = await fetchTableComplete(table);
    counts[table] = rows.length;
    zip.file(`${table}.json`, JSON.stringify(rows));
    zip.file(`${table}.csv`, toCsv(rows));
  }

  const { y, mo, d, h, mi } = karachiParts(now);
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        app: 'ClinicPilot-YMDC',
        created_at_utc: now.toISOString(),
        created_at_karachi: `${y}-${mo}-${d} ${h}:${mi}`,
        run_by: session?.user?.email || null,
        row_counts: counts,
      },
      null,
      2
    )
  );
  zip.file('RESTORE-README.txt', RESTORE_README);

  onProgress?.({ table: null, index: BACKUP_TABLES.length, total: BACKUP_TABLES.length, packing: true });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, fileName: backupFileName(now), counts };
}

// Uploads a built backup. Throws an Error whose message is the exact reason.
export async function uploadBackup({ blob, fileName }) {
  const token = await accessToken();
  const sha256 = await sha256Hex(blob);
  let res;
  try {
    res = await fetch(`${BACKUP_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
        'X-Sha256': sha256,
        'X-Filename': fileName,
      },
      body: blob,
    });
  } catch (err) {
    throw new Error(`Network error while uploading: ${err.message}`);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error body — fall through with the status only
  }
  if (res.status === 201) return body;
  if (res.status === 409) {
    throw new Error('A backup with this name already exists. Wait a minute and try again.');
  }
  throw new Error(`Upload failed (${res.status}): ${body?.error || 'no details'}`);
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
