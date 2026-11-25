import Link from "next/link";
import { Suspense } from "react";
import { BottomTabBar, BottomTabs, TopNav, TopNavLinks } from "@/components/app-nav";
import { AnimatedMark } from "@/components/animated-mark";
import { BACKGROUND_PHOTO, SITE_NAME } from "@/lib/site";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-5xl items-center gap-3 px-4">
          {/* Horizontal logo: house mark + wordmark, ~142px wide (style guide minimum: 140px). */}
          {/* eslint-disable @next/next/no-img-element -- static brand images */}
          <Link href="/" className="mr-auto flex shrink-0 items-end gap-1.5" aria-label={`${SITE_NAME} home`}>
            <AnimatedMark className="h-[3.75rem]" />
            <img src="/brand/logo-wordmark.png" alt={SITE_NAME} width={89} height={42} className="h-[2.625rem] w-auto" />
          </Link>
          {/* eslint-enable @next/next/no-img-element */}
          {/* Desktop links; phones use the bottom tab bar. */}
          <Suspense fallback={<TopNavLinks path="" />}>
            <TopNav />
          </Suspense>
        </div>
      </header>
      {/*
        The page area: background photo anchored to its bottom, fading up to
        transparent. The main area keeps empty space at the bottom where the
        photo shows at full strength, so text only overlaps the faded part.
      */}
      <div className="relative isolate flex flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[62vh] max-h-[42rem] [mask-image:linear-gradient(to_top,rgb(0_0_0/0.95)_0%,rgb(0_0_0/0.8)_25%,rgb(0_0_0/0.3)_55%,transparent_100%)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo with srcset */}
          <img
            src="/brand/page-bg-1000.webp"
            srcSet="/brand/page-bg-1000.webp 1000w, /brand/page-bg-2000.webp 2000w"
            sizes="100vw"
            alt=""
            className="size-full object-cover object-[center_60%]"
          />
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[min(32vh,17rem)]">{children}</main>
      </div>
      {/* On phones, leave room under the footer for the bottom tab bar. */}
      <footer className="bg-[var(--deep-brown)] text-[#f8f1e9]">
        <div className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <p className="text-center text-xs opacity-75">
            Background photo by{" "}
            <a href={BACKGROUND_PHOTO.profileUrl} target="_blank" rel="noopener" className="underline underline-offset-2">
              {BACKGROUND_PHOTO.photographer}
            </a>{" "}
            on{" "}
            <a href={BACKGROUND_PHOTO.photoUrl} target="_blank" rel="noopener" className="underline underline-offset-2">
              Unsplash
            </a>
          </p>
        </div>
      </footer>
      <Suspense fallback={<BottomTabs path="" />}>
        <BottomTabBar />
      </Suspense>
    </div>
  );
}
