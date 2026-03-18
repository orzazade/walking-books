import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify webhook signature (Svix headers)
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    const bodyText = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
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
