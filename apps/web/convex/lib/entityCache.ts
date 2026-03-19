import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type CachedTable = "users" | "books" | "copies" | "partnerLocations";

/**
 * Creates cached entity getters to avoid redundant DB lookups within a single
 * query/mutation handler. Each getter caches null results too, so a missing
 * entity is only queried once.
 */
export function createEntityCache(ctx: QueryCtx) {
  function cachedGetter<T extends CachedTable>() {
    const cache = new Map<Id<T>, Doc<T> | null>();
    return async (id: Id<T>): Promise<Doc<T> | null> => {
      if (cache.has(id)) return cache.get(id) ?? null;
      const doc = await ctx.db.get(id);
      cache.set(id, doc);
      return doc;
    };
  }

  return {
    getUser: cachedGetter<"users">(),
    getBook: cachedGetter<"books">(),
    getCopy: cachedGetter<"copies">(),
    getLocation: cachedGetter<"partnerLocations">(),
  };
}
