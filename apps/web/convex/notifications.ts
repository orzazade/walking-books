import { internalAction } from "./_generated/server";

/**
 * Email Notification System — Resend Integration Placeholder
 *
 * TODO: To enable email notifications:
 * 1. Sign up at https://resend.com and verify your domain
 * 2. Set RESEND_API_KEY environment variable in Convex dashboard
 * 3. Replace console.log calls with actual Resend API calls:
 *
 *    import { Resend } from "resend";
 *    const resend = new Resend(process.env.RESEND_API_KEY);
 *    await resend.emails.send({
 *      from: "Walking Books <noreply@yourdomain.com>",
 *      to: userEmail,
 *      subject: "...",
 *      html: "...",
 *    });
 */

/**
 * Send return reminders for copies due within 3 days.
 * Called daily at 9:00 AM by the cron job in crons.ts.
 *
 * Notification triggers:
 * - 3 days before return deadline: friendly reminder
 * - 1 day before: urgent reminder
 * - On due date: final notice
 */
export const sendReturnReminders = internalAction({
  args: {},
  handler: async () => {
    const now = Date.now();
    const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000;
    const oneDayFromNow = now + 1 * 24 * 60 * 60 * 1000;

    // TODO: Query copies with status "checked_out" and returnDeadline within range
    // const checkedOutCopies = await ctx.runQuery(internal.copies.dueWithin, { deadline: threeDaysFromNow });

    // TODO: For each copy due within 3 days:
    // 1. Look up the current holder (user)
    // 2. Look up the book title via copy.bookId
    // 3. Determine urgency level based on deadline proximity
    // 4. Send appropriate email via Resend

    console.log(
      `[notifications] Would send return reminders for copies due before ${new Date(threeDaysFromNow).toISOString()}`,
    );
    console.log(
      `[notifications] Urgent reminders for copies due before ${new Date(oneDayFromNow).toISOString()}`,
    );

    // TODO: Example email templates to implement:
    //
    // 3-day reminder:
    //   Subject: "Reminder: {bookTitle} is due in 3 days"
    //   Body: friendly reminder with return locations link
    //
    // 1-day reminder:
    //   Subject: "Due tomorrow: {bookTitle}"
    //   Body: urgent reminder, mention reputation impact of late return
    //
    // Overdue notice:
    //   Subject: "Overdue: {bookTitle} — please return soon"
    //   Body: note about daily reputation penalty, link to dashboard
  },
});

/**
 * Notification trigger points throughout the system:
 *
 * 1. RESERVATION CREATED (reservations.create)
 *    → Email to user: "Your reservation is confirmed! Pick up within 1 hour."
 *    → Email to partner location: "A book has been reserved at your location."
 *
 * 2. BOOK PICKED UP (copies.pickup)
 *    → Email to sharer (if lent): "Your book has been picked up by {readerName}."
 *    → Email to reader: "Enjoy reading {bookTitle}! Due by {deadline}."
 *
 * 3. BOOK RETURNED (copies.returnCopy)
 *    → Email to sharer: "Your book has been returned to {locationName}."
 *    → Email to reader: "Thanks for returning! Reputation +{change}."
 *
 * 4. RESERVATION EXPIRED (reservations.expireStale)
 *    → Email to user: "Your reservation for {bookTitle} has expired."
 *
 * 5. COPY RECALLED (copies.recall)
 *    → Email to current holder: "The owner has recalled {bookTitle}. Please return within 7 days."
 *
 * 6. REPUTATION MILESTONE
 *    → Email to user: "Congrats! You've reached Trusted status (80+ reputation)."
 *    → Email to user: "Warning: Your reputation has dropped below 30."
 */
