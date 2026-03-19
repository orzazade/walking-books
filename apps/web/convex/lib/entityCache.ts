import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Creates cached entity getters to avoid redundant DB lookups within a single
 * query/mutation handler. Each getter caches null results too, so a missing
 * entity is only queried once.
 */
export function createEntityCache(ctx: QueryCtx) {
  const userCache = new Map<Id<"users">, Doc<"users"> | null>();
  const bookCache = new Map<Id<"books">, Doc<"books"> | null>();
  const copyCache = new Map<Id<"copies">, Doc<"copies"> | null>();
  const locationCache = new Map<Id<"partnerLocations">, Doc<"partnerLocations"> | null>();

  async function getUser(id: Id<"users">) {
    if (userCache.has(id)) return userCache.get(id)!;
    const u = await ctx.db.get(id);
    userCache.set(id, u);
    return u;
  }

  async function getBook(id: Id<"books">) {
    if (bookCache.has(id)) return bookCache.get(id)!;
    const b = await ctx.db.get(id);
    bookCache.set(id, b);
    return b;
  }

  async function getCopy(id: Id<"copies">) {
    if (copyCache.has(id)) return copyCache.get(id)!;
    const c = await ctx.db.get(id);
    copyCache.set(id, c);
    return c;
  }

  async function getLocation(id: Id<"partnerLocations">) {
    if (locationCache.has(id)) return locationCache.get(id)!;
    const l = await ctx.db.get(id);
    locationCache.set(id, l);
    return l;
  }

  return { getUser, getBook, getCopy, getLocation };
}
