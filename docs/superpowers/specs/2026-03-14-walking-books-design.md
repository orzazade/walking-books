# The Walking Books — Design Specification

**Date:** 2026-03-14
**Status:** Draft
**Author:** Orkhan Rzazade

## Overview

The Walking Books is a community book-sharing platform where people register physical books, drop them at partner locations (cafes, bookshops, coworking spaces), and other readers discover, reserve, pick up, read, and return them. Each physical copy builds a unique travel history as it moves between readers and locations.

## Problem

People have books sitting idle on shelves. Libraries are limited in selection and require membership. There's no lightweight, community-driven way to share physical books freely while maintaining accountability for book condition.

## Solution

A web platform that connects book sharers, readers, and partner venues (primarily coffee shops) in a trust-based sharing network. Books travel through the community, each copy accumulating its own journey history. The platform handles all accountability — condition tracking, reputation scoring, and abuse prevention — so no individual sharer needs to police their books.

## Core Concepts

### Book vs Copy

- **Book**: Title-level metadata (title, author, ISBN, cover, categories, description). One record per unique title.
- **Copy**: A specific physical instance of a Book. Each copy has its own status, condition, location, QR code, and journey history. Multiple copies of the same Book can exist in the system.

### Ownership Model (Hybrid)

The sharer chooses per book at registration time:
- **Donated**: Book belongs to the community permanently. The platform governs all lending rules.
- **Lent**: Sharer remains the owner and can recall the book. Sharer sets the maximum lending period at registration.

Once a book enters the system, the platform (not the sharer) controls lending rules, deadlines, and accountability.

### Partner Locations

Physical venues (primarily coffee shops) that host book shelves/boxes. Partners provide:
- A reliable pickup/drop-off point
- Staff who scan books in/out and flag damage
- Foot traffic and community visibility

Business value for partners: foot traffic from readers, longer customer stays, unique "Walking Books cafe" branding.

**Partner Onboarding Kit (provided free to early partners):**
- Thermal label printer (Dymo/Brother QL, ~$30-50) for printing QR stickers
- Walking Books branded shelf or cardboard display
- Quick start guide for staff

## User Roles

### Reader
- Browses, searches, reserves, picks up, reads, and returns books
- Leaves reviews and reader notes on copies
- Builds a public profile with reading history and reputation

### Partner
- Manages a venue's book shelf via the partner dashboard
- Scans books in/out using QR codes
- Flags condition issues
- Views shelf inventory and basic analytics

### Admin
- Platform oversight: user management, partner approvals
- Abuse review, dispute resolution
- Platform-wide analytics

## Trust & Accountability System

### Reputation Score (0-100)

All users start at 50. The platform controls all scoring. Score is clamped to [0, 100] after each update.

**Earning points:**
| Action | Points |
|--------|--------|
| Return on time | +3 |
| Good condition return | +2 |
| Share a book | +5 |
| Leave a reader note | +1 |

**Losing points:**
| Action | Points |
|--------|--------|
| Late return | -5 |
| Damage reported | -10 |
| No-show on reservation | -3 |
| Overdue daily penalty | -1/day |

**Thresholds:** See Auto-Escalation section for the full enforcement rules and score boundaries.

### Photo Verification (Dual)

1. **Reader photos**: Condition photo required at both pickup and return (mandatory — camera access is required to complete the flow. Desktop users without cameras cannot pick up books; they must use a mobile browser.)
2. **Partner verification**: Staff can confirm condition or flag discrepancy at check-in/check-out
3. **Next reader catch**: If the next reader notices unreported damage at pickup, they flag it — system compares with last return photos and penalizes the previous holder

### Auto-Escalation

All enforcement is score-driven. There is no separate offense ladder — the reputation score IS the enforcement mechanism:

- **Score 50-100**: Full access, no restrictions
- **Score 30-49**: Warning zone — user receives a notification explaining their declining score and how to improve it. Lending period capped at 14 days regardless of book length.
- **Score 15-29**: Restricted — can only hold 1 book at a time. Must return current book before reserving another.
- **Below 15**: Suspended — cannot reserve or pick up books. Must appeal to admin to regain access.

Additional automatic adjustments:
- Repeat late returners (3+ late returns): lending period automatically halved
- High-demand copies (3+ active waiters): only available to users with score > 40

Deposit requirements are deferred to Phase 2+ when payment infrastructure exists (see Non-Goals).

### Lending Periods (System-Decided)

| Book Length | Default Period |
|-------------|---------------|
| Short (< 200 pages) | 14 days |
| Standard (200-500 pages) | 21 days |
| Long (> 500 pages) | 30 days |

- One free extension: 50% of original period (only if no one is waiting)
- 3 days before deadline: reminder notification
- Overdue: daily reminders + reputation drain

## QR Code System

Each physical copy gets a unique QR code — the bridge between physical and digital.

**Generation:** Automatic on book registration. Encodes `walkingbooks.com/copy/[copyId]`.

**Printing:** QR code is generated at registration time and stored as a Convex file. When the sharer drops the book at the partner location, partner staff prints the QR sticker via their thermal label printer from the partner dashboard ("Print label" button on the received book). Sticker placed inside front cover (~3x3 cm) with Walking Books branding and human-readable copy ID. The sharer does NOT need to print anything themselves.

**Scanning contexts:**
- Partner scan at handoff → contextual action (hand off to reader / check in return / add to shelf)
- Reader scan at pickup → confirms pickup, prompts condition photo
- Reader scan at return → confirms return, prompts condition photo + optional note
- Casual scan by anyone → opens copy's public journey page

**Fallback:** Manual copy ID search in partner dashboard if QR is damaged.

## User Flows

### 1. Share a Book
1. Tap "Share a Book" → camera opens for ISBN barcode scan
2. Auto-fill from Open Library API — or manual entry if no barcode
3. Choose: Donate (permanent) or Lend (set return period)
4. Take photo of current condition
5. Select drop-off partner location from map
6. Drop at location → partner scans QR to confirm receipt

### 2. Find & Reserve a Book
1. Search by title/author OR browse by category OR filter by nearby locations
2. View book page — all available copies, their locations and condition
3. Pick a copy → view journey history, reader notes, condition photos
4. Reserve → 1-hour countdown starts, copy locked
5. Go to partner location → scan QR to confirm pickup
6. Take condition photo → book is checked out

### 3. Return a Book
1. Tap "Return Book" → choose ANY partner location
2. Take condition photo + optional reader note
3. Go to location → scan QR to confirm drop-off
4. Partner staff confirms receipt (optional condition flag)
5. Reputation updated, journey entry added to copy's history

### 4. Partner Daily Operations
- Check dashboard: shelf inventory, incoming reservations
- Reader arrives for pickup → scan QR to hand off
- Reader returns a book → scan QR to check in, flag damage if needed
- New book from sharer → scan to register into inventory
- End of day: quick stats

### 5. Recall a Lent Book (Sharer Only)
1. From `/dashboard`, sharer sees their lent books and taps "Recall"
2. If copy is available at a location: status changes to `recalled`, copy is held for sharer pickup
3. If copy is currently checked out: current reader is notified with a 7-day grace period to return
4. After grace period: overdue penalties apply as normal (-1/day reputation drain)
5. When the reader returns the copy, system notifies the sharer with the exact return location name and address. Copy status shown as `recalled` in sharer's dashboard.
6. Sharer picks up the recalled copy from the notified partner location

## Page Structure

### Public (No Auth)
- `/` — Landing page (hero, how it works, stats, CTA)
- `/browse` — Browse books by category
- `/search` — Search by title/author/ISBN
- `/book/[id]` — Book detail (all copies, reviews, categories)
- `/copy/[id]` — Copy detail (journey history, reader notes, condition timeline)
- `/locations` — Map of all partner locations
- `/location/[id]` — Location detail (shelf contents, hours, photos)

### Reader (Authenticated)
- `/dashboard` — My books (reading, reserved, shared), stats
- `/share` — Share a book flow
- `/profile/[id]` — Public reader profile
- `/settings` — Account settings, notifications

### Partner (`/partner/*`)
- `/partner` — Dashboard (inventory, today's reservations, activity)
- `/partner/scan` — QR scanner for check-in/check-out
- `/partner/inventory` — Full shelf management
- `/partner/reports` — Condition reports, damage flags
- `/partner/settings` — Location details, hours, capacity

### Admin (`/admin/*`)
- `/admin` — Platform overview
- `/admin/users` — User management, abuse review
- `/admin/locations` — Partner applications, approvals
- `/admin/reports` — Condition disputes, escalations
- `/admin/analytics` — Platform-wide stats (books, users, locations, activity trends)

## Social Features

- **Public reader profiles**: reading history, books shared, favorite genres, reputation score
- **Follow readers**: see what people you follow are reading
- **Reader notes on copies**: short notes that travel with the physical copy (visible on the copy's journey page)
- **Book reviews**: rating + text review on the Book level (not per copy)

## Data Model

### books
| Field | Type | Description |
|-------|------|-------------|
| title | string | Book title |
| author | string | Author name |
| isbn | string? | ISBN (optional for local/old books) |
| coverImage | string | Cover image URL or Convex file ID |
| description | string | Book description |
| categories | string[] | Genre/category tags |
| pageCount | number | Number of pages |
| language | string | Language code |
| publisher | string? | Publisher name |
| avgRating | number | Average review rating |
| reviewCount | number | Total review count |

### copies
| Field | Type | Description |
|-------|------|-------------|
| bookId | Id<"books"> | Reference to book |
| status | "available" \| "reserved" \| "checked_out" \| "lost" \| "damaged" \| "recalled" | Current status |
| condition | "like_new" \| "good" \| "fair" \| "worn" | Physical condition |
| ownershipType | "donated" \| "lent" | Donation or loan |
| originalSharerId | Id<"users"> | Who shared this copy |
| currentLocationId | Id<"partnerLocations">? | Current location (null if checked out) |
| currentHolderId | Id<"users">? | Who has it (null if at a location) |
| qrCodeUrl | string | QR code image URL |
| returnDeadline | number? | Timestamp for return deadline |
| lendingPeriodDays | number? | Effective lending period (min of sharer max and system default) |
| sharerMaxLendingDays | number? | For lent books, sharer-set maximum lending period |

### journeyEntries
| Field | Type | Description |
|-------|------|-------------|
| copyId | Id<"copies"> | Reference to copy |
| readerId | Id<"users"> | The reader |
| pickupLocationId | Id<"partnerLocations"> | Where picked up |
| dropoffLocationId | Id<"partnerLocations">? | Where returned (null if still reading) |
| pickedUpAt | number | Pickup timestamp |
| returnedAt | number? | Return timestamp |
| conditionAtPickup | string | Condition rating at pickup |
| conditionAtReturn | string? | Condition rating at return |
| pickupPhotos | string[] | Condition photos at pickup |
| returnPhotos | string[] | Condition photos at return |
| readerNote | string? | Note from the reader |
| reservationId | Id<"reservations">? | Reservation that triggered this journey (null for walk-in pickups) |

### users
| Field | Type | Description |
|-------|------|-------------|
| clerkId | string | Clerk user ID |
| phone | string | Verified phone number |
| name | string | Display name |
| avatarUrl | string? | Profile photo |
| bio | string? | Short bio |
| roles | string[] | User roles (e.g., ["reader"], ["reader", "partner"]) |
| status | "active" \| "restricted" \| "banned" | Account status |
| reputationScore | number | Trust score (0-100) |
| booksShared | number | Total books shared |
| booksRead | number | Total books read |
| favoriteGenres | string[] | Preferred categories |

### partnerLocations
| Field | Type | Description |
|-------|------|-------------|
| name | string | Venue name |
| address | string | Street address |
| lat | number | Latitude |
| lng | number | Longitude |
| contactPhone | string | Contact phone |
| contactEmail | string? | Contact email |
| operatingHours | object | Hours by day of week |
| photos | string[] | Venue photos |
| shelfCapacity | number | Max books on shelf |
| currentBookCount | number | Books currently on shelf |
| managedByUserId | Id<"users"> | Primary partner manager |
| staffUserIds | Id<"users">[] | Additional staff with scan/check-in access |

### reservations
| Field | Type | Description |
|-------|------|-------------|
| copyId | Id<"copies"> | Reserved copy |
| userId | Id<"users"> | Reserving user |
| locationId | Id<"partnerLocations"> | Pickup location |
| reservedAt | number | Reservation timestamp |
| expiresAt | number | Expiry (1 hour after reservation) |
| status | "active" \| "fulfilled" \| "expired" \| "cancelled" | Reservation status |

### conditionReports
| Field | Type | Description |
|-------|------|-------------|
| copyId | Id<"copies"> | Reported copy |
| reportedByUserId | Id<"users">? | Reporting reader |
| reportedByPartnerId | Id<"partnerLocations">? | Reporting partner |
| type | "pickup_check" \| "return_check" \| "damage_report" | Report type |
| photos | string[] | Evidence photos |
| description | string | Description of condition/damage |
| previousCondition | string | Condition before |
| newCondition | string | Condition after |
| createdAt | number | Report timestamp (used for chronological ordering in disputes) |

### reviews
| Field | Type | Description |
|-------|------|-------------|
| bookId | Id<"books"> | Reviewed book |
| userId | Id<"users"> | Reviewer |
| rating | number | 1-5 star rating |
| text | string | Review text |

Constraint: One review per user per book (unique on `bookId` + `userId`). Submitting again updates the existing review.

### follows
| Field | Type | Description |
|-------|------|-------------|
| followerId | Id<"users"> | Who is following |
| followingId | Id<"users"> | Who is being followed |

## Technical Architecture

### Stack
- **Runtime:** Bun
- **Framework:** Next.js 15 (App Router)
- **Backend:** Convex (database, server functions, file storage, scheduled jobs)
- **Auth:** Clerk (phone OTP, role management)
- **UI:** Tailwind CSS + shadcn/ui
- **QR Scanning:** html5-qrcode (browser-based)
- **Maps:** Leaflet (free) or Mapbox
- **Email:** Resend (transactional notifications)
- **Book Data:** Open Library API (ISBN lookup)
- **Monorepo:** Turborepo

### Architecture Pattern

Single Next.js app with role-based routing:
- `/` routes — reader-facing, SSR for public pages
- `/partner/*` routes — partner dashboard, CSR, protected by Clerk middleware
- `/admin/*` routes — admin panel, CSR, protected by Clerk middleware

Clerk middleware checks user role metadata (array-based, supports multi-role users e.g. reader+partner) and redirects unauthorized access.

### Convex Functions

**Queries (real-time reads):**
- `books.search` — full-text search by title/author
- `books.byCategory` — browse by category
- `copies.byBook` — all copies of a book with availability
- `copies.nearLocation` — copies available near a lat/lng (bounding box filter)
- `copies.journey` — full journey history for a copy
- `reservations.active` — user's active reservations
- `partnerLocations.nearby` — locations near coordinates
- `users.profile` — public profile data

**Mutations (writes):**
- `books.register` — create book + first copy
- `copies.reserve` — create reservation (1-hour hold)
- `copies.pickup` — confirm pickup, start journey entry
- `copies.return` — confirm return, close journey entry, update location
- `copies.reportCondition` — file condition report
- `reviews.create` — add book review
- `copies.recall` — sharer recalls a lent book (notifies current holder if checked out, 7-day grace)
- `copies.extend` — reader requests extension (50% of original period, only if no active reservation waiting)
- `users.follow` / `users.unfollow` — social follows

**Actions (external API calls):**
- `books.lookupISBN` — fetch metadata from Open Library API
- `notifications.sendReminder` — send email via Resend
- `qr.generate` — generate QR code image

**Scheduled Jobs (crons):**
- `expireReservations` — every 5 min, cancel expired holds and apply -3 no-show penalty (a no-show = reservation expires without `copies.pickup` being called)
- `sendReturnReminders` — daily, notify 3 days before deadline
- `processOverdue` — daily, apply reputation penalties
- `recalculateReputation` — weekly, audit/correction pass that detects drift between incremental score changes and the full history (corrects inconsistencies only, does not replace real-time scoring)

### Geo Queries

Convex doesn't have PostGIS. Location-based queries use bounding box filtering:
1. Calculate lat/lng bounds for the search radius
2. Filter `partnerLocations` where `lat` and `lng` fall within bounds
3. Sort by distance client-side (Haversine formula)

Sufficient for MVP. If query performance becomes an issue at scale, consider adding a geo index service.

## Monetization (Phased)

### Phase 1: Free (Network Building)
- All features free for readers and partners
- Focus on growing the book inventory and partner network
- No payment integration needed

### Phase 2: Sponsorships
- Publishers or brands sponsor shelves at partner locations
- "The Penguin Classics Shelf at X Cafe" — visibility for sponsor, revenue for platform

### Phase 3: Partner Subscriptions
- Free tier: basic listing, inventory management
- Paid tiers: advanced analytics, promotions engine, featured placement, branded materials

### Phase 4: Reader Supporter Tier (Optional)
- $3-5/month for badges, early reservations, reading stats
- Community-funded model (like Wikipedia)

## Design Direction

Warm & community aesthetic — earthy tones, book covers prominent, inviting feel. Inspired by Goodreads meets Airbnb. Typography-forward with generous whitespace. Focus on book imagery and the journey narrative.

## Non-Goals (MVP)

- Mobile native app (web app is mobile-responsive)
- Payment processing / deposits (Phase 2+)
- AI-powered book recommendations
- Book clubs / discussion forums
- Multi-language support (English first)
- Push notifications (email only for MVP)
