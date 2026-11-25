import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="mr-auto shrink-0" aria-label={`${SITE_NAME} home`}>
            {/* Horizontal logo; the style guide's minimum is 140px wide (this is ~167px). */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/brand/logo-horizontal.svg" alt={SITE_NAME} width={167} height={56} className="h-14 w-auto" />
          </Link>
          <Link href="/add" className="btn shrink-0 px-3.5 py-2 text-sm whitespace-nowrap">
            + Add
          </Link>
          {/* Plain <a>: a prefetched /logout would sign people out. */}
          <a href="/logout" className="shrink-0 text-sm whitespace-nowrap text-muted hover:text-foreground">
            Sign out
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {children}
      </main>
    </div>
  );
}
