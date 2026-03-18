# The Walking Books — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a community book-sharing web platform where readers discover, reserve, and pick up physical books from partner locations (cafes), with full journey tracking, reputation system, and QR-based handoffs.

**Architecture:** Single Next.js 15 app (App Router) with Convex backend, Clerk phone OTP auth, and role-based routing for readers, partners, and admins. Turborepo monorepo for future expansion.

**Tech Stack:** Bun, Next.js 15, Convex, Clerk, Tailwind CSS, shadcn/ui, html5-qrcode, Leaflet + OpenStreetMap, Resend, Open Library API

**Spec:** `docs/superpowers/specs/2026-03-14-walking-books-design.md`

---

## File Structure

```
walking-books/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── layout.tsx                    # Root layout (Clerk + Convex providers)
│       │   ├── page.tsx                      # Landing page
│       │   ├── browse/
│       │   │   └── page.tsx                  # Browse by category
│       │   ├── search/
│       │   │   └── page.tsx                  # Search by title/author/ISBN
│       │   ├── book/
│       │   │   └── [id]/
│       │   │       └── page.tsx              # Book detail (copies, reviews)
│       │   ├── copy/
│       │   │   └── [id]/
│       │   │       └── page.tsx              # Copy detail (journey, notes)
│       │   ├── locations/
│       │   │   ├── page.tsx                  # Map of all partner locations
│       │   │   └── [id]/
│       │   │       └── page.tsx              # Location detail
│       │   ├── (reader)/
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx              # Reader dashboard
│       │   │   ├── share/
│       │   │   │   └── page.tsx              # Share a book flow
│       │   │   └── settings/
│       │   │       └── page.tsx              # Account settings
│       │   ├── profile/
│       │   │   └── [id]/
│       │   │       └── page.tsx              # Public reader profile
│       │   ├── partner/
│       │   │   ├── layout.tsx                # Partner layout (role guard)
│       │   │   ├── page.tsx                  # Partner dashboard
│       │   │   ├── scan/
│       │   │   │   └── page.tsx              # QR scanner
│       │   │   ├── inventory/
│       │   │   │   └── page.tsx              # Shelf management
│       │   │   ├── reports/
│       │   │   │   └── page.tsx              # Condition reports
│       │   │   └── settings/
│       │   │       └── page.tsx              # Location settings
│       │   ├── admin/
│       │   │   ├── layout.tsx                # Admin layout (role guard)
│       │   │   ├── page.tsx                  # Admin overview
│       │   │   ├── users/
│       │   │   │   └── page.tsx              # User management
│       │   │   ├── locations/
│       │   │   │   └── page.tsx              # Partner approvals
│       │   │   ├── reports/
│       │   │   │   └── page.tsx              # Disputes
│       │   │   └── analytics/
│       │   │       └── page.tsx              # Platform analytics
│       │   └── sign-in/
│       │       └── [[...sign-in]]/
│       │           └── page.tsx              # Clerk sign-in page
│       ├── components/
│       │   ├── ui/                           # shadcn/ui components (auto-generated)
│       │   ├── book-card.tsx                 # Book card (browse/search results)
│       │   ├── copy-card.tsx                 # Copy card with status/condition
│       │   ├── copy-journey.tsx              # Journey timeline visualization
│       │   ├── condition-photo-capture.tsx   # Camera capture for condition photos
│       │   ├── isbn-scanner.tsx              # ISBN barcode scanner
│       │   ├── qr-scanner.tsx                # QR code scanner (pickup/return)
│       │   ├── location-map.tsx              # Leaflet map component
│       │   ├── location-picker.tsx           # Map-based location selector
│       │   ├── reputation-badge.tsx          # User reputation score display
│       │   ├── reservation-timer.tsx         # 1-hour countdown timer
│       │   ├── star-rating.tsx               # 1-5 star rating input/display
│       │   └── category-grid.tsx             # Category browsing grid
│       ├── lib/
│       │   ├── geo.ts                        # Haversine distance, bounding box calc
│       │   ├── reputation.ts                 # Reputation score constants & helpers
│       │   └── lending.ts                    # Lending period calculation helpers
│       ├── middleware.ts                      # Clerk auth + role-based routing
│       ├── convex/
│       │   ├── _generated/                   # Convex auto-generated
│       │   ├── schema.ts                     # Full database schema
│       │   ├── books.ts                      # Book queries + mutations
│       │   ├── copies.ts                     # Copy queries + mutations
│       │   ├── users.ts                      # User queries + mutations
│       │   ├── reservations.ts               # Reservation queries + mutations
│       │   ├── partnerLocations.ts           # Partner location queries + mutations
│       │   ├── conditionReports.ts           # Condition report mutations
│       │   ├── reviews.ts                    # Review queries + mutations
│       │   ├── follows.ts                    # Follow queries + mutations
│       │   ├── notifications.ts              # Email notification actions
│       │   ├── qr.ts                         # QR code generation action
│       │   ├── crons.ts                      # Scheduled job definitions
│       │   ├── http.ts                       # HTTP routes (Clerk webhook)
│       │   └── lib/
│       │       ├── reputation.ts             # Reputation score logic (server-side)
│       │       ├── lending.ts                # Lending period logic (server-side)
│       │       └── validators.ts             # Shared input validators
│       ├── tailwind.config.ts
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── config/
│       ├── tailwind/                         # Shared Tailwind preset (warm theme)
│       │   └── index.ts
│       └── typescript/
│           └── base.json                     # Shared tsconfig
├── turbo.json
├── package.json
└── bun.lockb
```

---

## Chunk 1: Project Scaffolding & Convex Schema

### Task 1: Initialize Turborepo + Next.js + Bun

**Files:**
- Create: `walking-books/package.json`
- Create: `walking-books/turbo.json`
- Create: `walking-books/apps/web/package.json`
- Create: `walking-books/apps/web/next.config.ts`
- Create: `walking-books/apps/web/tsconfig.json`
- Create: `walking-books/.gitignore`

- [ ] **Step 1: Create the monorepo root**

```bash
cd /Users/orkhanrzazade/Projects/scifi
mkdir walking-books && cd walking-books
bun init -y
```

- [ ] **Step 2: Set up Turborepo**

```bash
bun add -d turbo
```

Create `turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] }
  }
}
```

Update root `package.json` with workspaces:
```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint"
  }
}
```

- [ ] **Step 3: Create Next.js 15 app**

```bash
mkdir -p apps/web
cd apps/web
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-bun
```

- [ ] **Step 4: Add .gitignore**

Ensure `.gitignore` includes:
```
node_modules/
.next/
.env.local
.env
.planning/
.superpowers/
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd /Users/orkhanrzazade/Projects/scifi/walking-books
bun run dev
```

Expected: Next.js dev server runs on localhost:3000.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Turborepo + Next.js 15 with Bun"
```

---

### Task 2: Set up Convex

**Files:**
- Create: `apps/web/convex/schema.ts`
- Create: `apps/web/convex/_generated/` (auto)
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install Convex**

```bash
cd apps/web
bun add convex
```

- [ ] **Step 2: Initialize Convex project**

```bash
bunx convex init
```

Follow prompts to create a new Convex project named "walking-books".

- [ ] **Step 3: Write the full database schema**

Create `apps/web/convex/schema.ts`:
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  books: defineTable({
    title: v.string(),
    author: v.string(),
    isbn: v.optional(v.string()),
    coverImage: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    pageCount: v.number(),
    language: v.string(),
    publisher: v.optional(v.string()),
    avgRating: v.number(),
    reviewCount: v.number(),
  })
    .index("by_isbn", ["isbn"])
    .searchIndex("search_title_author", {
      searchField: "title",
      filterFields: ["categories", "language"],
    }),

  copies: defineTable({
    bookId: v.id("books"),
    status: v.union(
      v.literal("available"),
      v.literal("reserved"),
      v.literal("checked_out"),
      v.literal("lost"),
      v.literal("damaged"),
      v.literal("recalled"),
    ),
    condition: v.union(
      v.literal("like_new"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("worn"),
    ),
    ownershipType: v.union(v.literal("donated"), v.literal("lent")),
    originalSharerId: v.id("users"),
    currentLocationId: v.optional(v.id("partnerLocations")),
    currentHolderId: v.optional(v.id("users")),
    qrCodeUrl: v.string(),
    returnDeadline: v.optional(v.number()),
    lendingPeriodDays: v.optional(v.number()),
    sharerMaxLendingDays: v.optional(v.number()),
  })
    .index("by_book", ["bookId"])
    .index("by_location", ["currentLocationId", "status"])
    .index("by_holder", ["currentHolderId"])
    .index("by_sharer", ["originalSharerId"]),

  journeyEntries: defineTable({
    copyId: v.id("copies"),
    readerId: v.id("users"),
    pickupLocationId: v.id("partnerLocations"),
    dropoffLocationId: v.optional(v.id("partnerLocations")),
    pickedUpAt: v.number(),
    returnedAt: v.optional(v.number()),
    conditionAtPickup: v.string(),
    conditionAtReturn: v.optional(v.string()),
    pickupPhotos: v.array(v.string()),
    returnPhotos: v.array(v.string()),
    readerNote: v.optional(v.string()),
    reservationId: v.optional(v.id("reservations")),
  })
    .index("by_copy", ["copyId"])
    .index("by_reader", ["readerId"]),

  users: defineTable({
    clerkId: v.string(),
    phone: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    roles: v.array(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("restricted"),
      v.literal("banned"),
    ),
    reputationScore: v.number(),
    booksShared: v.number(),
    booksRead: v.number(),
    favoriteGenres: v.array(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_phone", ["phone"]),

  partnerLocations: defineTable({
    name: v.string(),
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    contactPhone: v.string(),
    contactEmail: v.optional(v.string()),
    operatingHours: v.any(),
    photos: v.array(v.string()),
    shelfCapacity: v.number(),
    currentBookCount: v.number(),
    managedByUserId: v.id("users"),
    staffUserIds: v.array(v.id("users")),
  })
    .index("by_manager", ["managedByUserId"]),

  reservations: defineTable({
    copyId: v.id("copies"),
    userId: v.id("users"),
    locationId: v.id("partnerLocations"),
    reservedAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("fulfilled"),
      v.literal("expired"),
      v.literal("cancelled"),
    ),
  })
    .index("by_copy", ["copyId", "status"])
    .index("by_user", ["userId", "status"])
    .index("by_expiry", ["status", "expiresAt"]),

  conditionReports: defineTable({
    copyId: v.id("copies"),
    reportedByUserId: v.optional(v.id("users")),
    reportedByPartnerId: v.optional(v.id("partnerLocations")),
    type: v.union(
      v.literal("pickup_check"),
      v.literal("return_check"),
      v.literal("damage_report"),
    ),
    photos: v.array(v.string()),
    description: v.string(),
    previousCondition: v.string(),
    newCondition: v.string(),
    createdAt: v.number(),
  })
    .index("by_copy", ["copyId"]),

  reviews: defineTable({
    bookId: v.id("books"),
    userId: v.id("users"),
    rating: v.number(),
    text: v.string(),
  })
    .index("by_book", ["bookId"])
    .index("by_user_book", ["userId", "bookId"]),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_pair", ["followerId", "followingId"]),
});
```

- [ ] **Step 4: Push schema to Convex**

```bash
bunx convex dev
```

Expected: Schema deploys successfully, `_generated/` directory is populated.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Convex backend with full database schema"
```

---

### Task 3: Set up Clerk Auth + Convex Integration

**Files:**
- Create: `apps/web/app/layout.tsx` (modify)
- Create: `apps/web/middleware.ts`
- Create: `apps/web/convex/http.ts`
- Create: `apps/web/convex/users.ts`
- Create: `apps/web/app/sign-in/[[...sign-in]]/page.tsx`

- [ ] **Step 1: Install Clerk**

```bash
cd apps/web
bun add @clerk/nextjs
```

- [ ] **Step 2: Configure environment variables**

Create `apps/web/.env.local`:
```
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-pk>
CLERK_SECRET_KEY=<your-clerk-sk>
CLERK_WEBHOOK_SECRET=<your-webhook-secret>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

Set up Clerk project:
- Go to clerk.com → Create application
- Enable Phone number as primary auth method
- Enable OTP verification
- Set up webhook endpoint for user sync

- [ ] **Step 3: Create root layout with Clerk + Convex providers**

Modify `apps/web/app/layout.tsx`:
```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

Create `apps/web/components/convex-client-provider.tsx`:
```tsx
"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string,
);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

- [ ] **Step 4: Create Clerk middleware with role-based routing**

Create `apps/web/middleware.ts`:
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/browse(.*)",
  "/search(.*)",
  "/book/(.*)",
  "/copy/(.*)",
  "/locations(.*)",
  "/location/(.*)",
  "/profile/(.*)",
  "/sign-in(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

Note: Partner (`/partner/*`) and admin (`/admin/*`) role checks are done at the layout level using Clerk's `auth()` helper since Convex stores the roles, not Clerk's JWT directly.

- [ ] **Step 5: Create Clerk webhook handler for user sync**

Create `apps/web/convex/http.ts`:
```typescript
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify webhook signature using Svix
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    const bodyText = await request.text();

    // Verify using Svix (import { Webhook } from "svix")
    // const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    // wh.verify(bodyText, { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": svixSignature });
    // For full implementation, add `svix` package and uncomment above

    const body = JSON.parse(bodyText);
    const eventType = body.type;

    if (eventType === "user.created") {
      const { id, phone_numbers, first_name, last_name, image_url } = body.data;
      const phone = phone_numbers?.[0]?.phone_number ?? "";
      const name = [first_name, last_name].filter(Boolean).join(" ") || "Reader";

      await ctx.runMutation(internal.users.createFromClerk, {
        clerkId: id,
        phone,
        name,
        avatarUrl: image_url ?? undefined,
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

- [ ] **Step 6: Create users module**

Create `apps/web/convex/users.ts`:
```typescript
import { v } from "convex/values";
import { query, internalMutation, mutation } from "./_generated/server";

export const createFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    phone: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      phone: args.phone,
      name: args.name,
      avatarUrl: args.avatarUrl,
      bio: undefined,
      roles: ["reader"],
      status: "active",
      reputationScore: 50,
      booksShared: 0,
      booksRead: 0,
      favoriteGenres: [],
    });
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) =>
        q.eq("clerkId", identity.subject),
      )
      .unique();
  },
});

export const profile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
```

- [ ] **Step 7: Create sign-in page**

Create `apps/web/app/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

- [ ] **Step 8: Verify auth flow works**

```bash
cd apps/web
bunx convex dev  # in one terminal
bun run dev      # in another terminal
```

Expected: Can visit localhost:3000, sign in with phone OTP, user record created in Convex.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: integrate Clerk phone OTP auth with Convex user sync"
```

---

### Task 4: Set up Tailwind Theme + shadcn/ui

**Files:**
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/components/ui/` (via shadcn init)

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd apps/web
bunx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables.

- [ ] **Step 2: Configure warm community theme**

Update `apps/web/app/globals.css` with warm earthy palette:
```css
@layer base {
  :root {
    --background: 30 20% 98%;
    --foreground: 20 20% 15%;
    --card: 30 15% 96%;
    --card-foreground: 20 20% 15%;
    --popover: 30 15% 96%;
    --popover-foreground: 20 20% 15%;
    --primary: 24 70% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 30 15% 90%;
    --secondary-foreground: 20 20% 25%;
    --muted: 30 10% 93%;
    --muted-foreground: 20 10% 45%;
    --accent: 160 40% 45%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 30 15% 88%;
    --input: 30 15% 88%;
    --ring: 24 70% 50%;
    --radius: 0.75rem;
  }
}
```

- [ ] **Step 3: Install core shadcn components**

```bash
bunx shadcn@latest add button card input badge dialog sheet tabs separator avatar dropdown-menu toast
```

- [ ] **Step 4: Verify components render**

Create a temporary test in `apps/web/app/page.tsx`:
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>The Walking Books</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Community book sharing platform</p>
          <Button className="mt-4 w-full">Get Started</Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

Run: `bun run dev`
Expected: Card renders with warm earthy tones.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: configure shadcn/ui with warm community theme"
```

---

## Chunk 2: Core Backend — Books, Copies, QR

### Task 5: ISBN Lookup Action (Open Library API)

**Files:**
- Create: `apps/web/convex/books.ts`

- [ ] **Step 1: Write the books.lookupISBN action**

Create `apps/web/convex/books.ts`:
```typescript
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

export const lookupISBN = action({
  args: { isbn: v.string() },
  handler: async (_ctx, args) => {
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${args.isbn}&format=json&jscmd=data`,
    );
    const data = await response.json();
    const book = data[`ISBN:${args.isbn}`];

    if (!book) return null;

    return {
      title: book.title ?? "",
      author: book.authors?.[0]?.name ?? "Unknown",
      coverImage: book.cover?.large ?? book.cover?.medium ?? "",
      description: book.notes ?? book.subtitle ?? "",
      pageCount: book.number_of_pages ?? 0,
      publisher: book.publishers?.[0]?.name ?? undefined,
      language: "en",
    };
  },
});
```

- [ ] **Step 2: Test the action**

```bash
bunx convex run books:lookupISBN '{"isbn": "9780451524935"}'
```

Expected: Returns metadata for "1984" by George Orwell.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add ISBN lookup via Open Library API"
```

---

### Task 6: Book Registration + Copy Creation

**Files:**
- Modify: `apps/web/convex/books.ts`
- Create: `apps/web/convex/copies.ts`
- Create: `apps/web/convex/qr.ts`
- Create: `apps/web/convex/lib/lending.ts`

- [ ] **Step 1: Create lending period helper**

Create `apps/web/convex/lib/lending.ts`:
```typescript
export function getDefaultLendingDays(pageCount: number): number {
  if (pageCount < 200) return 14;
  if (pageCount > 500) return 30;
  return 21;
}

export function getEffectiveLendingDays(
  pageCount: number,
  sharerMaxDays: number | undefined,
): number {
  const systemDefault = getDefaultLendingDays(pageCount);
  if (sharerMaxDays === undefined) return systemDefault;
  return Math.min(systemDefault, sharerMaxDays);
}
```

- [ ] **Step 2: Create QR code generation action**

Create `apps/web/convex/qr.ts`:
```typescript
import { v } from "convex/values";
import { action } from "./_generated/server";

export const generate = action({
  args: { copyId: v.string(), baseUrl: v.string() },
  handler: async (ctx, args) => {
    const url = `${args.baseUrl}/copy/${args.copyId}`;
    // Use QR code API to generate image
    const qrResponse = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
    );
    const blob = await qrResponse.blob();
    const storageId = await ctx.storage.store(blob);
    return storageId;
  },
});
```

- [ ] **Step 3: Add books.register mutation**

Add to `apps/web/convex/books.ts`:
```typescript
export const register = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    isbn: v.optional(v.string()),
    coverImage: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    pageCount: v.number(),
    language: v.string(),
    publisher: v.optional(v.string()),
    condition: v.union(
      v.literal("like_new"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("worn"),
    ),
    ownershipType: v.union(v.literal("donated"), v.literal("lent")),
    sharerMaxLendingDays: v.optional(v.number()),
    dropoffLocationId: v.id("partnerLocations"),
    conditionPhotos: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Check if book already exists by ISBN
    let bookId;
    if (args.isbn) {
      const existing = await ctx.db
        .query("books")
        .withIndex("by_isbn", (q) => q.eq("isbn", args.isbn))
        .unique();
      if (existing) {
        bookId = existing._id;
      }
    }

    // Create book if it doesn't exist
    if (!bookId) {
      bookId = await ctx.db.insert("books", {
        title: args.title,
        author: args.author,
        isbn: args.isbn,
        coverImage: args.coverImage,
        description: args.description,
        categories: args.categories,
        pageCount: args.pageCount,
        language: args.language,
        publisher: args.publisher,
        avgRating: 0,
        reviewCount: 0,
      });
    }

    // Create copy
    // Note: import at top of file: import { getEffectiveLendingDays } from "./lib/lending";
    const lendingPeriodDays = getEffectiveLendingDays(
      args.pageCount,
      args.sharerMaxLendingDays,
    );

    const copyId = await ctx.db.insert("copies", {
      bookId,
      status: "available",
      condition: args.condition,
      ownershipType: args.ownershipType,
      originalSharerId: user._id,
      currentLocationId: args.dropoffLocationId,
      currentHolderId: undefined,
      qrCodeUrl: "", // Populated after QR generation action
      returnDeadline: undefined,
      lendingPeriodDays,
      sharerMaxLendingDays: args.sharerMaxLendingDays,
    });

    // Update user stats
    await ctx.db.patch(user._id, {
      booksShared: user.booksShared + 1,
      reputationScore: Math.min(100, user.reputationScore + 5),
    });

    // Update partner location book count
    const location = await ctx.db.get(args.dropoffLocationId);
    if (location) {
      await ctx.db.patch(args.dropoffLocationId, {
        currentBookCount: location.currentBookCount + 1,
      });
    }

    // Create initial condition report
    await ctx.db.insert("conditionReports", {
      copyId,
      reportedByUserId: user._id,
      reportedByPartnerId: undefined,
      type: "pickup_check",
      photos: args.conditionPhotos,
      description: "Initial condition at registration",
      previousCondition: args.condition,
      newCondition: args.condition,
      createdAt: Date.now(),
    });

    return { bookId, copyId };
  },
});
```

- [ ] **Step 4: Add book queries**

Add to `apps/web/convex/books.ts`:
```typescript
export const search = query({
  args: { searchText: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchText.trim()) return [];
    return await ctx.db
      .query("books")
      .withSearchIndex("search_title_author", (q) =>
        q.search("title", args.searchText),
      )
      .take(20);
  },
});

export const byCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const allBooks = await ctx.db.query("books").collect();
    return allBooks.filter((b) => b.categories.includes(args.category));
  },
});

export const byId = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookId);
  },
});
```

- [ ] **Step 5: Create copies module with queries**

Create `apps/web/convex/copies.ts`:
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const byBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("copies")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
  },
});

export const byId = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.copyId);
  },
});

export const journey = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journeyEntries")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .collect();
  },
});

export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("copies")
      .withIndex("by_location", (q) =>
        q.eq("currentLocationId", args.locationId).eq("status", "available"),
      )
      .collect();
  },
});
```

- [ ] **Step 6: Push and verify**

```bash
bunx convex dev
```

Expected: All functions deploy successfully.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add book registration, copy creation, QR generation, ISBN lookup"
```

---

### Task 7: Reservation, Pickup & Return Mutations

**Files:**
- Create: `apps/web/convex/reservations.ts`
- Modify: `apps/web/convex/copies.ts`
- Create: `apps/web/convex/lib/reputation.ts`

- [ ] **Step 1: Create reputation helpers**

Create `apps/web/convex/lib/reputation.ts`:
```typescript
export const REPUTATION = {
  RETURN_ON_TIME: 3,
  GOOD_CONDITION: 2,
  SHARE_BOOK: 5,
  LEAVE_NOTE: 1,
  LATE_RETURN: -5,
  DAMAGE_REPORTED: -10,
  NO_SHOW: -3,
  OVERDUE_DAILY: -1,
} as const;

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function getUserRestrictions(score: number) {
  if (score < 15) return { canReserve: false, maxBooks: 0, tier: "suspended" as const };
  if (score < 30) return { canReserve: true, maxBooks: 1, tier: "restricted" as const };
  if (score < 50) return { canReserve: true, maxBooks: 3, tier: "warning" as const };
  return { canReserve: true, maxBooks: 10, tier: "full" as const };
}
```

- [ ] **Step 2: Create reservations module**

Create `apps/web/convex/reservations.ts`:
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getUserRestrictions, REPUTATION, clampScore } from "./lib/reputation";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const active = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("reservations")
      .withIndex("by_user", (q) =>
        q.eq("userId", user._id).eq("status", "active"),
      )
      .collect();
  },
});

export const create = mutation({
  args: { copyId: v.id("copies"), locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Check reputation restrictions
    const restrictions = getUserRestrictions(user.reputationScore);
    if (!restrictions.canReserve) {
      throw new Error("Account suspended. Please contact support.");
    }

    // Check max books for restricted users
    const activeReservations = await ctx.db
      .query("reservations")
      .withIndex("by_user", (q) =>
        q.eq("userId", user._id).eq("status", "active"),
      )
      .collect();

    const checkedOutCopies = await ctx.db
      .query("copies")
      .withIndex("by_holder", (q) => q.eq("currentHolderId", user._id))
      .collect();

    const totalHeld = activeReservations.length + checkedOutCopies.length;
    if (totalHeld >= restrictions.maxBooks) {
      throw new Error(
        `You can only hold ${restrictions.maxBooks} book(s) at a time with your current reputation.`,
      );
    }

    // Check copy is available
    const copy = await ctx.db.get(args.copyId);
    if (!copy || copy.status !== "available") {
      throw new Error("This copy is not available for reservation.");
    }

    // Check no active reservation on this copy
    const existingReservation = await ctx.db
      .query("reservations")
      .withIndex("by_copy", (q) =>
        q.eq("copyId", args.copyId).eq("status", "active"),
      )
      .first();
    if (existingReservation) {
      throw new Error("This copy is already reserved.");
    }

    const now = Date.now();

    // Create reservation
    const reservationId = await ctx.db.insert("reservations", {
      copyId: args.copyId,
      userId: user._id,
      locationId: args.locationId,
      reservedAt: now,
      expiresAt: now + ONE_HOUR_MS,
      status: "active",
    });

    // Update copy status
    await ctx.db.patch(args.copyId, { status: "reserved" });

    return reservationId;
  },
});

export const cancel = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "active") {
      throw new Error("Reservation not found or already processed.");
    }

    await ctx.db.patch(args.reservationId, { status: "cancelled" });
    await ctx.db.patch(reservation.copyId, { status: "available" });
  },
});
```

- [ ] **Step 3: Add pickup mutation to copies**

Add to `apps/web/convex/copies.ts`:
```typescript
export const pickup = mutation({
  args: {
    copyId: v.id("copies"),
    conditionAtPickup: v.string(),
    pickupPhotos: v.array(v.string()),
    reservationId: v.optional(v.id("reservations")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.status !== "available" && copy.status !== "reserved") {
      throw new Error("Copy is not available for pickup");
    }

    // If reserved, verify it's this user's reservation
    if (args.reservationId) {
      const reservation = await ctx.db.get(args.reservationId);
      if (!reservation || reservation.userId !== user._id) {
        throw new Error("This reservation doesn't belong to you");
      }
      await ctx.db.patch(args.reservationId, { status: "fulfilled" });
    }

    // Note: import at top of file: import { getEffectiveLendingDays } from "./lib/lending";
    const book = await ctx.db.get(copy.bookId);
    const lendingDays = getEffectiveLendingDays(
      book?.pageCount ?? 300,
      copy.sharerMaxLendingDays,
    );

    // Apply warning zone cap (score 30-49 = max 14 days)
    // Note: import at top of file: import { getUserRestrictions } from "./lib/reputation";
    const restrictions = getUserRestrictions(user.reputationScore);
    const effectiveDays =
      restrictions.tier === "warning"
        ? Math.min(lendingDays, 14)
        : lendingDays;

    const now = Date.now();
    const returnDeadline = now + effectiveDays * 24 * 60 * 60 * 1000;

    // Update copy
    await ctx.db.patch(args.copyId, {
      status: "checked_out",
      currentHolderId: user._id,
      currentLocationId: undefined,
      returnDeadline,
    });

    // Update partner location book count
    if (copy.currentLocationId) {
      const location = await ctx.db.get(copy.currentLocationId);
      if (location) {
        await ctx.db.patch(copy.currentLocationId, {
          currentBookCount: Math.max(0, location.currentBookCount - 1),
        });
      }
    }

    // Create journey entry
    await ctx.db.insert("journeyEntries", {
      copyId: args.copyId,
      readerId: user._id,
      pickupLocationId: copy.currentLocationId!,
      dropoffLocationId: undefined,
      pickedUpAt: now,
      returnedAt: undefined,
      conditionAtPickup: args.conditionAtPickup,
      conditionAtReturn: undefined,
      pickupPhotos: args.pickupPhotos,
      returnPhotos: [],
      readerNote: undefined,
      reservationId: args.reservationId,
    });

    // Create condition report
    await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      reportedByPartnerId: undefined,
      type: "pickup_check",
      photos: args.pickupPhotos,
      description: "Condition at pickup",
      previousCondition: copy.condition,
      newCondition: args.conditionAtPickup,
      createdAt: now,
    });

    return { success: true };
  },
});
```

- [ ] **Step 4: Add return mutation to copies**

Add to `apps/web/convex/copies.ts`:
```typescript
export const returnCopy = mutation({
  args: {
    copyId: v.id("copies"),
    dropoffLocationId: v.id("partnerLocations"),
    conditionAtReturn: v.string(),
    returnPhotos: v.array(v.string()),
    readerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const copy = await ctx.db.get(args.copyId);
    if (!copy || copy.status !== "checked_out") {
      throw new Error("Copy is not checked out");
    }
    if (copy.currentHolderId !== user._id) {
      throw new Error("You don't hold this copy");
    }

    const now = Date.now();
    const isOnTime = !copy.returnDeadline || now <= copy.returnDeadline;

    // Calculate reputation change
    // Note: import at top of file: import { REPUTATION, clampScore } from "./lib/reputation";
    let scoreChange = 0;
    if (isOnTime) scoreChange += REPUTATION.RETURN_ON_TIME;
    if (!isOnTime) scoreChange += REPUTATION.LATE_RETURN;
    if (args.conditionAtReturn === copy.condition) scoreChange += REPUTATION.GOOD_CONDITION;
    if (args.readerNote) scoreChange += REPUTATION.LEAVE_NOTE;

    // If the copy was recalled while checked out, set to "recalled" so sharer can pick up
    // Check if there's a pending recall by looking at the deadline being shortened
    // A more robust approach: add a `recallRequested` boolean to copies schema
    const newStatus = copy.ownershipType === "lent" && copy.returnDeadline
      ? "recalled"  // Lent book with deadline = was recalled, hold for sharer
      : "available";

    // Update copy
    await ctx.db.patch(args.copyId, {
      status: newStatus,
      currentLocationId: args.dropoffLocationId,
      currentHolderId: undefined,
      returnDeadline: undefined,
      condition: args.conditionAtReturn as any,
    });

    // Update location book count
    const location = await ctx.db.get(args.dropoffLocationId);
    if (location) {
      await ctx.db.patch(args.dropoffLocationId, {
        currentBookCount: location.currentBookCount + 1,
      });
    }

    // Close journey entry
    const openJourney = await ctx.db
      .query("journeyEntries")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .order("desc")
      .first();

    if (openJourney && !openJourney.returnedAt) {
      await ctx.db.patch(openJourney._id, {
        dropoffLocationId: args.dropoffLocationId,
        returnedAt: now,
        conditionAtReturn: args.conditionAtReturn,
        returnPhotos: args.returnPhotos,
        readerNote: args.readerNote,
      });
    }

    // Update user reputation and stats
    await ctx.db.patch(user._id, {
      reputationScore: clampScore(user.reputationScore + scoreChange),
      booksRead: user.booksRead + 1,
    });

    // Create condition report
    await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      reportedByPartnerId: undefined,
      type: "return_check",
      photos: args.returnPhotos,
      description: args.readerNote ?? "Condition at return",
      previousCondition: copy.condition,
      newCondition: args.conditionAtReturn,
      createdAt: now,
    });

    return { success: true, scoreChange };
  },
});
```

- [ ] **Step 5: Add recall and extend mutations**

Add to `apps/web/convex/copies.ts`:
```typescript
export const recall = mutation({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const copy = await ctx.db.get(args.copyId);
    if (!copy) throw new Error("Copy not found");
    if (copy.ownershipType !== "lent") throw new Error("Can only recall lent books");
    if (copy.originalSharerId !== user._id) throw new Error("You are not the owner");

    if (copy.status === "available") {
      // Book is on shelf — mark as recalled for sharer pickup
      await ctx.db.patch(args.copyId, { status: "recalled" });
    } else if (copy.status === "checked_out") {
      // Book is with a reader — set 7-day grace deadline
      const gracePeriod = 7 * 24 * 60 * 60 * 1000;
      const newDeadline = Date.now() + gracePeriod;
      const currentDeadline = copy.returnDeadline ?? Infinity;
      await ctx.db.patch(args.copyId, {
        returnDeadline: Math.min(currentDeadline, newDeadline),
      });
      // TODO: Send notification to current holder via notifications action
    } else {
      throw new Error("Copy cannot be recalled in its current state");
    }

    return { success: true };
  },
});

export const extend = mutation({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const copy = await ctx.db.get(args.copyId);
    if (!copy || copy.status !== "checked_out") throw new Error("Copy not checked out");
    if (copy.currentHolderId !== user._id) throw new Error("You don't hold this copy");
    if (!copy.returnDeadline) throw new Error("No deadline to extend");

    // Check no active reservations waiting
    const waitingReservation = await ctx.db
      .query("reservations")
      .withIndex("by_copy", (q) =>
        q.eq("copyId", args.copyId).eq("status", "active"),
      )
      .first();
    if (waitingReservation) {
      throw new Error("Cannot extend — someone is waiting for this book");
    }

    // Extend by 50% of original lending period
    const extensionDays = Math.ceil((copy.lendingPeriodDays ?? 21) * 0.5);
    const newDeadline =
      copy.returnDeadline + extensionDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.copyId, { returnDeadline: newDeadline });

    return { success: true, newDeadline };
  },
});
```

- [ ] **Step 6: Push and verify all functions**

```bash
bunx convex dev
```

Expected: All mutations and queries deploy without errors.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add reservation, pickup, return, recall, and extend mutations"
```

---

### Task 8: Scheduled Jobs (Crons)

**Files:**
- Create: `apps/web/convex/crons.ts`

**Important: Steps 2-4 must be completed before Step 1, because the cron definitions reference internal functions that must exist first.**

- [ ] **Step 1: Create cron definitions** (do this LAST in this task, after Steps 2-4)

Create `apps/web/convex/crons.ts`:
```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire reservations",
  { minutes: 5 },
  internal.reservations.expireStale,
);

crons.cron(
  "send return reminders",
  "0 9 * * *", // daily at 9am UTC
  internal.notifications.sendReturnReminders,
);

crons.cron(
  "process overdue",
  "0 0 * * *", // daily at midnight UTC
  internal.copies.processOverdue,
);

crons.cron(
  "recalculate reputation",
  "0 3 * * 0", // weekly Sunday at 3am UTC
  internal.users.recalculateReputation,
);

export default crons;
```

- [ ] **Step 2: Add expireStale internal mutation to reservations**

Add to `apps/web/convex/reservations.ts`:
```typescript
import { internalMutation } from "./_generated/server";
import { REPUTATION, clampScore } from "./lib/reputation";

export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeReservations = await ctx.db
      .query("reservations")
      .withIndex("by_expiry", (q) => q.eq("status", "active"))
      .collect();

    for (const reservation of activeReservations) {
      if (reservation.expiresAt <= now) {
        // Expire the reservation
        await ctx.db.patch(reservation._id, { status: "expired" });

        // Release the copy
        const copy = await ctx.db.get(reservation.copyId);
        if (copy && copy.status === "reserved") {
          await ctx.db.patch(reservation.copyId, { status: "available" });
        }

        // Apply no-show penalty
        const user = await ctx.db.get(reservation.userId);
        if (user) {
          await ctx.db.patch(reservation.userId, {
            reputationScore: clampScore(
              user.reputationScore + REPUTATION.NO_SHOW,
            ),
          });
        }
      }
    }
  },
});
```

- [ ] **Step 3: Add processOverdue internal mutation to copies**

Add to `apps/web/convex/copies.ts`:
```typescript
import { internalMutation } from "./_generated/server";

export const processOverdue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Note: import at top of file: import { REPUTATION, clampScore } from "./lib/reputation";

    // Find all checked-out copies past deadline
    const allCopies = await ctx.db.query("copies").collect();
    const overdue = allCopies.filter(
      (c) =>
        c.status === "checked_out" &&
        c.returnDeadline &&
        c.returnDeadline < now,
    );

    for (const copy of overdue) {
      if (!copy.currentHolderId) continue;
      const user = await ctx.db.get(copy.currentHolderId);
      if (user) {
        await ctx.db.patch(user._id, {
          reputationScore: clampScore(
            user.reputationScore + REPUTATION.OVERDUE_DAILY,
          ),
        });
      }
    }
  },
});
```

- [ ] **Step 4: Add placeholder internal mutations for notifications and reputation recalc**

Add to `apps/web/convex/users.ts`:
```typescript
import { internalMutation } from "./_generated/server";

export const recalculateReputation = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Audit pass: compare incremental scores with full history
    // For MVP, this is a no-op placeholder
    // Full implementation: iterate all users, recompute from journeyEntries
    console.log("Reputation audit pass completed");
  },
});
```

Create `apps/web/convex/notifications.ts`:
```typescript
import { internalAction } from "./_generated/server";

export const sendReturnReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    const allCopies = await ctx.db.query("copies").collect();
    const upcoming = allCopies.filter(
      (c) =>
        c.status === "checked_out" &&
        c.returnDeadline &&
        c.returnDeadline > now &&
        c.returnDeadline - now <= threeDaysMs,
    );

    for (const copy of upcoming) {
      // TODO: Send email via Resend when Resend is configured
      console.log(
        `Reminder: Copy ${copy._id} due in ${Math.ceil((copy.returnDeadline! - now) / (24 * 60 * 60 * 1000))} days`,
      );
    }
  },
});
```

- [ ] **Step 5: Push and verify crons are registered**

```bash
bunx convex dev
```

Expected: Convex dashboard shows 4 scheduled jobs.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add scheduled jobs — reservation expiry, reminders, overdue, reputation audit"
```

---

## Chunk 3: Reader Frontend — Core Pages

### Task 9: Landing Page

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/ui/` (additional shadcn components as needed)

- [ ] **Step 1: Build the landing page**

Replace `apps/web/app/page.tsx` with a landing page containing:
- Hero section: "Books that walk" tagline, short description, CTA to browse/sign up
- "How It Works" section: 3 steps (Share → Discover → Read & Return)
- Stats section (placeholder numbers for MVP): books shared, active readers, partner locations
- CTA section: "Start sharing books today"

Use shadcn `Button`, `Card` components. Warm earthy styling per theme.

- [ ] **Step 2: Verify locally**

```bash
bun run dev
```

Expected: Landing page renders at localhost:3000 with warm community aesthetic.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add landing page with hero, how-it-works, and CTA sections"
```

---

### Task 10: Browse & Search Pages

**Files:**
- Create: `apps/web/app/browse/page.tsx`
- Create: `apps/web/app/search/page.tsx`
- Create: `apps/web/components/book-card.tsx`
- Create: `apps/web/components/category-grid.tsx`

- [ ] **Step 1: Create BookCard component**

Create `apps/web/components/book-card.tsx`:
- Displays book cover image, title, author, average rating, available copy count
- Links to `/book/[id]`
- Uses shadcn `Card`, `Badge` for categories

- [ ] **Step 2: Create CategoryGrid component**

Create `apps/web/components/category-grid.tsx`:
- Grid of category cards (Fiction, Science, History, Biography, etc.)
- Each card links to `/browse?category=<name>`
- Use warm icons/colors per category

- [ ] **Step 3: Build browse page**

Create `apps/web/app/browse/page.tsx`:
- Shows `CategoryGrid` at top
- If `?category=` param present, fetches `books.byCategory` and shows `BookCard` grid
- Uses Convex `useQuery` for real-time data

- [ ] **Step 4: Build search page**

Create `apps/web/app/search/page.tsx`:
- Search input at top (debounced, 300ms)
- Results grid of `BookCard` components
- Uses `books.search` query
- Empty state: "Search for books by title or author"

- [ ] **Step 5: Verify both pages**

```bash
bun run dev
```

Navigate to `/browse` and `/search`. Expected: pages render (empty state since no data yet).

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add browse and search pages with BookCard and CategoryGrid"
```

---

### Task 11: Book Detail & Copy Detail Pages

**Files:**
- Create: `apps/web/app/book/[id]/page.tsx`
- Create: `apps/web/app/copy/[id]/page.tsx`
- Create: `apps/web/components/copy-card.tsx`
- Create: `apps/web/components/copy-journey.tsx`
- Create: `apps/web/components/star-rating.tsx`
- Create: `apps/web/components/reputation-badge.tsx`

- [ ] **Step 1: Create shared components**

`star-rating.tsx`: 1-5 star display and input (clickable stars for reviews, read-only for display).
`reputation-badge.tsx`: Colored badge showing score (green > 50, yellow 30-50, red < 30).
`copy-card.tsx`: Shows copy status, condition, current location, link to copy detail.

- [ ] **Step 2: Build book detail page**

Create `apps/web/app/book/[id]/page.tsx`:
- Book metadata (cover, title, author, description, categories, page count)
- Available copies section (list of `CopyCard` components with location)
- Reviews section (list of reviews with star ratings)
- "Reserve" button on each available copy (opens reservation flow)

Uses queries: `books.byId`, `copies.byBook`, `reviews.byBook` (add to `convex/reviews.ts`).

- [ ] **Step 3: Create CopyJourney timeline component**

Create `apps/web/components/copy-journey.tsx`:
- Vertical timeline showing each journey entry
- Each entry: reader name (linked to profile), pickup location → dropoff location, dates, condition change, reader note
- Visual connectors between entries showing the book's travel path

- [ ] **Step 4: Build copy detail page**

Create `apps/web/app/copy/[id]/page.tsx`:
- Copy info: book title (linked), current status, condition, current location
- QR code display
- Journey timeline (`CopyJourney` component)
- Reader notes from each journey entry
- Condition report history with photos

Uses queries: `copies.byId`, `copies.journey`, `books.byId`.

- [ ] **Step 5: Add reviews query**

Add to a new `apps/web/convex/reviews.ts`:
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const byBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
  },
});

export const create = mutation({
  args: {
    bookId: v.id("books"),
    rating: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Upsert: one review per user per book
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_book", (q) =>
        q.eq("userId", user._id).eq("bookId", args.bookId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        text: args.text,
      });
      return existing._id;
    }

    const reviewId = await ctx.db.insert("reviews", {
      bookId: args.bookId,
      userId: user._id,
      rating: args.rating,
      text: args.text,
    });

    // Update book aggregate rating
    const book = await ctx.db.get(args.bookId);
    if (book) {
      const newCount = book.reviewCount + 1;
      const newAvg =
        (book.avgRating * book.reviewCount + args.rating) / newCount;
      await ctx.db.patch(args.bookId, {
        avgRating: Math.round(newAvg * 10) / 10,
        reviewCount: newCount,
      });
    }

    return reviewId;
  },
});
```

- [ ] **Step 6: Verify pages**

```bash
bun run dev
```

Expected: `/book/[id]` and `/copy/[id]` pages render (with loading states when no data).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add book detail, copy detail pages with journey timeline and reviews"
```

---

### Task 12: Location Map & Location Detail

**Files:**
- Create: `apps/web/app/locations/page.tsx`
- Create: `apps/web/app/locations/[id]/page.tsx`
- Create: `apps/web/components/location-map.tsx`
- Create: `apps/web/convex/partnerLocations.ts`
- Create: `apps/web/lib/geo.ts`

- [ ] **Step 1: Install Leaflet**

```bash
cd apps/web
bun add leaflet react-leaflet
bun add -d @types/leaflet
```

- [ ] **Step 2: Create geo helpers**

Create `apps/web/lib/geo.ts`:
```typescript
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
```

- [ ] **Step 3: Create partnerLocations module**

Create `apps/web/convex/partnerLocations.ts`:
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("partnerLocations").collect();
  },
});

export const byId = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.locationId);
  },
});

export const nearby = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("partnerLocations").collect();
    return all.filter(
      (loc) =>
        loc.lat >= args.minLat &&
        loc.lat <= args.maxLat &&
        loc.lng >= args.minLng &&
        loc.lng <= args.maxLng,
    );
  },
});
```

- [ ] **Step 4: Create LocationMap component**

Create `apps/web/components/location-map.tsx`:
- Leaflet map with OpenStreetMap tiles
- Markers for each partner location
- Popup on click showing name, address, book count
- Uses `dynamic` import (SSR-safe for Leaflet)

- [ ] **Step 5: Build locations page and detail page**

`apps/web/app/locations/page.tsx`:
- Full-width map with all partner locations
- Sidebar list of locations sorted by distance (if geolocation available)
- Each location links to detail page

`apps/web/app/locations/[id]/page.tsx`:
- Location details (name, address, hours, photos)
- Map showing single location
- List of available books at this location (uses `copies.byLocation`)

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add partner locations map page with Leaflet and location details"
```

---

### Task 13: Share a Book Flow

**Files:**
- Create: `apps/web/app/(reader)/share/page.tsx`
- Create: `apps/web/components/isbn-scanner.tsx`
- Create: `apps/web/components/condition-photo-capture.tsx`
- Create: `apps/web/components/location-picker.tsx`

- [ ] **Step 1: Install html5-qrcode**

```bash
cd apps/web
bun add html5-qrcode
```

- [ ] **Step 2: Create ISBN scanner component**

Create `apps/web/components/isbn-scanner.tsx`:
- Uses `html5-qrcode` library for barcode scanning
- On scan success, calls `books.lookupISBN` action
- Shows auto-filled form with option to edit
- Manual entry fallback with all fields

- [ ] **Step 3: Create condition photo capture component**

Create `apps/web/components/condition-photo-capture.tsx`:
- Camera access via `navigator.mediaDevices.getUserMedia`
- Capture button, preview, retake option
- Uploads to Convex file storage
- Returns array of storage IDs

- [ ] **Step 4: Create location picker component**

Create `apps/web/components/location-picker.tsx`:
- Leaflet map with partner location markers
- Click marker to select as drop-off point
- Shows selected location name/address
- Uses `partnerLocations.list` or `partnerLocations.nearby`

- [ ] **Step 5: Build multi-step share page**

Create `apps/web/app/(reader)/share/page.tsx`:
- Step 1: ISBN scan or manual entry → auto-fill book details
- Step 2: Choose ownership (donated/lent), set lending period if lent
- Step 3: Condition photo capture + condition rating selector
- Step 4: Select drop-off partner location on map
- Step 5: Confirmation + call `books.register` mutation
- Success: show copy ID and instructions to drop at location

Uses React state machine or simple step counter for wizard flow.

- [ ] **Step 6: Verify flow**

```bash
bun run dev
```

Expected: Full share flow works end-to-end (requires Convex dev running).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add book sharing flow with ISBN scanner, condition capture, and location picker"
```

---

### Task 14: Reader Dashboard

**Files:**
- Create: `apps/web/app/(reader)/dashboard/page.tsx`
- Create: `apps/web/components/reservation-timer.tsx`

- [ ] **Step 1: Create reservation countdown timer**

Create `apps/web/components/reservation-timer.tsx`:
- Displays mm:ss countdown from `expiresAt`
- Red warning when < 10 minutes
- Auto-refreshes every second via `useEffect`

- [ ] **Step 2: Build reader dashboard**

Create `apps/web/app/(reader)/dashboard/page.tsx`:
- **Currently Reading**: copies where user is `currentHolderId`, show return deadline, extend button
- **Active Reservations**: with countdown timers, cancel button
- **Books I've Shared**: list of copies the user registered, with recall button for lent books
- **Reading Stats**: books read, books shared, reputation score badge
- **Reading History**: recent journey entries

Uses queries: `users.currentUser`, `reservations.active`, `copies.byHolder` (add new query), `copies.bySharer` (add new query), `journeyEntries.byReader` (add new query).

- [ ] **Step 3: Add missing queries**

Add to `apps/web/convex/copies.ts`:
```typescript
export const byHolder = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("copies")
      .withIndex("by_holder", (q) => q.eq("currentHolderId", user._id))
      .collect();
  },
});

export const bySharer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];
    return await ctx.db
      .query("copies")
      .withIndex("by_sharer", (q) => q.eq("originalSharerId", user._id))
      .collect();
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add reader dashboard with active reads, reservations, and shared books"
```

---

### Task 15: Reader Profile & Social

**Files:**
- Create: `apps/web/app/profile/[id]/page.tsx`
- Create: `apps/web/convex/follows.ts`
- Modify: `apps/web/app/(reader)/settings/page.tsx`

- [ ] **Step 1: Create follows module**

Create `apps/web/convex/follows.ts`:
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const isFollowing = query({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return false;
    const follow = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("followingId", args.targetUserId),
      )
      .unique();
    return !!follow;
  },
});

export const toggle = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", user._id).eq("followingId", args.targetUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }

    await ctx.db.insert("follows", {
      followerId: user._id,
      followingId: args.targetUserId,
    });
    return { following: true };
  },
});

export const followers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();
  },
});

export const following = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
  },
});
```

- [ ] **Step 2: Build public profile page**

Create `apps/web/app/profile/[id]/page.tsx`:
- User avatar, name, bio, reputation badge
- Stats: books shared, books read, followers, following
- Follow/unfollow button (if authenticated and not own profile)
- Recent reading activity (journey entries)
- Books shared by this user
- Favorite genres

- [ ] **Step 3: Build settings page**

Create `apps/web/app/(reader)/settings/page.tsx`:
- Edit display name, bio, avatar
- Favorite genres selector
- Notification preferences (email on/off)
- Uses `users.update` mutation (add to `convex/users.ts`)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add reader profile, social follows, and settings page"
```

---

## Chunk 4: Partner Dashboard

### Task 16: Partner Layout & Dashboard

**Files:**
- Create: `apps/web/app/partner/layout.tsx`
- Create: `apps/web/app/partner/page.tsx`

- [ ] **Step 1: Create partner role guard layout**

Create `apps/web/app/partner/layout.tsx`:
```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useQuery(api.users.currentUser);

  if (user === undefined) return <div>Loading...</div>;
  if (!user || !user.roles.includes("partner")) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Build partner dashboard**

Create `apps/web/app/partner/page.tsx`:
- **Today's overview**: reservations incoming, books on shelf, recent activity
- **Shelf inventory**: quick view of all copies at this location
- **Pending pickups**: reservations expiring soon
- **Quick actions**: scan button (link to `/partner/scan`), print label button

Uses queries: `copies.byLocation`, `reservations.byLocation` (add new query).

- [ ] **Step 3: Add partner-specific queries**

Add to `apps/web/convex/reservations.ts`:
```typescript
export const byLocation = query({
  args: { locationId: v.id("partnerLocations") },
  handler: async (ctx, args) => {
    // Get active reservations for copies at this location
    const copies = await ctx.db
      .query("copies")
      .withIndex("by_location", (q) =>
        q.eq("currentLocationId", args.locationId),
      )
      .collect();

    const reservations = [];
    for (const copy of copies) {
      const res = await ctx.db
        .query("reservations")
        .withIndex("by_copy", (q) =>
          q.eq("copyId", copy._id).eq("status", "active"),
        )
        .collect();
      reservations.push(...res);
    }
    return reservations;
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add partner dashboard with role guard and shelf overview"
```

---

### Task 17: Partner QR Scanner

**Files:**
- Create: `apps/web/app/partner/scan/page.tsx`
- Create: `apps/web/components/qr-scanner.tsx`

- [ ] **Step 1: Create QR scanner component**

Create `apps/web/components/qr-scanner.tsx`:
- Uses `html5-qrcode` library
- Decodes URL from QR → extracts copy ID
- Calls back with copy ID on successful scan
- Start/stop scanning controls

- [ ] **Step 2: Build partner scan page**

Create `apps/web/app/partner/scan/page.tsx`:
- QR scanner at top
- On scan: fetch copy by ID, show contextual actions based on status:
  - `reserved` → "Hand off to [reader name]" + confirm button
  - `checked_out` (being returned) → "Check in" + condition flag option
  - `available` (new from sharer) → "Add to shelf" + print label button
- Manual copy ID input as fallback

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add partner QR scanner with contextual actions"
```

---

### Task 18: Partner Inventory & Reports

**Files:**
- Create: `apps/web/app/partner/inventory/page.tsx`
- Create: `apps/web/app/partner/reports/page.tsx`
- Create: `apps/web/app/partner/settings/page.tsx`
- Create: `apps/web/convex/conditionReports.ts`

- [ ] **Step 1: Create conditionReports module**

Create `apps/web/convex/conditionReports.ts`:
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const byCopy = query({
  args: { copyId: v.id("copies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conditionReports")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .collect();
  },
});

export const create = mutation({
  args: {
    copyId: v.id("copies"),
    type: v.union(
      v.literal("pickup_check"),
      v.literal("return_check"),
      v.literal("damage_report"),
    ),
    photos: v.array(v.string()),
    description: v.string(),
    previousCondition: v.string(),
    newCondition: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const reportId = await ctx.db.insert("conditionReports", {
      copyId: args.copyId,
      reportedByUserId: user._id,
      reportedByPartnerId: undefined,
      type: args.type,
      photos: args.photos,
      description: args.description,
      previousCondition: args.previousCondition,
      newCondition: args.newCondition,
      createdAt: Date.now(),
    });

    // If damage report, update copy condition and penalize last holder
    if (args.type === "damage_report") {
      await ctx.db.patch(args.copyId, {
        condition: args.newCondition as any,
      });
    }

    return reportId;
  },
});
```

- [ ] **Step 2: Build inventory page**

Create `apps/web/app/partner/inventory/page.tsx`:
- Table of all copies at this location
- Columns: book title, condition, status, days on shelf
- Search/filter within inventory
- Print label action per copy

- [ ] **Step 3: Build reports page**

Create `apps/web/app/partner/reports/page.tsx`:
- List of condition reports for copies at this location
- Filter by type (pickup_check, return_check, damage_report)
- Photo viewer for each report
- Ability to create new damage report

- [ ] **Step 4: Build partner settings page**

Create `apps/web/app/partner/settings/page.tsx`:
- Edit location name, address, contact info
- Operating hours editor
- Shelf capacity setting
- Staff management (add/remove staff user IDs)
- Venue photos management

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add partner inventory, condition reports, and settings pages"
```

---

## Chunk 5: Admin Panel

### Task 19: Admin Panel

**Files:**
- Create: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/admin/users/page.tsx`
- Create: `apps/web/app/admin/locations/page.tsx`
- Create: `apps/web/app/admin/reports/page.tsx`
- Create: `apps/web/app/admin/analytics/page.tsx`

- [ ] **Step 1: Create admin role guard layout**

Create `apps/web/app/admin/layout.tsx` — same pattern as partner layout, checks for `"admin"` in roles array.

- [ ] **Step 2: Build admin overview page**

Create `apps/web/app/admin/page.tsx`:
- Platform stats cards: total books, total users, total locations, active reservations
- Recent activity feed
- Alert cards for: users with score < 15, pending partner applications, unresolved damage reports

- [ ] **Step 3: Build user management page**

Create `apps/web/app/admin/users/page.tsx`:
- Searchable user table: name, phone, reputation, status, role, books read/shared
- Actions: restrict, ban, restore, change roles
- User detail modal with full history

Add admin mutations to `apps/web/convex/users.ts`:
```typescript
export const updateStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("restricted"), v.literal("banned")),
  },
  handler: async (ctx, args) => {
    // Verify caller is admin (check roles)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!caller || !caller.roles.includes("admin")) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(args.userId, { status: args.status });
  },
});
```

- [ ] **Step 4: Build partner locations management page**

Create `apps/web/app/admin/locations/page.tsx`:
- Table of all partner locations
- Approve/reject new partner applications
- Edit location details
- View shelf utilization

- [ ] **Step 5: Build reports page**

Create `apps/web/app/admin/reports/page.tsx`:
- Unresolved damage reports and disputes
- Side-by-side photo comparison (pickup vs return)
- Actions: dismiss report, penalize user, mark copy as damaged

- [ ] **Step 6: Build analytics page**

Create `apps/web/app/admin/analytics/page.tsx`:
- Charts: books shared over time, active users, reservation completion rate
- Top categories, most active locations
- Reputation distribution histogram

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add admin panel with user management, locations, reports, and analytics"
```

---

## Chunk 6: Integration & Polish

### Task 20: Reservation → Pickup → Return End-to-End Flow

**Files:**
- Modify: `apps/web/app/book/[id]/page.tsx` (add reserve button wiring)
- Modify: `apps/web/app/(reader)/dashboard/page.tsx` (add pickup/return actions)

- [ ] **Step 1: Wire up reservation flow on book detail page**

On `/book/[id]`, for each available copy:
- "Reserve" button → calls `reservations.create` → shows success with timer
- If user already has active reservation, show "You already have a reservation"
- If user's reputation is too low, show appropriate error

- [ ] **Step 2: Wire up pickup flow**

On `/dashboard`, for active reservations:
- "Pick Up" button → opens QR scanner → on scan calls `copies.pickup`
- Condition photo capture before confirming
- Shows success with return deadline

- [ ] **Step 3: Wire up return flow**

On `/dashboard`, for currently held books:
- "Return" button → location picker (any partner location) → condition photo + optional note → calls `copies.returnCopy`
- Shows reputation change on success

- [ ] **Step 4: Test full flow end-to-end**

```bash
bun run dev    # terminal 1
bunx convex dev # terminal 2
```

Test: Register a book → reserve it → pick up → return. Verify journey entry, condition reports, and reputation updates.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: wire up complete reservation → pickup → return flow"
```

---

### Task 21: Email Notifications via Resend

**Files:**
- Modify: `apps/web/convex/notifications.ts`
- Create: `apps/web/.env.local` (add Resend key)

- [ ] **Step 1: Install Resend**

```bash
cd apps/web
bun add resend
```

Add to `.env.local`:
```
RESEND_API_KEY=<your-resend-api-key>
```

Set as Convex environment variable:
```bash
bunx convex env set RESEND_API_KEY <your-key>
```

- [ ] **Step 2: Implement sendReturnReminders**

Update `apps/web/convex/notifications.ts` with actual Resend integration:
- Fetch copies due within 3 days
- Look up holder's email (or phone for future SMS)
- Send email via Resend with book title, deadline, return instructions

- [ ] **Step 3: Add notification triggers to mutations**

Add email notifications for:
- Reservation created (confirm to reader)
- Book recalled (notify current holder)
- Reputation dropped below threshold (warning to user)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add email notifications via Resend for reminders and alerts"
```

---

### Task 22: Seed Data for Development

**Files:**
- Create: `apps/web/convex/seed.ts`

- [ ] **Step 1: Create seed script**

Create `apps/web/convex/seed.ts` as an internal mutation:
- 3 partner locations (cafes in different cities)
- 10 books (mix of fiction, non-fiction, varied page counts)
- 15 copies distributed across locations
- 5 journey entries (showing book travel history)
- Sample reviews

- [ ] **Step 2: Run seed**

```bash
bunx convex run seed:run
```

Expected: Dev environment populated with test data.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add development seed data"
```

---

### Task 23: Responsive Design & Mobile Polish

**Files:**
- Modify: Various page and component files

- [ ] **Step 1: Audit all pages for mobile responsiveness**

Check each page on mobile viewport (375px):
- Landing page: stack hero content vertically
- Browse/Search: single column grid on mobile
- Book detail: full-width on mobile
- Dashboard: card stack layout
- Partner pages: optimize scan page for phone use
- Map: full-height on mobile with bottom sheet for list

- [ ] **Step 2: Fix responsive issues**

Apply Tailwind responsive classes (`sm:`, `md:`, `lg:`) to ensure all pages work on:
- Mobile (375px)
- Tablet (768px)
- Desktop (1280px)

- [ ] **Step 3: Test on mobile browser**

Open localhost:3000 on phone (same network) or use Chrome DevTools device emulation.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "fix: ensure full responsive design across all pages"
```

---

### Task 24: Final Verification & Deployment Prep

**Files:**
- Create: `walking-books/CLAUDE.md`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Create project CLAUDE.md**

Create `walking-books/CLAUDE.md` with:
- Project overview and stack
- How to run locally (bun, convex dev, next dev)
- Environment variables needed
- Key architecture decisions
- Conventions

- [ ] **Step 2: Build check**

```bash
cd /Users/orkhanrzazade/Projects/scifi/walking-books
bun run build
```

Expected: Production build succeeds with no errors.

- [ ] **Step 3: Lint check**

```bash
bun run lint
```

Fix any linting errors.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: add project CLAUDE.md and verify production build"
```

---

## Summary

| Chunk | Tasks | What It Delivers |
|-------|-------|-----------------|
| 1: Scaffolding & Schema | 1-4 | Working monorepo, Convex schema, Clerk auth, themed UI |
| 2: Core Backend | 5-8 | Book registration, ISBN lookup, reservations, pickup/return, crons |
| 3: Reader Frontend | 9-15 | Landing, browse, search, book/copy detail, dashboard, profile, social |
| 4: Partner Dashboard | 16-18 | Partner role guard, QR scanner, inventory, reports, settings |
| 5: Admin Panel | 19 | Admin overview, user management, location approvals, analytics |
| 6: Integration & Polish | 20-24 | E2E flow wiring, email notifications, seed data, responsive design |

Total: **24 tasks across 6 chunks**. Each task produces a working commit. The project is buildable and testable after each chunk.
