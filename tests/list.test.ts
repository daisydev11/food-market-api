import { describe, expect, it } from "vitest";
import { config } from "@/config";
import { ApiError } from "@/lib/http";
import { isId, newId } from "@/lib/ids";
import { parseListQuery, q } from "@/lib/list";
import { NEXT_STATUS } from "@/lib/resources";

const options = { filters: { search: q.text("search"), cuisine: q.text("cuisine"), minRating: q.number("minRating", 0, 5) }, sortable: ["name", "rating"], defaultSort: { field: "name", order: "asc" as const } };
const parse = (query: string) => parseListQuery(new Request(`http://x/api/v1/restaurants${query}`), options);
const failure = (query: string) => {
  try {
    parse(query);
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected a failure");
};

describe("list query contract", () => {
  it("accepts a name search alongside other filters", () => {
    expect(parse("?search=buka&cuisine=nigerian").filters).toEqual({ search: "buka", cuisine: "nigerian" });
  });

  it("refuses an empty search rather than treating it as no filter", () => {
    expect(failure("?search=").status).toBe(400);
  });

  it("uses the configured defaults when nothing is supplied", () => {
    expect(parse("")).toMatchObject({ limit: config.pagination.defaultLimit, sort: "name", order: "asc", offset: undefined, cursor: undefined });
  });

  it("clamps an oversized limit to the maximum instead of honouring or refusing it", () => {
    expect(parse("?limit=5000").limit).toBe(config.pagination.maxLimit);
  });

  it("refuses bad paging input with 400 and names the parameter", () => {
    for (const [query, field] of [["?offset=-1", "offset"], ["?limit=0", "limit"], ["?limit=abc", "limit"], ["?limit=1.5", "limit"], ["?order=sideways", "order"]] as const) {
      const error = failure(query);
      expect(error.status).toBe(400);
      expect(error.fields).toHaveProperty(field);
    }
  });

  it("refuses an unknown sort field and an unknown parameter", () => {
    expect(failure("?sort=popularity").fields?.sort).toContain("name, rating");
    expect(failure("?colour=blue").fields).toHaveProperty("colour");
  });

  it("refuses cursor and offset together", () => {
    expect(failure("?cursor=rst_x&offset=20").status).toBe(400);
  });

  it("parses filters into typed values", () => {
    expect(parse("?cuisine=pizza&minRating=4.5").filters).toEqual({ cuisine: "pizza", minRating: 4.5 });
    expect(failure("?minRating=9").fields).toHaveProperty("minRating");
  });
});

describe("identifiers", () => {
  it("are prefixed, random and not sequential", () => {
    const a = newId("restaurant");
    expect(a).toMatch(/^rst_[0-9a-z]{20}$/);
    expect(newId("restaurant")).not.toBe(a);
  });

  it("anything else is recognised as malformed without a database query", () => {
    for (const bad of ["1", "rst_short", "ord_aaaaaaaaaaaaaaaaaaaa", "rst_AAAAAAAAAAAAAAAAAAAA", "'; DROP TABLE"]) expect(isId("restaurant", bad)).toBe(false);
  });
});

describe("order status", () => {
  it("finished orders cannot move again", () => {
    expect(NEXT_STATUS.delivered).toEqual([]);
    expect(NEXT_STATUS.cancelled).toEqual([]);
    expect(NEXT_STATUS.out_for_delivery).not.toContain("cancelled");
  });
});
