import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// PostgREST caps a single response at the project's default max rows
// (1000) even when a query legitimately matches more — a busy month of
// billing/billing_payments rows can exceed that silently, with no error,
// just a truncated result. This pages through with .range() until a page
// comes back short, so every matching row is returned.
//
// buildQuery must be a function that returns a FRESH query each call (not
// a query object built once) — .range() has to be applied per page, and
// the same PostgrestFilterBuilder can't be re-awaited after it's already
// been executed once. The query buildQuery returns must end in a
// deterministic .order() (including a unique tiebreaker column, e.g. id)
// — without one, Postgres doesn't guarantee stable row order across
// separate requests, and .range() pagination can silently skip or
// duplicate rows.
const PAGE_SIZE = 1000;

export async function fetchAllRows(buildQuery) {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: allRows, error };
    allRows = allRows.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: allRows, error: null };
}

// A .in(column, ids) filter puts every id directly in the request URL, so
// a large id list (a busy month can mean 1000+ billing IDs) can exceed the
// server's URL length limit and 400 the whole request — confirmed live: a
// 1030-id list produced a ~38KB URL and a flat 400. This chunks the id
// list into smaller .in() queries and concatenates the results, with each
// chunk still run through fetchAllRows in case that chunk's own matches
// exceed the response cap.
//
// buildQuery must be a function returning a fresh query (same reason as
// fetchAllRows) that has NOT already called .in() for this column — that
// call is added per chunk here.
const ID_CHUNK_SIZE = 150;

export async function fetchAllRowsByIds(buildQuery, idColumn, ids) {
  let allRows = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE);
    const { data, error } = await fetchAllRows(() => buildQuery().in(idColumn, chunk));
    if (error) return { data: allRows, error };
    allRows = allRows.concat(data || []);
  }
  return { data: allRows, error: null };
}
