import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "Ask to join" };

// Public page: anyone can ask; an admin approves from the Discord alert.
export default function AskToJoinPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
          <img
            src="/brand/logo-primary.png"
            alt={SITE_NAME}
            width={105}
            height={180}
            className="mx-auto h-45 w-auto"
          />
        </h1>
        <p className="mt-5 text-lg">Ask to join our family cookbook.</p>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll send you an invite link by email once we&apos;ve had a look.
        </p>
      </div>
      <AskForm />
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-link underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
