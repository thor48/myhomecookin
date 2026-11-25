import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-5xl items-center gap-3 px-4">
          {/* Horizontal logo: house mark + wordmark, ~142px wide (style guide minimum: 140px). */}
          {/* eslint-disable @next/next/no-img-element -- static brand images */}
          <Link href="/" className="mr-auto flex shrink-0 items-end gap-1.5" aria-label={`${SITE_NAME} home`}>
            <img src="/brand/logo-mark.png" alt="" width={47} height={60} className="h-[3.75rem] w-auto" />
            <img src="/brand/logo-wordmark.png" alt={SITE_NAME} width={89} height={42} className="h-[2.625rem] w-auto" />
          </Link>
          {/* eslint-enable @next/next/no-img-element */}
          <Link href="/add" className="btn shrink-0 px-3.5 py-2 text-sm whitespace-nowrap">
            + Add
          </Link>
          {/* Plain <a>: a prefetched /logout would sign people out. */}
          <a href="/logout" className="shrink-0 text-sm whitespace-nowrap text-muted hover:text-foreground">
            Sign out
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-8">{children}</main>
      <footer className="border-t border-border pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <nav className="mx-auto flex max-w-5xl items-center justify-center gap-6 px-4 pt-5 text-sm">
          <Link href="/invite" className="font-bold text-link underline-offset-2 hover:underline">
            Invite family
          </Link>
          <Link href="/add" className="text-muted hover:text-foreground">
            Add a recipe
          </Link>
        </nav>
      </footer>
    </div>
  );
}
