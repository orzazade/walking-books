"use client";

import { useQuery, useMutation } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  BookOpen,
  CheckCheck,
  Clock,
  Trash2,
  Package,
  RotateCcw,
  AlertTriangle,
  Star,
  Trophy,
  HandHeart,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage, timeAgo } from "@/lib/utils";
import { SignInPrompt } from "@/components/sign-in-prompt";

const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  reservation_confirmed: Clock,
  reservation_expired: Timer,
  book_picked_up: Package,
  book_returned: RotateCcw,
  book_recalled: AlertTriangle,
  waitlist_notified: Bell,
  waitlist_available: Star,
  reputation_milestone: Trophy,
  achievement_unlocked: Trophy,
  book_request_fulfilled: HandHeart,
};

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Authenticated>
        <NotificationsContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to see your notifications." />
      </Unauthenticated>
    </div>
  );
}

function NotificationsContent() {
  const notifications = useQuery(api.userNotifications.list, { limit: 50 });
  const unreadCount = useQuery(api.userNotifications.unreadCount);
  const markRead = useMutation(api.userNotifications.markRead);
  const markAllRead = useMutation(api.userNotifications.markAllRead);
  const remove = useMutation(api.userNotifications.remove);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"userNotifications"> | null>(null);

  if (notifications === undefined) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    try {
      await markAllRead();
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function handleMarkRead(notificationId: Id<"userNotifications">) {
    try {
      await markRead({ notificationId });
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    }
  }

  async function handleDelete(notificationId: Id<"userNotifications">) {
    setDeletingId(notificationId);
    try {
      await remove({ notificationId });
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount !== undefined && unreadCount > 0 && (
            <Badge variant="default" className="rounded-full">
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount !== undefined && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <BellOff className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No notifications yet. We&apos;ll let you know when something happens!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
            return (
              <Card
                key={n._id}
                className={
                  n.read
                    ? "opacity-70"
                    : "border-primary/20 bg-primary/[0.02]"
                }
              >
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      n.read
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${n.read ? "font-normal" : "font-semibold"}`}
                      >
                        {n.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {n.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMarkRead(n._id)}
                        title="Mark as read"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(n._id)}
                      disabled={deletingId === n._id}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
