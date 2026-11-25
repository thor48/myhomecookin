import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/site";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "New password" };

// Public page: opened from a reset link an admin made, /reset-password?token=…
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
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
        <ResetWithToken searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-link underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

async function ResetWithToken({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <p className="rounded-xl bg-accent-soft px-4 py-4 text-center">
        You need a reset link to change your password. Ask whoever runs the cookbook to send you one.
      </p>
    );
  }
  return (
    <>
      <p className="mb-6 text-center text-lg">Choose a new password for your recipe account.</p>
      <ResetForm token={token} />
    </>
  );
}
