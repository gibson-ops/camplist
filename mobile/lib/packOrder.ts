/**
 * Where a row sits once a list has been re-sorted: what still needs doing, first.
 *
 * The order is the packing cycle read downward — unpacked at the top, then packed, then loaded at
 * the bottom. Jared's words: "check sinks to the bottom, pack sinks above checked, and unchecked is
 * always at the top." What is left to do is what you are looking at; what is done has earned its
 * way out of the way.
 */
const RANK: Record<string, number> = { unpacked: 0, packed: 1, loaded: 2 };

/** Anything the trip screen sorts. Kit contents use `checked`; list rows use `state`. */
export type Sortable = {
  id: string;
  state?: string | null;
  /** Set on a kit's contents, which are two-state. Wins over `state` when present. */
  checked?: boolean | null;
  sortOrder?: number | null;
  createdAt: Date | string;
};

function rankOf(row: Sortable): number {
  if (typeof row.checked === 'boolean') return row.checked ? RANK.loaded : RANK.unpacked;
  return RANK[row.state ?? 'unpacked'] ?? 0;
}

/**
 * The ids of `rows`, in the order the list should take when it is next re-sorted.
 *
 * RETURNS AN ORDER, NOT SORTED ROWS, and that is the whole design. Sorting the rows as they render
 * would re-sort on every tap, which is precisely the thing to avoid: check something off in a long
 * list and it leaves the screen, taking your place with it. The caller freezes this order and keeps
 * using it while you work — see `useFrozenOrder`.
 *
 * Ties fall back to the list's own ordering, so re-sorting never scrambles rows that share a state.
 */
export function packOrder(rows: Sortable[]): string[] {
  return [...rows]
    .sort(
      (a, b) =>
        rankOf(a) - rankOf(b) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        +new Date(a.createdAt) - +new Date(b.createdAt),
    )
    .map((row) => row.id);
}

/**
 * Applies a frozen order to the current rows.
 *
 * Anything the order has not seen — added since the last re-sort — keeps its natural position at
 * the end rather than being dropped or jumping to the top. A row that has vanished is simply
 * absent, so a stale order can never resurrect one.
 */
export function applyOrder<T extends { id: string }>(rows: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
