import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnimatedMark } from "@/components/animated-mark";
import { SITE_NAME } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1>
          {/* Stacked logo (includes the name). It stirs while signing in (globals.css). */}
          <AnimatedMark variant="stacked" motion="still" alt={SITE_NAME} className="login-logo mx-auto h-60" />
        </h1>
        <p className="mt-4 text-muted">Sign in with your recipe account.</p>
      </div>
      <Suspense>
        <LoginNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<LoginForm next="/" />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/ask-to-join" className="font-bold text-link underline">
          Ask to join
        </Link>
      </p>
    </main>
  );
}

type SP = PageProps<"/login">["searchParams"];

async function LoginNotice({ searchParams }: { searchParams: SP }) {
  const { expired, reset } = await searchParams;
  if (!expired && !reset) return null;
  return (
    <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">
      {reset ? "Your password is changed. Sign in with your new one." : "You were signed out. Please sign in again."}
    </p>
  );
}

async function LoginFormWithNext({ searchParams }: { searchParams: SP }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}
