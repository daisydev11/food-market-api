import { z } from "zod";
import { config } from "@/config";
import { ApiError, toFieldErrors } from "@/lib/http";

// The list contract shared by every collection endpoint: pagination,
// filtering and sorting are parsed and validated here, once.

const { defaultLimit, maxLimit } = config.pagination;

const integer = (name: string) => z.string().regex(/^-?\d+$/, `${name} must be a whole number.`).transform(Number);

const pagingSchema = z.object({
  // A limit above the maximum is clamped, not refused: asking for 5000 gets you 100.
  limit: integer("limit").refine((n) => n >= 1, "limit must be at least 1.").transform((n) => Math.min(n, maxLimit)).default(String(defaultLimit)),
  offset: integer("offset").refine((n) => n >= 0, "offset must be 0 or greater.").optional(),
  cursor: z.string().min(1, "cursor must not be empty.").max(100, "cursor is not valid.").optional(),
  order: z.enum(["asc", "desc"], { errorMap: () => ({ message: "order must be asc or desc." }) }).optional(),
});

export type ListQuery<F> = { filters: F; limit: number; offset?: number; cursor?: string; sort: string; order: "asc" | "desc" };

type Options<F extends z.ZodRawShape> = {
  filters: F;
  sortable: readonly string[];
  defaultSort: { field: string; order: "asc" | "desc" };
};

/**
 * Validates a list endpoint's query string. Unknown parameters, an unknown
 * sort field, a negative offset or a non-numeric limit are all 400 with the
 * parameter named. Nothing is silently ignored.
 */
export function parseListQuery<F extends z.ZodRawShape>(request: Request, options: Options<F>): ListQuery<z.infer<z.ZodObject<F>>> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const schema = pagingSchema
    .extend({
      sort: z.enum(options.sortable as [string, ...string[]], { errorMap: () => ({ message: `sort must be one of: ${options.sortable.join(", ")}.` }) }).optional(),
    })
    .extend(options.filters)
    .strict();

  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "One or more query parameters are invalid.", toFieldErrors(parsed.error));
  const { limit, offset, cursor, sort, order, ...filters } = parsed.data as Record<string, unknown>;
  if (offset !== undefined && cursor !== undefined) {
    throw new ApiError(400, "INVALID_QUERY", "Use either cursor or offset, not both.", { cursor: "Cannot be combined with offset." });
  }
  return {
    filters: filters as z.infer<z.ZodObject<F>>,
    limit: limit as number,
    offset: offset as number | undefined,
    cursor: cursor as string | undefined,
    sort: (sort as string | undefined) ?? options.defaultSort.field,
    order: (order as "asc" | "desc" | undefined) ?? (sort ? "asc" : options.defaultSort.order),
  };
}

type Source<W, T extends { id: string }> = {
  where: W;
  count: (where: W) => Promise<number>;
  findMany: (args: { where: W; orderBy: Record<string, "asc" | "desc">[]; take: number; skip?: number; cursor?: { id: string } }) => Promise<T[]>;
  exists: (id: string) => Promise<boolean>;
};

/**
 * Runs a paginated query and builds the "meta" block.
 *
 * Cursor mode (the default way to page): the cursor is the id of the last
 * item you received. The database continues from that row in the current sort
 * order, so pages stay correct while rows are being inserted or deleted, and
 * page 500 costs the same as page 1.
 *
 * Offset mode: skips N rows. Simple and lets a client jump to any position,
 * but it gets slower the deeper you go and can skip or repeat rows if the
 * data changes between requests.
 */
export async function paginate<W, T extends { id: string }>(query: ListQuery<unknown>, source: Source<W, T>) {
  // id is always the final sort key, so the order is total even when many rows share a value.
  const orderBy = [...(query.sort === "id" ? [] : [{ [query.sort]: query.order }]), { id: query.order }];
  if (query.cursor && !(await source.exists(query.cursor))) {
    throw new ApiError(400, "INVALID_CURSOR", "The cursor does not match any record. Use the nextCursor from a previous response.", { cursor: "Unknown cursor." });
  }
  const [total, rows] = await Promise.all([
    source.count(source.where),
    source.findMany({
      where: source.where,
      orderBy,
      take: query.limit + 1, // one extra row tells us whether another page exists
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : query.offset ? { skip: query.offset } : {}),
    }),
  ]);
  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    data,
    meta: {
      total,
      limit: query.limit,
      offset: query.cursor ? null : (query.offset ?? 0),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    },
  };
}

// Reusable query-string field types.
export const q = {
  text: (name: string) => z.string().trim().min(1, `${name} must not be empty.`).max(80, `${name} is too long.`).optional(),
  int: (name: string, min = 0) => integer(name).refine((n) => n >= min, `${name} must be ${min} or greater.`).optional(),
  number: (name: string, min: number, max: number) =>
    z.string().regex(/^\d+(\.\d+)?$/, `${name} must be a number.`).transform(Number).refine((n) => n >= min && n <= max, `${name} must be between ${min} and ${max}.`).optional(),
  bool: (name: string) => z.enum(["true", "false"], { errorMap: () => ({ message: `${name} must be true or false.` }) }).transform((v) => v === "true").optional(),
  date: (name: string) => z.string().refine((v) => !Number.isNaN(Date.parse(v)), `${name} must be an ISO date, e.g. 2026-01-31.`).transform((v) => new Date(v)).optional(),
};
