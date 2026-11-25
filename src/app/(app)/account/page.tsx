import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { countRecipesAddedBy, joinedOn, listAllUsers, type MealieUser } from "@/lib/mealie";
import { currentUser, withMealie } from "@/lib/session";
import { ResetLinkButton } from "./reset-link-button";

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

      {self.admin && (
        <Suspense fallback={<p className="text-muted">Loading everyone…</p>}>
          <Members self={self} />
        </Suspense>
      )}
    </div>
  );
}

const joinedFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Admin only: everyone else with an account, newest first. */
async function Members({ self }: { self: MealieUser }) {
  const people = await withMealie(async (t) => {
    const users = (await listAllUsers(t)).filter((u) => u.id !== self.id).reverse();
    return Promise.all(
      users.map(async (u) => {
        const [recipes, joined] = await Promise.all([countRecipesAddedBy(t, u.id), joinedOn(t, u.id)]);
        return { ...u, recipes, joined };
      }),
    );
  });

  return (
    <section>
      <h2 className="font-serif text-2xl font-bold">Everyone else</h2>
      <p className="mb-3 text-sm text-muted">
        {people.length === 0
          ? "No one else has joined yet."
          : `${people.length} ${people.length === 1 ? "person" : "people"}, newest first. Only admins see this.`}
      </p>
      <ul className="space-y-3">
        {people.map((p) => {
          const name = p.fullName || p.username;
          return (
            <li key={p.id} className="rounded-xl bg-surface p-4 shadow-card">
              <p className="font-serif text-lg font-bold">
                {name}
                {p.admin && <span className="ml-2 align-middle font-sans text-xs font-normal text-muted">Admin</span>}
              </p>
              <p className="text-sm break-all text-muted">{p.email}</p>
              <p className="mt-1 text-sm">
                {p.joined ? `Joined ${joinedFormat.format(new Date(p.joined))}` : "Join date unknown"}
                {" · "}
                {p.recipes} {p.recipes === 1 ? "recipe" : "recipes"} added
              </p>
              <div className="mt-2">
                <ResetLinkButton userId={p.id} name={name} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
