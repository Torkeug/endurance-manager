// Shared database utilities for server and client components.

// Paginate through a Supabase query in chunks of 1000 to bypass PostgREST's
// server-side row cap. The cap is enforced regardless of .range() or key type —
// pagination is the only reliable workaround.
//
// Usage:
//   const rows = await fetchAllRows((from, to) =>
//     supabase.from("my_table").select("*").eq("driver_id", id).range(from, to)
//   );
export async function fetchAllRows(buildQuery) {
  const PAGE_SIZE = 1000;
  let from = 0;
  let allRows = [];
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allRows = [...allRows, ...(data || [])];
    // Fewer rows than PAGE_SIZE means we've reached the last page
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}
