import Link from "next/link";
import Image from "next/image";

const LINK_COLUMNS = [
  {
    heading: "Explore",
    links: [
      { href: "/browse", label: "Browse" },
      { href: "/search", label: "Search" },
      { href: "/locations", label: "Locations" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/share", label: "Share a Book" },
      { href: "/settings", label: "Settings" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border/40">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8">
                <Image
                  src="/logo.svg"
                  alt="Walking Books"
                  width={20}
                  height={11}
                />
              </div>
              <span className="font-serif text-[1rem] font-semibold">
                Walking Books
              </span>
            </Link>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
              A community where books travel between readers through
              neighborhood cafes.
            </p>
          </div>

          {/* Nav links */}
          <div className="flex gap-12">
            {LINK_COLUMNS.map((col) => (
              <div key={col.heading}>
                <h3 className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {col.heading}
                </h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[0.8125rem] text-foreground/70 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-border/30 pt-5">
          <p className="text-[0.75rem] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} The Walking Books. Books are
            meant to travel.
          </p>
        </div>
      </div>
    </footer>
  );
}
