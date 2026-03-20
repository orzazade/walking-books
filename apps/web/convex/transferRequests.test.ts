import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    clerkId: "user_tr1",
    phone: "+1234567890",
    name: "Transfer User",
    roles: ["reader"],
    status: "active" as const,
    reputationScore: 50,
    booksShared: 0,
    booksRead: 0,
    favoriteGenres: [],
    ...overrides,
  };
}

function makeLocation(managerId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "Source Cafe",
    address: "123 Main St",
    lat: 0,
    lng: 0,
    contactPhone: "+1000000000",
    operatingHours: {},
    photos: [],
    shelfCapacity: 50,
    currentBookCount: 1,
    managedByUserId: managerId,
    staffUserIds: [],
    avgRating: 0,
    reviewCount: 0,
    ...overrides,
  };
}

describe("transferRequests", () => {
  it("reader can create a transfer request and partner can accept it", async () => {
    const t = convexTest(schema, modules);

    const { bookId, copyId, fromLocId, toLocId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111", name: "Manager" }));
      await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", {
        title: "Test Book",
        author: "Test Author",
        coverImage: "https://example.com/cover.jpg",
        description: "A test book",
        categories: ["fiction"],
        pageCount: 200,
        language: "en",
        avgRating: 0,
        reviewCount: 0,
      });
      const fromId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, { name: "Source Cafe" }));
      const toId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, {
        name: "Dest Cafe",
        address: "456 Oak Ave",
        contactPhone: "+2000000000",
        currentBookCount: 0,
      }));
      const cId = await ctx.db.insert("copies", {
        bookId: bId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: managerId,
        currentLocationId: fromId,
        qrCodeUrl: "https://example.com/qr",
      });
      return { bookId: bId, copyId: cId, fromLocId: fromId, toLocId: toId };
    });

    // Reader creates a transfer request
    const reader = t.withIdentity({ subject: "user_tr1" });
    const requestId = await reader.mutation(api.transferRequests.create, {
      copyId,
      toLocationId: toLocId,
      note: "This cafe is closer to my home",
    });
    expect(requestId).toBeDefined();

    // Verify pending request shows up for the copy
    const pending = await reader.query(api.transferRequests.pendingForCopy, { copyId });
    expect(pending).not.toBeNull();
    expect(pending!.status).toBe("pending");

    // Verify myRequests returns the request with enriched data
    const myReqs = await reader.query(api.transferRequests.myRequests);
    expect(myReqs).toHaveLength(1);
    expect(myReqs[0].bookTitle).toBe("Test Book");
    expect(myReqs[0].fromLocationName).toBe("Source Cafe");
    expect(myReqs[0].toLocationName).toBe("Dest Cafe");

    // Partner sees the request
    const manager = t.withIdentity({ subject: "manager1" });
    const forLoc = await manager.query(api.transferRequests.forLocation, { locationId: fromLocId });
    expect(forLoc).toHaveLength(1);
    expect(forLoc[0].requesterName).toBe("Transfer User");

    // Partner accepts the transfer
    await manager.mutation(api.transferRequests.accept, { requestId });

    // Verify the copy moved to the destination
    const copy = await t.run(async (ctx) => ctx.db.get(copyId));
    expect(copy!.currentLocationId).toBe(toLocId);

    // Verify request is resolved
    const resolved = await reader.query(api.transferRequests.pendingForCopy, { copyId });
    expect(resolved).toBeNull();
  });

  it("duplicate pending request for same copy is rejected", async () => {
    const t = convexTest(schema, modules);

    const { copyId, toLocId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", {
        title: "Dup Book",
        author: "Dup Author",
        coverImage: "https://example.com/cover.jpg",
        description: "A book",
        categories: [],
        pageCount: 100,
        language: "en",
        avgRating: 0,
        reviewCount: 0,
      });
      const fromId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      const toId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, {
        name: "Other Cafe",
        contactPhone: "+3000000000",
        currentBookCount: 0,
      }));
      const cId = await ctx.db.insert("copies", {
        bookId: bId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: managerId,
        currentLocationId: fromId,
        qrCodeUrl: "https://example.com/qr",
      });
      return { copyId: cId, toLocId: toId };
    });

    const reader = t.withIdentity({ subject: "user_tr1" });
    await reader.mutation(api.transferRequests.create, { copyId, toLocationId: toLocId });

    // Second request should fail
    await expect(
      reader.mutation(api.transferRequests.create, { copyId, toLocationId: toLocId }),
    ).rejects.toThrow("You already have a pending transfer request");
  });

  it("reader can cancel their own transfer request", async () => {
    const t = convexTest(schema, modules);

    const { copyId, toLocId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111" }));
      await ctx.db.insert("users", makeUser());
      const bId = await ctx.db.insert("books", {
        title: "Cancel Book",
        author: "Cancel Author",
        coverImage: "https://example.com/cover.jpg",
        description: "A book",
        categories: [],
        pageCount: 100,
        language: "en",
        avgRating: 0,
        reviewCount: 0,
      });
      const fromId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string));
      const toId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, {
        name: "Other",
        contactPhone: "+3000000000",
        currentBookCount: 0,
      }));
      const cId = await ctx.db.insert("copies", {
        bookId: bId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: managerId,
        currentLocationId: fromId,
        qrCodeUrl: "https://example.com/qr",
      });
      return { copyId: cId, toLocId: toId };
    });

    const reader = t.withIdentity({ subject: "user_tr1" });
    const requestId = await reader.mutation(api.transferRequests.create, { copyId, toLocationId: toLocId });

    await reader.mutation(api.transferRequests.cancel, { requestId });

    const pending = await reader.query(api.transferRequests.pendingForCopy, { copyId });
    expect(pending).toBeNull();

    // Cancelled request still appears in myRequests with correct status
    const myReqs = await reader.query(api.transferRequests.myRequests);
    expect(myReqs).toHaveLength(1);
    expect(myReqs[0].status).toBe("cancelled");
    expect(myReqs[0].bookTitle).toBe("Cancel Book");
  });

  it("accepting a transfer auto-rejects other pending requests for the same copy", async () => {
    const t = convexTest(schema, modules);

    const { copyId, fromLocId, toLocId } = await t.run(async (ctx) => {
      const managerId = await ctx.db.insert("users", makeUser({ clerkId: "manager1", phone: "+1111111111", name: "Manager" }));
      await ctx.db.insert("users", makeUser({ clerkId: "reader_a", phone: "+2222222222", name: "Reader A" }));
      await ctx.db.insert("users", makeUser({ clerkId: "reader_b", phone: "+3333333333", name: "Reader B" }));
      const bId = await ctx.db.insert("books", {
        title: "Contested Book",
        author: "Author",
        coverImage: "https://example.com/cover.jpg",
        description: "A book",
        categories: [],
        pageCount: 100,
        language: "en",
        avgRating: 0,
        reviewCount: 0,
      });
      const fromId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, { name: "Source" }));
      const toId = await ctx.db.insert("partnerLocations", makeLocation(managerId as unknown as string, {
        name: "Dest A",
        contactPhone: "+4000000000",
        currentBookCount: 0,
      }));
      const cId = await ctx.db.insert("copies", {
        bookId: bId,
        status: "available" as const,
        condition: "good" as const,
        ownershipType: "donated" as const,
        originalSharerId: managerId,
        currentLocationId: fromId,
        qrCodeUrl: "https://example.com/qr",
      });
      return { copyId: cId, fromLocId: fromId, toLocId: toId };
    });

    // Two different readers request the same copy
    const readerA = t.withIdentity({ subject: "reader_a" });
    const readerB = t.withIdentity({ subject: "reader_b" });
    const reqA = await readerA.mutation(api.transferRequests.create, { copyId, toLocationId: toLocId });
    const reqB = await readerB.mutation(api.transferRequests.create, { copyId, toLocationId: toLocId });

    // Partner accepts reader A's request
    const manager = t.withIdentity({ subject: "manager1" });
    await manager.mutation(api.transferRequests.accept, { requestId: reqA });

    // Reader B's request should be auto-rejected
    const bReqs = await readerB.query(api.transferRequests.myRequests);
    const bReq = bReqs.find((r) => r._id === reqB);
    expect(bReq).toBeDefined();
    expect(bReq!.status).toBe("rejected");
  });

  it("myRequests returns empty array for user with no requests", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", makeUser());
    });

    const reader = t.withIdentity({ subject: "user_tr1" });
    const myReqs = await reader.query(api.transferRequests.myRequests);
    expect(myReqs).toHaveLength(0);
  });
});
