"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  MapPin,
  Star,
} from "lucide-react";

/** Simple CSS bar chart component — no external charting library. */
function BarChart({
  data,
  maxValue,
  color = "bg-primary",
}: {
  data: { label: string; value: number }[];
  maxValue?: number;
  color?: string;
}) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-24 truncate text-xs text-muted-foreground text-right">
            {item.label}
          </span>
          <div className="flex-1">
            <div className="h-5 w-full overflow-hidden rounded bg-muted">
              <div
                className={`h-full rounded ${color} transition-all`}
                style={{
                  width: `${Math.max((item.value / max) * 100, 2)}%`,
                }}
              />
            </div>
          </div>
          <span className="w-10 text-right text-xs font-medium">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const allUsers = useQuery(api.users.listAll);
  const allLocations = useQuery(api.partnerLocations.list);
  const allReports = useQuery(api.conditionReports.listAll);

  if (
    allUsers === undefined ||
    allLocations === undefined ||
    allReports === undefined
  ) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  // ── Books shared over time (by month, using _creationTime of reports as proxy) ──
  const reportsByMonth: Record<string, number> = {};
  for (const report of allReports) {
    const d = new Date(report.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    reportsByMonth[key] = (reportsByMonth[key] ?? 0) + 1;
  }
  const monthlyActivity = Object.entries(reportsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([label, value]) => ({ label, value }));

  // ── Active users distribution ──
  const statusCounts = {
    active: allUsers.filter((u) => u.status === "active").length,
    restricted: allUsers.filter((u) => u.status === "restricted").length,
    banned: allUsers.filter((u) => u.status === "banned").length,
  };

  // ── Top categories ──
  const genreCounts: Record<string, number> = {};
  for (const user of allUsers) {
    for (const g of user.favoriteGenres) {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
  }
  const topCategories = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // ── Most active locations (by currentBookCount) ──
  const topLocations = [...allLocations]
    .sort((a, b) => b.currentBookCount - a.currentBookCount)
    .slice(0, 6)
    .map((loc) => ({ label: loc.name, value: loc.currentBookCount }));

  // ── Reputation distribution histogram ──
  const repBuckets: Record<string, number> = {
    "0-9": 0,
    "10-19": 0,
    "20-29": 0,
    "30-39": 0,
    "40-49": 0,
    "50-59": 0,
    "60-69": 0,
    "70-79": 0,
    "80-89": 0,
    "90-100": 0,
  };
  for (const user of allUsers) {
    const score = Math.min(user.reputationScore, 100);
    if (score < 10) repBuckets["0-9"]++;
    else if (score < 20) repBuckets["10-19"]++;
    else if (score < 30) repBuckets["20-29"]++;
    else if (score < 40) repBuckets["30-39"]++;
    else if (score < 50) repBuckets["40-49"]++;
    else if (score < 60) repBuckets["50-59"]++;
    else if (score < 70) repBuckets["60-69"]++;
    else if (score < 80) repBuckets["70-79"]++;
    else if (score < 90) repBuckets["80-89"]++;
    else repBuckets["90-100"]++;
  }
  const reputationData = Object.entries(repBuckets).map(([label, value]) => ({
    label,
    value,
  }));

  // ── Summary stats ──
  const totalBooksShared = allUsers.reduce((sum, u) => sum + u.booksShared, 0);
  const totalBooksRead = allUsers.reduce((sum, u) => sum + u.booksRead, 0);
  const avgReputation =
    allUsers.length > 0
      ? Math.round(
          allUsers.reduce((sum, u) => sum + u.reputationScore, 0) /
            allUsers.length,
        )
      : 0;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Platform insights and trends
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="mt-1 text-xs text-muted-foreground">
              Books Shared
            </span>
            <span className="text-lg font-bold">{totalBooksShared}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <BookOpen className="h-5 w-5 text-green-500" />
            <span className="mt-1 text-xs text-muted-foreground">
              Books Read
            </span>
            <span className="text-lg font-bold">{totalBooksRead}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="mt-1 text-xs text-muted-foreground">
              Active Users
            </span>
            <span className="text-lg font-bold">{statusCounts.active}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Star className="h-5 w-5 text-amber-500" />
            <span className="mt-1 text-xs text-muted-foreground">
              Avg Reputation
            </span>
            <span className="text-lg font-bold">{avgReputation}</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity over time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Activity Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity data yet.
              </p>
            ) : (
              <BarChart data={monthlyActivity} color="bg-primary" />
            )}
          </CardContent>
        </Card>

        {/* User status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> User Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                { label: "Active", value: statusCounts.active },
                { label: "Restricted", value: statusCounts.restricted },
                { label: "Banned", value: statusCounts.banned },
              ]}
              color="bg-blue-500"
            />
          </CardContent>
        </Card>

        {/* Top categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" /> Top Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No genre data yet.
              </p>
            ) : (
              <BarChart data={topCategories} color="bg-amber-500" />
            )}
          </CardContent>
        </Card>

        {/* Most active locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Most Active Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No location data yet.
              </p>
            ) : (
              <BarChart data={topLocations} color="bg-green-500" />
            )}
          </CardContent>
        </Card>

        {/* Reputation distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Reputation Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={reputationData} color="bg-primary" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
