import { vi } from "vitest";

/**
 * A minimal, reusable mock of the Supabase server client for unit-testing the
 * data-shaping logic in `lib/**` without a real database.
 *
 * The real PostgREST query builder is chainable and thenable: methods like
 * `.select()`, `.eq()`, `.order()` return the builder, and awaiting the builder
 * (or calling `.single()` / `.maybeSingle()`) resolves to `{ data, error }`.
 * This mock reproduces that shape so functions such as `listSalesQuotations`
 * can be driven with canned rows.
 */

export type QueryResult<T = unknown> = {
  data: T;
  error: unknown;
  /** Row count for `.select("*", { count: "exact", head: true })` queries. */
  count?: number;
};

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
  "or",
  "not",
  "match",
  "filter",
  "contains",
  "order",
  "limit",
  "range",
] as const;

export type QueryBuilderMock = Record<string, ReturnType<typeof vi.fn>> & {
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

export function createQueryBuilder(result: QueryResult): QueryBuilderMock {
  const builder = {} as QueryBuilderMock;

  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }

  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);

  // Make the builder awaitable so `await supabase.from(t).select()...` resolves.
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

export type SupabaseMockConfig = {
  /**
   * Canned results keyed by table name. Pass an array to return a different
   * result on each successive `.from(table)` call (consumed in order; the last
   * entry is reused once the queue is exhausted).
   */
  tables?: Record<string, QueryResult | QueryResult[]>;
  user?: { id: string; email?: string } | null;
  authError?: unknown;
  /** Error returned from `auth.signUp` (null = success). */
  signUpError?: unknown;
  /** Error returned from `auth.signInWithPassword` (null = success). */
  signInError?: unknown;
  /** JWT claims returned from `auth.getClaims()` (undefined = use `user` as claims). */
  claims?: { sub: string; email?: string } | null;
  /** Error returned from `auth.getClaims()` (null = success). */
  claimsError?: unknown;
  /** Error returned from `auth.updateUser` (null = success). */
  updateUserError?: unknown;
  /** Error returned from `auth.signOut` (null = success). */
  signOutError?: unknown;
  /** Error returned from `rpc()` calls (null = success). */
  rpcError?: unknown;
};

export type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    getClaims: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
};

export function createSupabaseMock(config: SupabaseMockConfig = {}): SupabaseMock {
  const queues: Record<string, QueryResult[]> = {};
  for (const [table, value] of Object.entries(config.tables ?? {})) {
    queues[table] = Array.isArray(value) ? [...value] : [value];
  }

  const from = vi.fn((table: string) => {
    const queue = queues[table];
    let result: QueryResult = { data: null, error: null };

    if (queue && queue.length > 0) {
      result = queue.length > 1 ? queue.shift()! : queue[0];
    }

    return createQueryBuilder(result);
  });

  const getUser = vi.fn(async () => ({
    data: { user: config.user ?? null },
    error: config.authError ?? null,
  }));

  const defaultClaims =
    config.claims !== undefined
      ? config.claims
      : config.user
        ? { sub: config.user.id, email: config.user.email }
        : null;

  const getClaims = vi.fn(async () => ({
    data: { claims: defaultClaims },
    error: config.claimsError ?? null,
  }));

  const signUp = vi.fn(async () => ({
    data: { user: config.user ?? null, session: null },
    error: config.signUpError ?? null,
  }));

  const signInWithPassword = vi.fn(async () => ({
    data: { user: config.user ?? null, session: null },
    error: config.signInError ?? null,
  }));

  const updateUser = vi.fn(async () => ({
    data: { user: config.user ?? null },
    error: config.updateUserError ?? null,
  }));

  const signOut = vi.fn(async () => ({ error: config.signOutError ?? null }));

  const rpc = vi.fn(async () => ({ data: null, error: config.rpcError ?? null }));

  return {
    from,
    rpc,
    auth: { getUser, getClaims, signUp, signInWithPassword, updateUser, signOut },
  };
}
