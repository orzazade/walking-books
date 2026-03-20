"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import {
  Package,
  RotateCcw,
  Users,
  Calendar,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

function AnalyticsContent() {
  const location = useQuery(api.partnerLocations.myLocation);

  if (location === undefined) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (location === null) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">
            No partner location found for your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <LocationAnalytics
      locationId={location._id}
      locationName={location.name}
    />
  );
}

function LocationAnalytics({
  locationId,
  locationName,
}: {
  locationId: Id<"partnerLocations">;
  locationName: string;
}) {
  const stats = useQuery(api.partnerLocations.locationStats, { locationId });

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-shimmer h-24 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="animate-shimmer h-48 rounded-lg bg-muted" />
      </div>
    );
  }

  const maxWeekly = Math.max(...stats.weeklyPickups.map((w) => w.count), 1);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-serif">{locationName}</h1>
        <p className="mt-1 text-muted-foreground">Location Analytics</p>
      </div>

      {/* All-time stats */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> All Time
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Package} label="Total Pickups" value={stats.totalPickups} />
          <StatCard icon={RotateCcw} label="Total Returns" value={stats.totalReturns} iconClassName="text-green-500" />
          <StatCard icon={Users} label="Unique Readers" value={stats.uniqueReaders} iconClassName="text-blue-500" />
          <StatCard icon={Calendar} label="Avg Lending" value={`${stats.avgLendingDays}d`} iconClassName="text-amber-500" />
        </div>
      </section>

      {/* Last 30 days */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Last 30 Days
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Package} label="Pickups" value={stats.pickupsLast30} />
          <StatCard icon={RotateCcw} label="Returns" value={stats.returnsLast30} iconClassName="text-green-500" />
          <StatCard icon={Users} label="Readers" value={stats.readersLast30} iconClassName="text-blue-500" />
        </div>
      </section>

      {/* Weekly trend */}
      <section>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Weekly Pickups
        </h2>
        <Card>
          <CardContent className="p-4">
            {stats.totalPickups === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                No pickup activity yet. Books will start showing data once readers pick them up.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                {stats.weeklyPickups.map((week) => (
                  <div key={week.week} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-medium text-foreground">
                      {week.count}
                    </span>
                    <div
                      className="w-full rounded-md bg-primary/80 transition-all"
                      style={{
                        height: `${Math.max((week.count / maxWeekly) * 120, 4)}px`,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {week.week}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export default function PartnerAnalyticsPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/partner">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Button>
        </Link>
      </div>
      <AnalyticsContent />
    </>
  );
}
