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
  "0 9 * * *",
  internal.notifications.sendReturnReminders,
);

crons.cron(
  "process overdue",
  "0 0 * * *",
  internal.copies.processOverdue,
);

export default crons;
