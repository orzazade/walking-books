"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  Users,
  MapPin,
  Clock,
  AlertTriangle,
  ShieldAlert,
  FileWarning,
} from "lucide-react";
import Link from "next/link";

export default function AdminOverviewPage() {
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

  const totalUsers = allUsers.length;
  const totalLocations = allLocations.length;
  const totalBooks = allUsers.reduce((sum, u) => sum + u.booksShared, 0);
  const activeReaders = allUsers.filter((u) => u.status === "active").length;

  // Alerts
  const lowRepUsers = allUsers.filter((u) => u.reputationScore < 15);
  const pendingPartners = allUsers.filter(
    (u) => u.roles.includes("partner") && u.status === "restricted",
  );
  const damageReports = allReports.filter((r) => r.type === "damage_report");

  // Recent activity — use condition reports as a proxy, sorted by createdAt desc
  const recentActivity = [...allReports]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Platform-wide statistics and alerts
        </p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="mt-1 text-xs text-muted-foreground">
              Total Books Shared
            </span>
            <span className="text-lg font-bold">{totalBooks}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Users className="h-5 w-5 text-blue-500" />
            <span className="mt-1 text-xs text-muted-foreground">
              Total Users
            </span>
            <span className="text-lg font-bold">{totalUsers}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <MapPin className="h-5 w-5 text-green-500" />
            <span className="mt-1 text-xs text-muted-foreground">
              Locations
            </span>
            <span className="text-lg font-bold">{totalLocations}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="mt-1 text-xs text-muted-foreground">
              Active Readers
            </span>
            <span className="text-lg font-bold">{activeReaders}</span>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      {/* Alert cards */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Alerts
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/admin/users">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-medium">Low Reputation Users</p>
                  <p className="text-sm text-muted-foreground">
                    {lowRepUsers.length} users with score &lt; 15
                  </p>
                </div>
                {lowRepUsers.length > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {lowRepUsers.length}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/locations">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <MapPin className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="font-medium">Pending Partners</p>
                  <p className="text-sm text-muted-foreground">
                    {pendingPartners.length} awaiting approval
                  </p>
                </div>
                {pendingPartners.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {pendingPartners.length}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/reports">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <FileWarning className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="font-medium">Damage Reports</p>
                  <p className="text-sm text-muted-foreground">
                    {damageReports.length} unresolved
                  </p>
                </div>
                {damageReports.length > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {damageReports.length}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Recent activity feed */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No recent activity.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((report) => (
              <Card key={report._id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium capitalize">
                      {report.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        report.type === "damage_report"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {report.type === "damage_report"
                        ? "Damage"
                        : report.type === "pickup_check"
                          ? "Pickup"
                          : "Return"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
