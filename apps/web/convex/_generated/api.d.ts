/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as books from "../books.js";
import type * as conditionReports from "../conditionReports.js";
import type * as copies from "../copies.js";
import type * as crons from "../crons.js";
import type * as follows from "../follows.js";
import type * as http from "../http.js";
import type * as journeyEntries from "../journeyEntries.js";
import type * as lib_lending from "../lib/lending.js";
import type * as lib_reputation from "../lib/reputation.js";
import type * as notifications from "../notifications.js";
import type * as partnerLocations from "../partnerLocations.js";
import type * as readingHistory from "../readingHistory.js";
import type * as recommendations from "../recommendations.js";
import type * as reservations from "../reservations.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  books: typeof books;
  conditionReports: typeof conditionReports;
  copies: typeof copies;
  crons: typeof crons;
  follows: typeof follows;
  http: typeof http;
  journeyEntries: typeof journeyEntries;
  "lib/lending": typeof lib_lending;
  "lib/reputation": typeof lib_reputation;
  notifications: typeof notifications;
  partnerLocations: typeof partnerLocations;
  readingHistory: typeof readingHistory;
  recommendations: typeof recommendations;
  reservations: typeof reservations;
  reviews: typeof reviews;
  seed: typeof seed;
  users: typeof users;
  wishlist: typeof wishlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
