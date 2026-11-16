// True when a Supabase/PostgREST error means "the database refused this for
// your role" rather than a real fault. An UPDATE that row-level security
// filters out affects zero rows, which .single() reports as PGRST116.
export function isPermissionError(error) {
  if (!error) return false;
  return (
    error.code === '42501' ||
    error.code === 'PGRST116' ||
    /row-level security|permission denied|not allowed/i.test(error.message || '')
  );
}
