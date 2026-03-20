"use client";

import Link from "next/link";
import Image from "next/image";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  BookMarked,
  Search,
  MapPin,
  Share2,
  LayoutDashboard,
  Heart,
  Clock,
  Flame,
  Trophy,
  Rss,
  HandHeart,
  BookOpen,
  Bell,
  Sparkles,
  Users,
  BarChart3,
  Feather,
  Tag,
  CalendarDays,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/browse", label: "Browse", icon: BookMarked },
  { href: "/new", label: "New", icon: Sparkles },
  { href: "/trending", label: "Trending", icon: Flame },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/search", label: "Search", icon: Search },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/authors", label: "Authors", icon: Feather },
  { href: "/book-requests", label: "Requests", icon: HandHeart },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/community", label: "Community", icon: BarChart3 },
] as const;

const AUTH_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/currently-reading", label: "Reading", icon: BookOpen },
  { href: "/activity", label: "Activity", icon: Rss },
  { href: "/following", label: "Following", icon: Users },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/waitlist", label: "Waitlist", icon: Clock },
  { href: "/share", label: "Share", icon: Share2 },
] as const;

function NotificationBell() {
  const unreadCount = useQuery(api.userNotifications.unreadCount);
  const pathname = usePathname();
  const active = pathname === "/notifications";

  return (
    <Link
      href="/notifications"
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg px-2 py-2 text-[0.8125rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      title="Notifications"
    >
      <Bell className="h-4 w-4" />
      {unreadCount !== undefined && unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const mobileAuthItems = [...AUTH_ITEMS, { href: "/notifications", label: "Notifications", icon: Bell }] as const;

  function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof BookMarked }) {
    return (
      <Link
        href={href}
        className={cn(
          "relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[0.8125rem] font-medium transition-colors",
          isActive(href)
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        {isActive(href) && (
          <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] rounded-full bg-primary" />
        )}
      </Link>
    );
  }

  function MobileNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof BookMarked }) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
          isActive(href)
            ? "bg-primary/8 text-primary"
            : "text-foreground hover:bg-muted",
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/50 bg-background/92 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-6 px-5">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15 transition-colors group-hover:bg-primary/12">
            <Image src="/logo.svg" alt="Walking Books" width={22} height={12} />
          </div>
          <span className="font-serif text-[1.2rem] font-semibold tracking-[-0.01em]">
            Walking Books
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          <Authenticated>
            <div className="mx-3 h-4 w-px bg-border/60" />
            {AUTH_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
            <NotificationBell />
            <div className="ml-2">
              <UserButton />
            </div>
          </Authenticated>

          <Unauthenticated>
            <div className="mx-3 h-4 w-px bg-border/60" />
            <SignInButton mode="modal">
              <button className="rounded-lg bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                Sign in
              </button>
            </SignInButton>
          </Unauthenticated>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/80 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border/40 bg-background/98 px-5 py-5 backdrop-blur-xl md:hidden">
          <nav className="grid gap-1">
            {NAV_ITEMS.map((item) => (
              <MobileNavLink key={item.href} {...item} />
            ))}
            <Authenticated>
              <div className="my-1 border-t border-border/40" />
              {mobileAuthItems.map((item) => (
                <MobileNavLink key={item.href} {...item} />
              ))}
            </Authenticated>
          </nav>
          <div className="mt-4 border-t border-border/40 pt-4">
            <Authenticated>
              <UserButton />
            </Authenticated>
            <Unauthenticated>
              <SignInButton mode="modal">
                <Button className="w-full rounded-xl">Sign in</Button>
              </SignInButton>
            </Unauthenticated>
          </div>
        </div>
      )}
    </header>
  );
}
