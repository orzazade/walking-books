/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as achievements from "../achievements.js";
import type * as activityFeed from "../activityFeed.js";
import type * as bookJourney from "../bookJourney.js";
import type * as bookNotes from "../bookNotes.js";
import type * as bookRequests from "../bookRequests.js";
import type * as books from "../books.js";
import type * as collections from "../collections.js";
import type * as conditionReports from "../conditionReports.js";
import type * as copies from "../copies.js";
import type * as crons from "../crons.js";
import type * as follows from "../follows.js";
import type * as http from "../http.js";
import type * as journeyEntries from "../journeyEntries.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_lending from "../lib/lending.js";
import type * as locationReviews from "../locationReviews.js";
import type * as lib_reputation from "../lib/reputation.js";
import type * as notifications from "../notifications.js";
import type * as partnerLocations from "../partnerLocations.js";
import type * as readingGoals from "../readingGoals.js";
import type * as readingHistory from "../readingHistory.js";
import type * as readingProgress from "../readingProgress.js";
import type * as readingStats from "../readingStats.js";
import type * as readingStreaks from "../readingStreaks.js";
import type * as recommendations from "../recommendations.js";
import type * as reservations from "../reservations.js";
import type * as reviewVotes from "../reviewVotes.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as sharerActivity from "../sharerActivity.js";
import type * as sharerStats from "../sharerStats.js";
import type * as suggestedFollows from "../suggestedFollows.js";
import type * as trendingBooks from "../trendingBooks.js";
import type * as users from "../users.js";
import type * as waitlist from "../waitlist.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  achievements: typeof achievements;
  activityFeed: typeof activityFeed;
  bookJourney: typeof bookJourney;
  bookNotes: typeof bookNotes;
  bookRequests: typeof bookRequests;
  books: typeof books;
  collections: typeof collections;
  conditionReports: typeof conditionReports;
  copies: typeof copies;
  crons: typeof crons;
  follows: typeof follows;
  http: typeof http;
  journeyEntries: typeof journeyEntries;
  leaderboard: typeof leaderboard;
  "lib/lending": typeof lib_lending;
  locationReviews: typeof locationReviews;
  "lib/reputation": typeof lib_reputation;
  notifications: typeof notifications;
  partnerLocations: typeof partnerLocations;
  readingGoals: typeof readingGoals;
  readingHistory: typeof readingHistory;
  readingProgress: typeof readingProgress;
  readingStats: typeof readingStats;
  readingStreaks: typeof readingStreaks;
  recommendations: typeof recommendations;
  reservations: typeof reservations;
  reviewVotes: typeof reviewVotes;
  reviews: typeof reviews;
  seed: typeof seed;
  sharerActivity: typeof sharerActivity;
  sharerStats: typeof sharerStats;
  suggestedFollows: typeof suggestedFollows;
  trendingBooks: typeof trendingBooks;
  users: typeof users;
  waitlist: typeof waitlist;
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
