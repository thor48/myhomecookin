import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/site";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join" };

// Public page: opened from an invite link, /join?token=…
export default function JoinPage({ searchParams }: PageProps<"/join">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
          <img
            src="/brand/logo-primary.png"
            alt={SITE_NAME}
            width={117}
            height={200}
            className="mx-auto h-50 w-auto"
          />
        </h1>
      </div>
      <Suspense>
        <JoinWithToken searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-link underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

async function JoinWithToken({ searchParams }: { searchParams: PageProps<"/join">["searchParams"] }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <p className="rounded-xl bg-accent-soft px-4 py-4 text-center">
        You need an invite link to join. Ask whoever runs the cookbook to send you one.
      </p>
    );
  }
  return (
    <>
      <p className="mb-6 text-center text-lg">
        You&apos;re invited to the family cookbook. Make your account to start sharing recipes.
      </p>
      <JoinForm token={token} />
    </>
  );
}
