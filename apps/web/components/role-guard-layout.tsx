"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface RoleGuardLayoutProps {
  role: string;
  basePath: string;
  navItems: NavItem[];
  maxWidth?: string;
  loadingMaxWidth?: string;
  children: React.ReactNode;
}

export function RoleGuardLayout({
  role,
  basePath,
  navItems,
  maxWidth = "max-w-6xl",
  loadingMaxWidth,
  children,
}: RoleGuardLayoutProps) {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (user !== undefined && (!user || !user.roles.includes(role))) {
      router.replace("/dashboard");
    }
  }, [user, router, role]);

  if (user === undefined || !user || !user.roles.includes(role)) {
    return (
      <main className={`mx-auto ${loadingMaxWidth ?? maxWidth} px-4 py-8`}>
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <div className={`mx-auto ${maxWidth} px-4 py-8`}>
      <nav className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1">
        {navItems.map((item) => {
          const isActive =
            item.href === basePath
              ? pathname === basePath
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
