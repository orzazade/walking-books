"use client";

import {
  LayoutDashboard,
  Users,
  MapPin,
  FileWarning,
  BarChart3,
} from "lucide-react";
import { RoleGuardLayout } from "@/components/role-guard-layout";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/reports", label: "Reports", icon: FileWarning },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuardLayout
      role="admin"
      basePath="/admin"
      navItems={NAV_ITEMS}
      maxWidth="max-w-6xl"
    >
      {children}
    </RoleGuardLayout>
  );
}
