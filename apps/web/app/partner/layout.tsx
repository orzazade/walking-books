"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import {
  LayoutDashboard,
  ScanLine,
  Package,
  FileText,
  Settings,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

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
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (user !== undefined && (!user || !user.roles.includes("partner"))) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (user === undefined || !user || !user.roles.includes("partner")) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/partner"
              ? pathname === "/partner"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden whitespace-nowrap sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
