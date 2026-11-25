import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accent text-2xl text-white">
          🍲
        </div>
        <h1 className="font-serif text-3xl font-semibold">{SITE_NAME}</h1>
        <p className="mt-2 text-muted">Sign in with your recipe account.</p>
      </div>
      <Suspense>
        <LoginNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<LoginForm next="/" />}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
      <p className="mt-8 text-center text-sm text-muted">
        No account yet? Ask whoever runs the cookbook for an invite.
      </p>
    </main>
  );
}

type SP = PageProps<"/login">["searchParams"];

async function LoginNotice({ searchParams }: { searchParams: SP }) {
  const { expired } = await searchParams;
  if (!expired) return null;
  return (
    <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">
      You were signed out. Please sign in again.
    </p>
  );
}

async function LoginFormWithNext({ searchParams }: { searchParams: SP }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/"} />;
}
