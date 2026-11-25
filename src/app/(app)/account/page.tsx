import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { currentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl font-bold">Account</h1>
      <Suspense fallback={<p className="mt-4 text-muted">Loading…</p>}>
        <Details />
      </Suspense>
    </div>
  );
}

async function Details() {
  const self = await currentUser();
  return (
    <div className="mt-6 space-y-6">
      <dl className="space-y-3 rounded-xl bg-surface p-4 shadow-card">
        <div>
          <dt className="text-xs text-muted">Name</dt>
          <dd className="font-serif text-xl font-bold">{self.fullName || self.username}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Email (you sign in with this)</dt>
          <dd className="break-all">{self.email}</dd>
        </div>
        {self.admin && (
          <div>
            <dt className="text-xs text-muted">Role</dt>
            <dd>Admin: you can edit and delete any recipe and approve join requests.</dd>
          </div>
        )}
      </dl>

      <div className="space-y-2">
        <Link href="/my-recipes" className="btn-quiet w-full justify-start">
          ♥ My Recipes: favorites and what you&apos;ve added
        </Link>
        <Link href="/invite" className="btn-quiet w-full justify-start">
          Invite family
        </Link>
      </div>

      {/* Plain <a>: a prefetched /logout would sign people out. */}
      <a href="/logout" className="btn w-full">
        Sign out
      </a>

      <p className="text-sm text-muted">
        To change your name, email or password, ask whoever runs the cookbook.
        {self.admin && " As admin, you can do this in Mealie on your home network (Settings → Users)."}
      </p>
    </div>
  );
}
