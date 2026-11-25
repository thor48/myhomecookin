"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: keyof typeof ICONS; match: (path: string) => boolean };

const TABS: Tab[] = [
  { href: "/", label: "Recipes", icon: "book", match: (p) => p === "/" || p.startsWith("/recipes") },
  { href: "/my-recipes", label: "My Recipes", icon: "heart", match: (p) => p.startsWith("/my-recipes") },
  { href: "/add", label: "Add", icon: "plus", match: (p) => p.startsWith("/add") },
  { href: "/invite", label: "Invite", icon: "people", match: (p) => p.startsWith("/invite") || p.startsWith("/approve") },
  { href: "/account", label: "Account", icon: "user", match: (p) => p.startsWith("/account") },
];

// Simple line icons (style guide: line icons in Deep Brown / Terracotta).
const ICONS = {
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5",
  heart: "M12 20s-7-4.3-8.9-8.6C1.7 8.2 3.6 4.8 7 4.8c1.9 0 3.3 1 5 2.8 1.7-1.8 3.1-2.8 5-2.8 3.4 0 5.3 3.4 3.9 6.6C19 15.7 12 20 12 20z",
  plus: "M12 5v14M5 12h14",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.8 3.2 2.6 3.5 5.2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5",
};

function Icon({ name, className = "size-6" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Desktop: links across the header, with + Add as a button. */
export function TopNav() {
  return <TopNavLinks path={usePathname()} />;
}

/** `path` "" = nothing highlighted (shown while the current page is being read). */
export function TopNavLinks({ path }: { path: string }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-5 text-sm sm:flex">
      {TABS.filter((t) => t.href !== "/add").map((t) => {
        const active = t.match(path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap transition ${
              active ? "font-bold text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon name={t.icon} className="size-5" />
            {t.label}
          </Link>
        );
      })}
      <Link href="/add" className="btn shrink-0 px-3.5 py-2 text-sm whitespace-nowrap">
        + Add recipe
      </Link>
    </nav>
  );
}

/** Phones: app-style tab bar fixed to the bottom of the screen. */
export function BottomTabBar() {
  return <BottomTabs path={usePathname()} />;
}

export function BottomTabs({ path }: { path: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(path);
          if (t.href === "/add") {
            return (
              <li key={t.href} className="flex items-start justify-center">
                <Link
                  href={t.href}
                  aria-label="Add a recipe"
                  aria-current={active ? "page" : undefined}
                  className="-mt-5 grid size-14 place-items-center rounded-full bg-accent text-white shadow-card ring-4 ring-background transition active:scale-95"
                >
                  <Icon name="plus" className="size-7" />
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[0.7rem] transition ${
                  active ? "font-bold text-accent" : "text-muted"
                }`}
              >
                <Icon name={t.icon} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
