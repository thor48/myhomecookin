import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="mr-auto min-w-0 truncate font-serif text-xl font-semibold">
            {SITE_NAME}
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
