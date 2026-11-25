import type { Metadata } from "next";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invite family" };

export default function InvitePage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl font-bold">Invite family</h1>
      <p className="mt-1 text-muted">
        Make a link, send it by text or email, and they can join the cookbook with their own
        account.
      </p>
      <InviteForm />
    </div>
  );
}
