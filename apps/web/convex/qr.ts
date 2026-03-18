import { v } from "convex/values";
import { action } from "./_generated/server";

export const generate = action({
  args: { copyId: v.string(), baseUrl: v.string() },
  handler: async (ctx, args) => {
    const url = `${args.baseUrl}/copy/${args.copyId}`;
    const qrResponse = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`,
    );
    const blob = await qrResponse.blob();
    const storageId = await ctx.storage.store(blob);
    return storageId;
  },
});
