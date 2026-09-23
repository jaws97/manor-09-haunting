import type { Metadata } from "next";
import { Host } from "@/components/host/Host";
import { PinGate } from "@/components/PinGate";
import { isHost } from "@/server/auth";
import "./host.css";

export const metadata: Metadata = { title: "Manor 09 · Keeper's remote" };

export default async function HostPage() {
  if (!(await isHost())) return <PinGate title="Keeper's remote" />;
  return <Host />;
}
