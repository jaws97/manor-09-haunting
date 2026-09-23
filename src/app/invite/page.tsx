import type { Metadata } from "next";
import { InvitePage } from "@/components/invite/Invite";
import { residents } from "@/data/residents";
import "./invite.css";

export const metadata: Metadata = { title: "Manor 09 · Your invitation" };

export default function Page() {
  // Names only — the residents' titles stay on the server until the gallery.
  return <InvitePage cast={residents.map((r) => r.name)} />;
}
