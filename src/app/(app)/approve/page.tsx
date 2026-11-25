import type { Metadata } from "next";
import { ApproveRequest } from "./approve-request";

export const metadata: Metadata = { title: "Approve request" };

// Opened from a join-request alert in Discord: /approve#r=<request details>
export default function ApprovePage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-3xl font-bold">Join request</h1>
      <ApproveRequest />
    </div>
  );
}
