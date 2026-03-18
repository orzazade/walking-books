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
    let body: {
      type: string;
      data: {
        id: string;
        phone_numbers?: { phone_number: string }[];
        first_name?: string;
        last_name?: string;
        image_url?: string;
      };
    };
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

      try {
        await ctx.runMutation(internal.users.createFromClerk, {
          clerkId: id,
          phone,
          name,
          avatarUrl: image_url ?? undefined,
        });
      } catch (error) {
        console.error("Failed to create user from Clerk webhook:", error);
        return new Response("Internal error", { status: 500 });
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
