"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/stat-card";
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
import { type ReportType, REPORT_TYPE_LABELS } from "@/convex/lib/validators";

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
        <StatCard icon={BookOpen} label="Total Books Shared" value={totalBooks} />
        <StatCard icon={Users} label="Total Users" value={totalUsers} iconClassName="text-blue-500" />
        <StatCard icon={MapPin} label="Locations" value={totalLocations} iconClassName="text-green-500" />
        <StatCard icon={Clock} label="Active Readers" value={activeReaders} iconClassName="text-amber-500" />
      </div>

      <Separator className="my-6" />

      {/* Alert cards */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Alerts
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/admin/users", icon: ShieldAlert, iconColor: "text-destructive", title: "Low Reputation Users", count: lowRepUsers.length, desc: "users with score < 15", badgeVariant: "destructive" as const },
            { href: "/admin/locations", icon: MapPin, iconColor: "text-amber-500", title: "Pending Partners", count: pendingPartners.length, desc: "awaiting approval", badgeVariant: "secondary" as const },
            { href: "/admin/reports", icon: FileWarning, iconColor: "text-orange-500", title: "Damage Reports", count: damageReports.length, desc: "unresolved", badgeVariant: "destructive" as const },
          ].map((alert) => (
            <Link key={alert.href} href={alert.href}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-4">
                  <alert.icon className={`h-8 w-8 ${alert.iconColor}`} />
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.count} {alert.desc}
                    </p>
                  </div>
                  {alert.count > 0 && (
                    <Badge variant={alert.badgeVariant} className="ml-auto">
                      {alert.count}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
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
                    <p className="font-medium">
                      {REPORT_TYPE_LABELS[report.type as ReportType]}
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
                      {REPORT_TYPE_LABELS[report.type as ReportType]}
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
