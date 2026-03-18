"use client";

import {
  LayoutDashboard,
  ScanLine,
  Package,
  FileText,
  Settings,
} from "lucide-react";
import { RoleGuardLayout } from "@/components/role-guard-layout";

const NAV_ITEMS = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/scan", label: "Scan", icon: ScanLine },
  { href: "/partner/inventory", label: "Inventory", icon: Package },
  { href: "/partner/reports", label: "Reports", icon: FileText },
  { href: "/partner/settings", label: "Settings", icon: Settings },
];

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuardLayout
      role="partner"
      basePath="/partner"
      navItems={NAV_ITEMS}
      maxWidth="max-w-5xl"
      loadingMaxWidth="max-w-4xl"
    >
      {children}
    </RoleGuardLayout>
  );
}
